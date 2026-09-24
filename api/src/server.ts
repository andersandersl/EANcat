import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import type { Server } from 'node:http';
import sql from 'mssql';
import { z } from 'zod';
import {
  OpportunityError,
  combineCategoryOpportunities,
  createIdempotencyKey,
  diversifyOpportunities,
  findScan,
  matchCategories,
  normalizeEan,
  rankOpportunities,
  scanShop,
  storeScan,
} from './opportunity.js';

dotenv.config();

const DEFAULT_PORT = 8787;
const PORT = (() => {
  const parsed = Number.parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
})();
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:5175';
const WEB_ORIGINS = WEB_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
const PUBLIC_RATE_LIMIT_WINDOW_MS = 60_000;
const PUBLIC_RATE_LIMIT_MAX_REQUESTS = 120;
const OPPORTUNITY_PAGE_SIZE = 10;
const MAX_STORED_OPPORTUNITIES = 20;
const BRAND_CLUSTER_CACHE_TTL_MS = Number.parseInt(process.env.BRAND_CLUSTER_CACHE_TTL_MS || String(10 * 60 * 1000), 10);
const BRAND_CLUSTER_CACHE_MAX_ENTRIES = Number.parseInt(process.env.BRAND_CLUSTER_CACHE_MAX_ENTRIES || '200', 10);
const SQL_AUTH_MODE = (process.env.SQL_AUTH_MODE || 'entra-default').trim().toLowerCase();
const SQL_USE_ENTRA_DEFAULT = SQL_AUTH_MODE === 'entra-default';

// Connects to the ISOLATED public showcase DB (eanrunner-catalog-db), NOT
// production. This API only ever reads the flat, public-safe dbo.showcase_product
// table — it has no path to supplier names, cost prices, or margin percentages.
const baseSqlConfig: sql.config = {
  server: process.env.SQL_SERVER || 'eanrunner-catalog-sql.database.windows.net',
  database: process.env.SQL_DATABASE || 'eanrunner-catalog-db',
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

const sqlConfig: sql.config = SQL_USE_ENTRA_DEFAULT
  ? {
      ...baseSqlConfig,
      authentication: {
        type: 'azure-active-directory-default',
        options: {},
      },
    }
  : {
      ...baseSqlConfig,
      user: process.env.SQL_USER || '',
      password: process.env.SQL_PASSWORD || '',
    };

function sqlEnvSummary(): {
  server: string;
  database: string;
  authMode: string;
  sqlUserConfigured: boolean;
  sqlPasswordConfigured: boolean;
} {
  return {
    server: sqlConfig.server || '',
    database: sqlConfig.database || '',
    authMode: SQL_USE_ENTRA_DEFAULT ? 'entra-default' : 'sql-password',
    sqlUserConfigured: Boolean(process.env.SQL_USER),
    sqlPasswordConfigured: Boolean(process.env.SQL_PASSWORD),
  };
}

// ── Types ───────────────────────────────────────────────────────────────────

type MarginGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'N/A';
type Market = 'dk' | 'se' | 'fi';

type PublicProduct = {
  ean: string;
  title: string;
  brand: string;
  category: string;
  image: string | null;
  stockStatus: 'in stock' | 'not in stock';
  marginGrade: MarginGrade;
  competitorCount: number;
  marketPrice: number | null;
  marketCurrency: string | null;
  cheapestMarketLink: string | null;
  updatedAt: string | null;
};

// Row as returned by productSelectColumns() — per-market columns aliased to
// stable names so the rest of the code is market-agnostic.
type ShowcaseRow = {
  ean: string;
  title: string | null;
  brand: string | null;
  category: string | null;
  image: string | null;
  has_image: boolean;
  margin_grade: string | null;
  in_stock: boolean;
  competitor_count: number | null;
  market_price: number | null;
  market_currency: string | null;
  market_url: string | null;
  updated_at: Date | null;
};

type CategoryRow = { category: string; product_count: number };
type BrandByCategoryRow = { category: string; brand: string };
type BrandClusterResponsePayload = {
  brands: Array<{ brand: string; latestUpdatedAt: string | null; totalProducts: number; items: PublicProduct[] }>;
  totalBrands: number;
  totalProducts: number;
  count: number;
};

type SuggestionType = 'brand' | 'category' | 'keyword' | 'ean';
type SuggestionItem = {
  type: SuggestionType;
  value: string;
  label: string;
  hitCount: number;
};

// ── Validation schemas ───────────────────────────────────────────────────────

const ALLOWED_GRADES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'N/A']);

const searchQuerySchema = z.object({
  query: z.string().trim().max(80).optional(),
  limit: z.coerce.number().min(1).max(5000).optional(),
  page: z.coerce.number().min(1).optional(),
  category: z.string().trim().max(5000).optional(),
  brand: z.string().trim().max(5000).optional(),
  market: z.enum(['dk', 'se', 'fi']).optional(),
  grades: z.string().trim().max(40).optional(), // comma-separated e.g. "A,B,C"
  competition: z.string().trim().max(20).optional(), // comma-separated levels 0,1,2,3
  includeTotal: z.enum(['true', 'false']).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  hasImage: z.enum(['true', 'false']).optional(),
});

const brandClusterQuerySchema = z.object({
  query: z.string().trim().max(80).optional(),
  category: z.string().trim().max(100).optional(),
  market: z.enum(['dk', 'se', 'fi']).optional(),
  grades: z.string().trim().max(40).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  hasImage: z.enum(['true', 'false']).optional(),
  brandOffset: z.coerce.number().min(0).optional(),
  brandLimit: z.coerce.number().min(1).max(100).optional(),
  perBrandLimit: z.coerce.number().min(1).max(20).optional(),
  minBrandProducts: z.coerce.number().min(1).max(50).optional(),
});

const categoriesQuerySchema = z.object({
  market: z.enum(['dk', 'se', 'fi']).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  hasImage: z.enum(['true', 'false']).optional(),
});

const suggestQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  market: z.enum(['dk', 'se', 'fi']).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  hasImage: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().min(1).max(20).optional(),
  types: z.string().trim().max(80).optional(),
});

const eanParamSchema = z.object({ market: z.enum(['dk', 'se', 'fi']).optional() });

const opportunityScanSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  market: z.enum(['dk', 'se', 'fi']).default('se'),
});

const opportunityScanPageSchema = z.object({
  offset: z.coerce.number().int().min(0).max(MAX_STORED_OPPORTUNITIES).default(0),
});

const supplierConnectionSchema = z.object({
  scanId: z.string().uuid(),
  shopUrl: z.string().trim().min(1).max(2048),
  market: z.enum(['DK', 'SE', 'FI']),
  selectedEans: z.array(z.string().trim().min(8).max(14)).min(1).max(MAX_STORED_OPPORTUNITIES),
  contact: z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254),
    company: z.string().trim().min(1).max(160),
    phone: z.string().trim().max(40).optional(),
  }),
  consent: z.literal(true),
});

// ── Column-mapping seam (the ONLY place that knows the physical schema) ───────
// `market` always comes from a z.enum closed set, so interpolating the suffix
// into column names is safe (never user free-text).

type MarketColumns = {
  grade: string;
  inStock: string; // showcase uses a single global has_stock; aliased per call
  competitors: string;
  price: string;
  currency: string;
  url: string;
};

function marketColumns(market: Market): MarketColumns {
  return {
    grade: `margin_grade_${market}`,
    inStock: 'has_stock', // global flag (not per-market) — see showcase_product.sql
    competitors: `competitor_count_${market}`,
    price: `market_price_${market}`,
    currency: `market_currency_${market}`,
    url: `market_url_${market}`,
  };
}

// Builds the SELECT projection, aliasing per-market columns to stable names.
function productSelectColumns(m: MarketColumns): string {
  return `
    ean, title, brand, category, main_image AS image, has_image, synced_at AS updated_at,
    ${m.grade}       AS margin_grade,
    ${m.inStock}     AS in_stock,
    ${m.competitors} AS competitor_count,
    ${m.price}       AS market_price,
    ${m.currency}    AS market_currency,
    ${m.url}         AS market_url
  `;
}

function mapRow(row: ShowcaseRow): PublicProduct {
  return {
    ean: row.ean,
    title: row.title ?? '',
    brand: row.brand ?? '',
    category: row.category ?? '',
    image: row.image || null,
    stockStatus: row.in_stock ? 'in stock' : 'not in stock',
    marginGrade: (row.margin_grade ?? 'N/A').trim() as MarginGrade,
    competitorCount: row.competitor_count ?? 0,
    marketPrice: row.market_price ?? null,
    marketCurrency: row.market_currency ?? null,
    cheapestMarketLink: row.market_url || null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function normalizeQueryToken(value: string): string {
  return value.replace(/\+/g, ' ').trim();
}

function splitCsv(value: string | undefined): string[] {
  const raw = normalizeQueryToken(value || '');
  if (!raw) return [];
  return [...new Set(raw.split(',').map((item) => normalizeQueryToken(item)).filter(Boolean))];
}

function activeGradesFrom(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((g) => g.trim().toUpperCase())
    .filter((g) => ALLOWED_GRADES.has(g));
}

function activeCompetitionLevelsFrom(value: string | undefined): number[] {
  return [...new Set(
    (value || '')
      .split(',')
      .map((level) => Number.parseInt(level.trim(), 10))
      .filter((level) => Number.isInteger(level) && level >= 0 && level <= 3),
  )].sort((a, b) => a - b);
}

// ── Rate limiting + CORS helpers ──────────────────────────────────────────────

const rateLimitByIp = new Map<string, { count: number; resetAt: number }>();

function enforcePublicRateLimit(ip: string, now: number): { limited: boolean; retryAfter: number } {
  const current = rateLimitByIp.get(ip);
  if (!current || now >= current.resetAt) {
    rateLimitByIp.set(ip, { count: 1, resetAt: now + PUBLIC_RATE_LIMIT_WINDOW_MS });
    return { limited: false, retryAfter: 0 };
  }
  if (current.count >= PUBLIC_RATE_LIMIT_MAX_REQUESTS) {
    return { limited: true, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { limited: false, retryAfter: 0 };
}

const opportunityRateByIp = new Map<string, { scans: number; connections: number; resetAt: number }>();

function enforceOpportunityRateLimit(ip: string, action: 'scan' | 'connection'): number {
  const now = Date.now();
  const current = opportunityRateByIp.get(ip);
  const entry = !current || now >= current.resetAt
    ? { scans: 0, connections: 0, resetAt: now + 15 * 60 * 1000 }
    : current;
  entry[action === 'scan' ? 'scans' : 'connections'] += 1;
  opportunityRateByIp.set(ip, entry);
  const count = action === 'scan' ? entry.scans : entry.connections;
  return count <= 10 ? 0 : Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

// ── Brand-cluster in-memory cache ─────────────────────────────────────────────

const brandClusterCache = new Map<string, { payload: BrandClusterResponsePayload; expiresAt: number }>();
const SUGGEST_CACHE_TTL_MS = 2 * 60 * 1000;
const SUGGEST_CACHE_MAX_ENTRIES = 400;
const suggestCache = new Map<string, { payload: SuggestionItem[]; expiresAt: number }>();

function getBrandClusterCacheKey(parts: Record<string, unknown>): string {
  return JSON.stringify(parts);
}

function getCachedBrandClusters(key: string): BrandClusterResponsePayload | null {
  const entry = brandClusterCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    brandClusterCache.delete(key);
    return null;
  }
  return entry.payload;
}

function setCachedBrandClusters(key: string, payload: BrandClusterResponsePayload): void {
  if (brandClusterCache.size >= BRAND_CLUSTER_CACHE_MAX_ENTRIES) {
    const oldestKey = brandClusterCache.keys().next().value;
    if (oldestKey !== undefined) brandClusterCache.delete(oldestKey);
  }
  brandClusterCache.set(key, { payload, expiresAt: Date.now() + BRAND_CLUSTER_CACHE_TTL_MS });
}

function getCachedSuggestions(key: string): SuggestionItem[] | null {
  const entry = suggestCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    suggestCache.delete(key);
    return null;
  }
  return entry.payload;
}

function setCachedSuggestions(key: string, payload: SuggestionItem[]): void {
  if (suggestCache.size >= SUGGEST_CACHE_MAX_ENTRIES) {
    const oldestKey = suggestCache.keys().next().value;
    if (oldestKey !== undefined) suggestCache.delete(oldestKey);
  }
  suggestCache.set(key, { payload, expiresAt: Date.now() + SUGGEST_CACHE_TTL_MS });
}

// ── Connection pool ───────────────────────────────────────────────────────────

let poolPromise: Promise<sql.ConnectionPool> | null = null;

async function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = sql.connect(sqlConfig)
      .then((pool) => {
        console.log('Connected to showcase Azure SQL');
        return pool;
      })
      .catch((err) => {
        // Allow retries on the next request if first connection attempt fails.
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

async function prewarmDefaultBrandClusterCache(port: number): Promise<void> {
  try {
    const perBrandLimits = [2, 3, 6, 8, 9];
    const responses = await Promise.all(
      perBrandLimits.map(async (perBrandLimit) => {
        const params = new URLSearchParams({
          market: 'dk',
          brandOffset: '0',
          brandLimit: '10',
          perBrandLimit: String(perBrandLimit),
          minBrandProducts: '9',
          inStock: 'true',
          hasImage: 'true',
        });
        const response = await fetch(`http://localhost:${port}/api/public/brand-clusters?${params.toString()}`);
        return { perBrandLimit, response };
      }),
    );

    const failed = responses.filter(({ response }) => !response.ok);
    if (failed.length > 0) {
      console.warn(`[BrandCluster prewarm] Partial failure for perBrandLimit values: ${failed.map((f) => f.perBrandLimit).join(', ')}`);
      return;
    }

    console.log('[BrandCluster prewarm] Homepage cluster cache warmed for perBrandLimit 2,3,6,8,9');
  } catch (error) {
    console.warn('[BrandCluster prewarm] Failed to warm cache:', error);
  }
}

// ── App ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const app = express();

  const envSummary = sqlEnvSummary();
  if (envSummary.authMode === 'sql-password' && (!envSummary.sqlUserConfigured || !envSummary.sqlPasswordConfigured)) {
    console.warn('SQL configuration is incomplete', envSummary);
  }
  if (process.env.NODE_ENV === 'production' && WEB_ORIGINS.some((origin) => origin.includes('localhost'))) {
    console.warn('CORS is configured with localhost origins in production', { WEB_ORIGINS });
  }

  // Warm SQL connection in the background so the first public request avoids pool setup latency.
  void getPool().catch((error) => {
    console.warn('[SQL preconnect] Initial pool warm-up failed, will retry on demand:', error);
  });

  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (WEB_ORIGINS.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && isLocalhostOrigin(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/public', (req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
      next();
      return;
    }
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const { limited, retryAfter } = enforcePublicRateLimit(ip, now);
    if (limited) {
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
      return;
    }
    next();
  });

  app.get('/health', async (_req, res) => {
    try {
      const pool = await getPool();
      await pool.request().query('SELECT 1 AS ok');
      res.json({ ok: true, service: 'webversion-api', db: 'up' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown database error';
      res.status(503).json({ ok: false, service: 'webversion-api', db: 'down', sql: sqlEnvSummary(), error: message });
    }
  });

  // ── GET /api/public/products ────────────────────────────────────────────────
  app.get('/api/public/products', async (req, res) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const market = (parsed.data.market ?? 'dk') as Market;
    const m = marketColumns(market);
    const limit = parsed.data.limit ?? 48;
    const page = parsed.data.page ?? 1;
    const offset = (page - 1) * limit;
    const includeTotal = parsed.data.includeTotal !== 'false';

    const rawQuery = normalizeQueryToken(parsed.data.query || '');
    const categoryValues = splitCsv(parsed.data.category);
    const brandValues = splitCsv(parsed.data.brand);
    const activeGrades = activeGradesFrom(parsed.data.grades);
    const activeCompetitionLevels = activeCompetitionLevelsFrom(parsed.data.competition);

    try {
      const pool = await getPool();

      const buildWhere = (request: sql.Request): string => {
        const conditions: string[] = [];
        if (rawQuery) {
          request.input('query', sql.NVarChar, `%${rawQuery}%`);
          conditions.push('(ean LIKE @query OR title LIKE @query OR brand LIKE @query)');
        }
        if (categoryValues.length > 0) {
          request.input('categoryCsv', sql.NVarChar, categoryValues.join(','));
          conditions.push(`EXISTS (SELECT 1 FROM STRING_SPLIT(@categoryCsv, ',') f WHERE LTRIM(RTRIM(f.value)) = category)`);
        }
        if (brandValues.length > 0) {
          request.input('brandCsv', sql.NVarChar, brandValues.join(','));
          conditions.push(`EXISTS (SELECT 1 FROM STRING_SPLIT(@brandCsv, ',') f WHERE UPPER(LTRIM(RTRIM(f.value))) = UPPER(LTRIM(RTRIM(brand))))`);
        }
        if (parsed.data.inStock === 'true') conditions.push(`${m.inStock} = 1`);
        if (parsed.data.hasImage === 'true') conditions.push('has_image = 1');
        if (activeGrades.length > 0) {
          // Safe: values are from ALLOWED_GRADES only.
          const inList = activeGrades.map((g) => `'${g}'`).join(',');
          conditions.push(`${m.grade} IN (${inList})`);
        }
        if (activeCompetitionLevels.length > 0) {
          // Safe: values are clamped to 0..3 only.
          const inList = activeCompetitionLevels.join(',');
          conditions.push(`
            CASE
              WHEN COALESCE(${m.competitors}, 0) <= 0 THEN 0
              WHEN ${m.competitors} = 1 THEN 1
              WHEN ${m.competitors} <= 3 THEN 2
              ELSE 3
            END IN (${inList})
          `);
        }
        return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      };

      const dataRequest = pool.request();
      dataRequest.input('limit', sql.Int, limit);
      dataRequest.input('offset', sql.Int, offset);
      const whereClause = buildWhere(dataRequest);

      const shouldPrioritizeImages = brandValues.length > 0 && parsed.data.hasImage !== 'true';
      const orderByClause = shouldPrioritizeImages
        ? `ORDER BY CASE WHEN has_image = 1 THEN 0 ELSE 1 END,
                 ${m.competitors} DESC,
                 CASE WHEN ${m.grade} = 'N/A' THEN 1 ELSE 0 END,
                 synced_at DESC, ean ASC`
        : `ORDER BY ${m.competitors} DESC,
                 CASE WHEN ${m.grade} = 'N/A' THEN 1 ELSE 0 END,
                 synced_at DESC, ean ASC`;

      const dataResult = await dataRequest.query(`
        SELECT ${productSelectColumns(m)}
        FROM dbo.showcase_product
        ${whereClause}
        ${orderByClause}
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

      let total: number | null = null;
      if (includeTotal) {
        const countRequest = pool.request();
        buildWhere(countRequest); // rebind same params on the count request
        const countResult = await countRequest.query(`SELECT COUNT(*) AS total FROM dbo.showcase_product ${whereClause}`);
        total = countResult.recordset[0]?.total ?? 0;
      }

      const products = (dataResult.recordset as ShowcaseRow[]).map(mapRow);
      res.json({ products, count: products.length, total });
    } catch (err) {
      console.error('Error fetching products', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/public/brand-clusters ────────────────────────────────────────────
  // Window-function brand ranking preserved verbatim; the per-market grade/stock/
  // price/competitor values are now plain columns, so the price/grade CTEs are gone.
  app.get('/api/public/brand-clusters', async (req, res) => {
    const parsed = brandClusterQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const market = (parsed.data.market ?? 'dk') as Market;
    const m = marketColumns(market);
    const rawQuery = normalizeQueryToken(parsed.data.query || '');
    const rawCategory = normalizeQueryToken(parsed.data.category || '');
    const brandOffset = parsed.data.brandOffset ?? 0;
    const brandLimit = parsed.data.brandLimit ?? 20;
    const perBrandLimit = parsed.data.perBrandLimit ?? 9;
    const minBrandProducts = parsed.data.minBrandProducts ?? 9;
    const activeGrades = activeGradesFrom(parsed.data.grades);
    const gradeWhereClause = activeGrades.length > 0
      ? `WHERE ${m.grade} IN (${activeGrades.map((g) => `'${g}'`).join(',')})`
      : '';

    const cacheKey = getBrandClusterCacheKey({
      rawQuery, rawCategory, market, brandOffset, brandLimit, perBrandLimit, minBrandProducts,
      grades: activeGrades.join(','), inStock: parsed.data.inStock, hasImage: parsed.data.hasImage,
    });
    const cached = getCachedBrandClusters(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    try {
      const pool = await getPool();

      // Base filter keeps semantic filters (query/category). Stock/image are
      // applied only for preview items so brand totals can represent the wider set.
      const buildBaseFiltered = (request: sql.Request): string => {
        const conditions: string[] = [];
        if (rawQuery) {
          request.input('query', sql.NVarChar, `%${rawQuery}%`);
          conditions.push('(ean LIKE @query OR title LIKE @query OR brand LIKE @query)');
        }
        if (rawCategory) {
          request.input('category', sql.NVarChar, rawCategory);
          conditions.push('category = @category');
        }
        return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      };

      const previewWhereClause = [
        parsed.data.inStock === 'true' ? 'in_stock = 1' : '',
        parsed.data.hasImage === 'true' ? 'has_image = 1' : '',
      ].filter(Boolean).join(' AND ');
      const previewWhereSql = previewWhereClause ? `WHERE ${previewWhereClause}` : '';

      const filteredCte = (whereClause: string) => `
        filtered_products AS (
          SELECT
            ean, title,
            CASE WHEN NULLIF(LTRIM(RTRIM(brand)), '') IS NULL THEN 'Unknown brand'
                 ELSE UPPER(LTRIM(RTRIM(brand))) END AS brand,
            category, main_image AS image, has_image, synced_at AS updated_at,
            ${m.grade}       AS margin_grade,
            ${m.inStock}     AS in_stock,
            ${m.competitors} AS competitor_count,
            ${m.price}       AS market_price,
            ${m.currency}    AS market_currency,
            ${m.url}         AS market_url
          FROM dbo.showcase_product
          ${whereClause}
        )`;

      // Count eligible products + brands.
      const countRequest = pool.request();
      countRequest.input('minBrandProducts', sql.Int, minBrandProducts);
      const countWhere = buildBaseFiltered(countRequest);
      const countResult = await countRequest.query(`
        WITH ${filteredCte(countWhere)},
        graded AS ( SELECT * FROM filtered_products ${gradeWhereClause} ),
        preview AS ( SELECT * FROM graded ${previewWhereSql} ),
        quality_brand_counts AS (
          SELECT brand, COUNT(*) AS quality_product_count
          FROM preview
          WHERE has_image = 1 AND margin_grade IN ('A', 'B', 'C', 'D')
          GROUP BY brand
        ),
        eligible_brands AS (
          SELECT p.brand
          FROM preview p
          INNER JOIN quality_brand_counts qbc ON qbc.brand = p.brand
          GROUP BY p.brand, qbc.quality_product_count
          HAVING COUNT(*) >= @minBrandProducts AND qbc.quality_product_count >= @minBrandProducts
        )
        SELECT COUNT(*) AS totalProducts, COUNT(DISTINCT p.brand) AS totalBrands
        FROM preview p INNER JOIN eligible_brands eb ON eb.brand = p.brand
      `);
      const totalProducts = countResult.recordset[0]?.totalProducts ?? 0;
      const totalBrands = countResult.recordset[0]?.totalBrands ?? 0;

      // Data: rank items per brand, page brands, take perBrandLimit per brand.
      const dataRequest = pool.request();
      dataRequest.input('brandOffset', sql.Int, brandOffset);
      dataRequest.input('brandLimit', sql.Int, brandLimit);
      dataRequest.input('perBrandLimit', sql.Int, perBrandLimit);
      dataRequest.input('minBrandProducts', sql.Int, minBrandProducts);
      const dataWhere = buildBaseFiltered(dataRequest);
      const dataResult = await dataRequest.query(`
        WITH ${filteredCte(dataWhere)},
        graded AS ( SELECT * FROM filtered_products ${gradeWhereClause} ),
        brand_totals AS (
          SELECT brand, COUNT(*) AS brand_total_count
          FROM graded
          GROUP BY brand
        ),
        preview AS ( SELECT * FROM graded ${previewWhereSql} ),
        quality_brand_counts AS (
          SELECT brand, COUNT(*) AS quality_product_count
          FROM preview
          WHERE has_image = 1 AND margin_grade IN ('A', 'B', 'C', 'D')
          GROUP BY brand
        ),
        ranked AS (
          SELECT p.*,
            ROW_NUMBER() OVER (
              PARTITION BY p.brand
              ORDER BY
                CASE WHEN p.margin_grade IN ('E', 'F') THEN 1 ELSE 0 END ASC,
                p.updated_at DESC,
                p.ean ASC
            ) AS brand_item_rank,
            MAX(p.updated_at) OVER (PARTITION BY p.brand) AS brand_latest_added,
            COUNT(*) OVER (PARTITION BY p.brand) AS brand_preview_count
          FROM preview p
        ),
        ranked_brands AS (
          SELECT DISTINCT r.brand, r.brand_latest_added, r.brand_preview_count,
            DENSE_RANK() OVER (ORDER BY r.brand_latest_added DESC, r.brand ASC) AS brand_rank
          FROM ranked r
          INNER JOIN quality_brand_counts qbc ON qbc.brand = r.brand
          WHERE r.brand_preview_count >= @minBrandProducts
            AND qbc.quality_product_count >= @minBrandProducts
        ),
        selected_brands AS (
          SELECT rb.brand, rb.brand_latest_added, bt.brand_total_count
          FROM ranked_brands rb
          INNER JOIN brand_totals bt ON bt.brand = rb.brand
          WHERE rb.brand_rank > @brandOffset AND rb.brand_rank <= (@brandOffset + @brandLimit)
        )
        SELECT
          r.ean, r.title, r.brand, r.category, r.image, r.has_image, r.updated_at,
          r.margin_grade, r.in_stock, r.competitor_count, r.market_price, r.market_currency, r.market_url,
          sb.brand_latest_added, sb.brand_total_count
        FROM ranked r
        INNER JOIN selected_brands sb ON sb.brand = r.brand
        WHERE r.brand_item_rank <= @perBrandLimit
        ORDER BY sb.brand_latest_added DESC, r.brand ASC, r.brand_item_rank ASC
      `);

      const grouped = new Map<string, { brand: string; latestUpdatedAt: string | null; totalProducts: number; items: PublicProduct[] }>();
      for (const row of dataResult.recordset as Array<ShowcaseRow & { brand_latest_added: Date | null; brand_total_count: number | null }>) {
        const brand = row.brand || 'Unknown brand';
        if (!grouped.has(brand)) {
          grouped.set(brand, {
            brand,
            latestUpdatedAt: row.brand_latest_added ? new Date(row.brand_latest_added).toISOString() : null,
            totalProducts: row.brand_total_count ?? 0,
            items: [],
          });
        }
        grouped.get(brand)?.items.push(mapRow(row));
      }

      const brands = [...grouped.values()];
      const payload: BrandClusterResponsePayload = { brands, totalBrands, totalProducts, count: brands.length };
      setCachedBrandClusters(cacheKey, payload);
      res.json(payload);
    } catch (err) {
      console.error('Error fetching brand clusters', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/public/products/:ean ─────────────────────────────────────────────
  app.get('/api/public/products/:ean', async (req, res) => {
    const ean = (req.params.ean || '').trim();
    if (!ean) {
      res.status(400).json({ error: 'Missing ean' });
      return;
    }
    const parsed = eanParamSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const market = (parsed.data.market ?? 'dk') as Market;
    const m = marketColumns(market);

    try {
      const pool = await getPool();
      const request = pool.request();
      request.input('ean', sql.VarChar, ean);
      const result = await request.query(`
        SELECT ${productSelectColumns(m)}
        FROM dbo.showcase_product
        WHERE ean = @ean
      `);
      const row = result.recordset[0] as ShowcaseRow | undefined;
      if (!row) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      res.json({ product: mapRow(row) });
    } catch (err) {
      console.error('Error fetching product', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/public/categories ────────────────────────────────────────────────
  app.get('/api/public/categories', async (req, res) => {
    const parsed = categoriesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const market = (parsed.data.market ?? 'dk') as Market;
    const m = marketColumns(market);

    try {
      const pool = await getPool();
      const categoryConditions = [`category IS NOT NULL AND LTRIM(RTRIM(category)) <> ''`];
      const brandConditions: string[] = [];
      if (parsed.data.inStock === 'true') {
        categoryConditions.push(`${m.inStock} = 1`);
        brandConditions.push(`${m.inStock} = 1`);
      }
      if (parsed.data.hasImage === 'true') {
        categoryConditions.push('has_image = 1');
        brandConditions.push('has_image = 1');
      }
      brandConditions.push("brand IS NOT NULL AND LTRIM(RTRIM(brand)) <> ''");

      const categoryWhereClause = `WHERE ${categoryConditions.join(' AND ')}`;
      const brandWhereClause = `WHERE ${brandConditions.join(' AND ')}`;

      const [categoryResult, brandResult] = await Promise.all([
        pool.request().query(`
          SELECT category, COUNT(*) AS product_count
          FROM dbo.showcase_product ${categoryWhereClause}
          GROUP BY category ORDER BY product_count DESC
        `),
        pool.request().query(`
          SELECT
            COALESCE(NULLIF(LTRIM(RTRIM(category)), ''), '__UNCATEGORIZED__') AS category,
            UPPER(LTRIM(RTRIM(brand))) AS brand
          FROM dbo.showcase_product ${brandWhereClause}
          GROUP BY COALESCE(NULLIF(LTRIM(RTRIM(category)), ''), '__UNCATEGORIZED__'), UPPER(LTRIM(RTRIM(brand)))
        `),
      ]);

      const categories = (categoryResult.recordset as CategoryRow[]).map((row) => ({
        name: row.category,
        count: row.product_count,
      }));
      const brandsByCategory: Record<string, string[]> = {};
      for (const row of brandResult.recordset as BrandByCategoryRow[]) {
        if (!brandsByCategory[row.category]) brandsByCategory[row.category] = [];
        brandsByCategory[row.category].push(row.brand);
      }
      for (const key of Object.keys(brandsByCategory)) {
        brandsByCategory[key].sort((a, b) => a.localeCompare(b));
      }

      res.json({ categories, brandsByCategory, generatedAt: new Date().toISOString(), source: 'sql' });
    } catch (err) {
      console.error('Error fetching categories', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/public/suggest ──────────────────────────────────────────────────
  app.get('/api/public/suggest', async (req, res) => {
    const parsed = suggestQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const queryText = normalizeQueryToken(parsed.data.q || '');
    if (queryText.length < 2) {
      res.json({ query: queryText, suggestions: [] });
      return;
    }

    const limit = parsed.data.limit ?? 10;
    const market = (parsed.data.market ?? 'dk') as Market;
    const m = marketColumns(market);
    const requestedTypes = splitCsv(parsed.data.types)
      .map((item) => item.toLowerCase())
      .filter((item): item is SuggestionType => item === 'brand' || item === 'category' || item === 'keyword' || item === 'ean');
    const allowedTypes = new Set<SuggestionType>(requestedTypes.length > 0
      ? requestedTypes
      : ['brand', 'category', 'keyword', 'ean']);
    const cacheKey = JSON.stringify({
      q: queryText.toUpperCase(),
      market,
      inStock: parsed.data.inStock ?? 'false',
      hasImage: parsed.data.hasImage ?? 'false',
      limit,
      types: [...allowedTypes].sort().join(','),
    });
    const cached = getCachedSuggestions(cacheKey);
    if (cached) {
      res.json({ query: queryText, suggestions: cached });
      return;
    }

    try {
      const pool = await getPool();
      const normalizedUpper = queryText.toUpperCase();
      const prefixUpper = `${normalizedUpper}%`;
      const containsUpper = `%${normalizedUpper}%`;
      const prefixExact = `${queryText}%`;
      const eachLimit = Math.max(3, Math.min(8, limit));

      const buildBaseWhere = () => {
        const conditions: string[] = ['1=1'];
        if (parsed.data.inStock === 'true') conditions.push(`${m.inStock} = 1`);
        if (parsed.data.hasImage === 'true') conditions.push('has_image = 1');
        return conditions;
      };
      const baseConditions = buildBaseWhere();
      const baseWhere = `WHERE ${baseConditions.join(' AND ')}`;

      const brandRequest = pool.request();
      brandRequest.input('containsUpper', sql.NVarChar, containsUpper);
      brandRequest.input('prefixUpper', sql.NVarChar, prefixUpper);
      brandRequest.input('brandLimit', sql.Int, eachLimit);

      const categoryRequest = pool.request();
      categoryRequest.input('containsUpper', sql.NVarChar, containsUpper);
      categoryRequest.input('prefixUpper', sql.NVarChar, prefixUpper);
      categoryRequest.input('categoryLimit', sql.Int, eachLimit);

      const keywordRequest = pool.request();
      keywordRequest.input('containsUpper', sql.NVarChar, containsUpper);
      keywordRequest.input('prefixUpper', sql.NVarChar, prefixUpper);
      keywordRequest.input('keywordLimit', sql.Int, eachLimit);

      const eanRequest = pool.request();
      eanRequest.input('prefixExact', sql.VarChar, prefixExact);
      eanRequest.input('eanLimit', sql.Int, Math.max(2, Math.min(5, limit)));

      const brandPromise = allowedTypes.has('brand')
        ? brandRequest.query(`
          SELECT TOP (@brandLimit) value
          FROM (
            SELECT DISTINCT
              UPPER(LTRIM(RTRIM(brand))) AS value,
              CASE WHEN UPPER(LTRIM(RTRIM(brand))) LIKE @prefixUpper THEN 0 ELSE 1 END AS prefix_order
            FROM dbo.showcase_product
            ${baseWhere}
              AND brand IS NOT NULL
              AND LTRIM(RTRIM(brand)) <> ''
              AND UPPER(LTRIM(RTRIM(brand))) LIKE @prefixUpper
          ) AS s
          ORDER BY s.prefix_order ASC, LEN(s.value) ASC, s.value ASC
        `)
        : Promise.resolve({ recordset: [] as Array<{ value: string }> });

      const categoryPromise = allowedTypes.has('category')
        ? categoryRequest.query(`
          SELECT TOP (@categoryLimit) value
          FROM (
            SELECT DISTINCT
              LTRIM(RTRIM(category)) AS value,
              CASE WHEN UPPER(LTRIM(RTRIM(category))) LIKE @prefixUpper THEN 0 ELSE 1 END AS prefix_order
            FROM dbo.showcase_product
            ${baseWhere}
              AND category IS NOT NULL
              AND LTRIM(RTRIM(category)) <> ''
              AND UPPER(LTRIM(RTRIM(category))) LIKE @prefixUpper
          ) AS s
          ORDER BY s.prefix_order ASC, LEN(s.value) ASC, s.value ASC
        `)
        : Promise.resolve({ recordset: [] as Array<{ value: string }> });

      const keywordPromise = allowedTypes.has('keyword')
        ? keywordRequest.query(`
          SELECT TOP (@keywordLimit) value
          FROM (
            SELECT DISTINCT
              LTRIM(RTRIM(title)) AS value,
              CASE WHEN UPPER(LTRIM(RTRIM(title))) LIKE @prefixUpper THEN 0 ELSE 1 END AS prefix_order
            FROM dbo.showcase_product
            ${baseWhere}
              AND title IS NOT NULL
              AND LTRIM(RTRIM(title)) <> ''
              AND UPPER(LTRIM(RTRIM(title))) LIKE @prefixUpper
          ) AS s
          ORDER BY s.prefix_order ASC, LEN(s.value) ASC, s.value ASC
        `)
        : Promise.resolve({ recordset: [] as Array<{ value: string }> });

      const eanPromise = allowedTypes.has('ean')
        ? eanRequest.query(`
          SELECT TOP (@eanLimit)
            ean AS value
          FROM dbo.showcase_product
          ${baseWhere}
            AND ean LIKE @prefixExact
          ORDER BY ean ASC
        `)
        : Promise.resolve({ recordset: [] as Array<{ value: string }> });

      const [brandResult, categoryResult, keywordResult, eanResult] = await Promise.all([
        brandPromise,
        categoryPromise,
        keywordPromise,
        eanPromise,
      ]);

      const scored: Array<SuggestionItem & { score: number }> = [];
      for (const row of brandResult.recordset as Array<{ value: string }>) {
        const value = (row.value || '').trim();
        if (!value) continue;
        const startsWith = value.toUpperCase().startsWith(normalizedUpper);
        scored.push({ type: 'brand', value, label: value, hitCount: 0, score: startsWith ? 120 : 100 });
      }
      for (const row of categoryResult.recordset as Array<{ value: string }>) {
        const value = (row.value || '').trim();
        if (!value) continue;
        const startsWith = value.toUpperCase().startsWith(normalizedUpper);
        scored.push({ type: 'category', value, label: value, hitCount: 0, score: startsWith ? 112 : 92 });
      }
      for (const row of keywordResult.recordset as Array<{ value: string }>) {
        const value = (row.value || '').trim();
        if (!value) continue;
        const startsWith = value.toUpperCase().startsWith(normalizedUpper);
        scored.push({ type: 'keyword', value, label: value, hitCount: 0, score: startsWith ? 86 : 78 });
      }
      for (const row of eanResult.recordset as Array<{ value: string }>) {
        const value = (row.value || '').trim();
        if (!value) continue;
        scored.push({ type: 'ean', value, label: value, hitCount: 0, score: 130 });
      }

      const seen = new Set<string>();
      const suggestions = scored
        .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
        .filter((item) => {
          const key = `${item.type}:${item.value.toUpperCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, limit)
        .map(({ score: _score, ...item }) => item);

      setCachedSuggestions(cacheKey, suggestions);
      res.json({ query: queryText, suggestions });
    } catch (err) {
      console.error('Error fetching suggestions', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── POST /api/public/opportunity-scan ───────────────────────────────────────────
  app.post('/api/public/opportunity-scan', async (req, res) => {
    const parsed = opportunityScanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: 'INVALID_URL', error: 'Enter a valid webshop URL.' });
      return;
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const retryAfter = enforceOpportunityRateLimit(ip, 'scan');
    if (retryAfter) {
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ code: 'RATE_LIMITED', error: 'Too many scan requests. Please try again shortly.' });
      return;
    }

    console.info('[OpportunityFinder] scan requested');
    let scanCompleted = false;
    try {
      const inferredSignals = await scanShop(parsed.data.url);
      const signals = {
        ...inferredSignals,
        market: parsed.data.market as Market,
        marketConfidence: 'high' as const,
      };
      scanCompleted = true;
      const pool = await getPool();
      const categoryResult = await pool.request().query<{ category: string }>(`
        SELECT DISTINCT LTRIM(RTRIM(category)) AS category
        FROM dbo.showcase_product
        WHERE category IS NOT NULL AND LTRIM(RTRIM(category)) <> ''
        ORDER BY LTRIM(RTRIM(category)) ASC
      `);
      const catalogCategories = categoryResult.recordset.map((row) => row.category);
      const primaryCategoryMatches = matchCategories(signals.categories, catalogCategories);
      const secondaryCategoryMatches = matchCategories(signals.categories, catalogCategories, 0.25, 24)
        .filter((match) => !primaryCategoryMatches.some((primary) => primary.catalogCategory === match.catalogCategory));
      const orderedCategoryMatches = [...primaryCategoryMatches, ...secondaryCategoryMatches];
      const market = signals.market as Market;
      const columns = marketColumns(market);

      const loadCandidates = async (categoryMatches: ReturnType<typeof matchCategories>) => {
        const candidateRequest = pool.request();
        const conditions = [
          'title IS NOT NULL',
          "LTRIM(RTRIM(title)) <> ''",
          'has_image = 1',
          `${columns.inStock} = 1`,
          `${columns.grade} IN ('A', 'B', 'C')`,
        ];
        if (categoryMatches.length > 0) {
          const placeholders = categoryMatches.map((match, index) => {
            const name = `opportunityCategory${index}`;
            candidateRequest.input(name, sql.NVarChar(500), match.catalogCategory);
            return `@${name}`;
          });
          conditions.push(`category IN (${placeholders.join(', ')})`);
        }
        const candidateResult = await candidateRequest.query<ShowcaseRow>(`
          SELECT TOP (240) ${productSelectColumns(columns)}
          FROM dbo.showcase_product
          WHERE ${conditions.join(' AND ')}
          ORDER BY CASE WHEN ${columns.inStock} = 1 THEN 0 ELSE 1 END, ean ASC
        `);
        return candidateResult.recordset.map(mapRow).map(({ updatedAt: _updatedAt, ...product }) => product);
      };

      const categoryMatches: ReturnType<typeof matchCategories> = [];
      let opportunities: ReturnType<typeof rankOpportunities> = [];
      for (const categoryMatch of orderedCategoryMatches) {
        if (opportunities.length >= MAX_STORED_OPPORTUNITIES) break;
        const categoryOpportunities = rankOpportunities(await loadCandidates([categoryMatch]), signals, [categoryMatch]);
        const hadInitialPage = opportunities.length >= OPPORTUNITY_PAGE_SIZE;
        opportunities = combineCategoryOpportunities(
          opportunities,
          categoryOpportunities,
          MAX_STORED_OPPORTUNITIES,
          MAX_STORED_OPPORTUNITIES,
        );
        if (!hadInitialPage) categoryMatches.push(categoryMatch);
      }
      opportunities = diversifyOpportunities(opportunities, MAX_STORED_OPPORTUNITIES);
      const stored = storeScan(signals, opportunities, categoryMatches);
      const initialOpportunities = opportunities.slice(0, OPPORTUNITY_PAGE_SIZE);
      console.info('[OpportunityFinder] scan completed', {
        domain: signals.domain,
        pagesScanned: signals.pagesScanned,
        opportunities: opportunities.length,
        partial: signals.warnings.length > 0,
      });
      res.json({
        scanId: stored.id,
        shop: { url: signals.url, domain: signals.domain },
        market: { code: signals.market.toUpperCase(), confidence: signals.marketConfidence },
        detectedCategories: categoryMatches,
        detectedBrands: signals.brands,
        detectedEanCount: signals.eans.length,
        coverage: { pagesScanned: signals.pagesScanned, isPartial: signals.warnings.length > 0, warnings: signals.warnings },
        opportunities: initialOpportunities,
        hasMore: opportunities.length > initialOpportunities.length,
      });
    } catch (error) {
      const known = error instanceof OpportunityError ? error : null;
      const code = known?.code ?? (scanCompleted ? 'CATALOG_UNAVAILABLE' : 'SCAN_FAILED');
      const message = known?.message ?? (scanCompleted
        ? 'The opportunity catalogue is temporarily unavailable. Please try again shortly.'
        : 'The webshop could not be scanned. Please try again.');
      console.warn('[OpportunityFinder] scan failed', { code });
      const status = code === 'INVALID_URL' || code === 'UNSAFE_URL' ? 400 : code === 'SCAN_BLOCKED' ? 422 : code === 'CATALOG_UNAVAILABLE' ? 503 : 502;
      res.status(status).json({ code, error: message });
    }
  });

  // ── GET /api/public/opportunity-scan/:scanId/result ───────────────────────────
  app.get('/api/public/opportunity-scan/:scanId/result', (req, res) => {
    const stored = findScan(req.params.scanId);
    if (!stored) {
      res.status(404).json({ code: 'SCAN_EXPIRED', error: 'This shared scan has expired. Please scan the webshop again.' });
      return;
    }

    const initialOpportunities = stored.opportunities.slice(0, OPPORTUNITY_PAGE_SIZE);
    res.json({
      scanId: stored.id,
      shop: { url: stored.url, domain: stored.domain },
      market: { code: stored.market.toUpperCase(), confidence: stored.marketConfidence },
      detectedCategories: stored.categoryMatches,
      detectedBrands: stored.brands,
      detectedEanCount: stored.eans.length,
      coverage: { pagesScanned: stored.pagesScanned, isPartial: stored.warnings.length > 0, warnings: stored.warnings },
      opportunities: initialOpportunities,
      hasMore: stored.opportunities.length > initialOpportunities.length,
    });
  });

  // ── GET /api/public/opportunity-scan/:scanId ─────────────────────────────────
  app.get('/api/public/opportunity-scan/:scanId', (req, res) => {
    const parsed = opportunityScanPageSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ code: 'INVALID_REQUEST', error: 'The results page is invalid.' });
      return;
    }

    const stored = findScan(req.params.scanId);
    if (!stored) {
      res.status(404).json({ code: 'SCAN_EXPIRED', error: 'This scan has expired. Please scan the webshop again.' });
      return;
    }

    const opportunities = stored.opportunities.slice(parsed.data.offset, parsed.data.offset + OPPORTUNITY_PAGE_SIZE);
    res.json({
      opportunities,
      hasMore: parsed.data.offset + opportunities.length < stored.opportunities.length,
    });
  });

  // ── POST /api/public/supplier-connection ───────────────────────────────────────
  app.post('/api/public/supplier-connection', async (req, res) => {
    const parsed = supplierConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: 'INVALID_REQUEST', error: 'Complete the required contact details and consent before continuing.' });
      return;
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const retryAfter = enforceOpportunityRateLimit(ip, 'connection');
    if (retryAfter) {
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ code: 'RATE_LIMITED', error: 'Too many connection requests. Please try again shortly.' });
      return;
    }

    const scan = findScan(parsed.data.scanId);
    const selectedEans = [...new Set(parsed.data.selectedEans.map(normalizeEan).filter((ean): ean is string => Boolean(ean)))];
    if (!scan || selectedEans.length !== parsed.data.selectedEans.length) {
      res.status(400).json({ code: 'INVALID_REQUEST', error: 'This scan has expired or the selected products are invalid. Please scan your shop again.' });
      return;
    }
    if (scan.market.toUpperCase() !== parsed.data.market) {
      res.status(400).json({ code: 'INVALID_REQUEST', error: 'The selected market does not match this scan. Please scan your shop again.' });
      return;
    }
    if (!selectedEans.every((ean) => scan.opportunityEans.includes(ean))) {
      res.status(400).json({ code: 'INVALID_REQUEST', error: 'Choose products from the current scan before requesting an introduction.' });
      return;
    }

    const handoffUrl = process.env.EANRUNNER_OPPORTUNITY_API_URL;
    const handoffToken = process.env.EANRUNNER_OPPORTUNITY_API_TOKEN;
    if (!handoffUrl || !handoffToken) {
      console.warn('[OpportunityFinder] private handoff unavailable');
      res.status(503).json({ code: 'HANDOFF_UNAVAILABLE', error: 'Supplier introductions are temporarily unavailable. Please try again later.' });
      return;
    }

    const idempotencyKey = createIdempotencyKey(scan.id, selectedEans, parsed.data.contact.email);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);
    console.info('[OpportunityFinder] connection request received', { scanId: scan.id, products: selectedEans.length });
    try {
      const handoff = await fetch(handoffUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${handoffToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          scanId: scan.id,
          shopUrl: scan.url,
          market: scan.market.toUpperCase(),
          selectedEans,
          contact: parsed.data.contact,
          consent: { granted: true, timestamp: new Date().toISOString() },
        }),
      });
      if (!handoff.ok && handoff.status !== 409) {
        throw new Error(`Private handoff returned ${handoff.status}`);
      }
      console.info('[OpportunityFinder] private handoff succeeded', { scanId: scan.id });
      res.status(202).json({ requestId: idempotencyKey.slice(0, 16), status: 'accepted' });
    } catch {
      console.warn('[OpportunityFinder] private handoff failed', { scanId: scan.id });
      res.status(502).json({ code: 'HANDOFF_FAILED', error: 'We could not send your introduction request. Your selected products are still available below; please try again.' });
    } finally {
      clearTimeout(timeout);
    }
  });

  // ── GET /api/public/stats ──────────────────────────────────────────────────────
  app.get('/api/public/stats', async (_req, res) => {
    try {
      const pool = await getPool();
      const configuredSupplierCount = (() => {
        const parsed = Number.parseInt(process.env.INTEGRATED_SUPPLIERS_COUNT || '15', 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 15;
      })();
      const result = await pool.request().query(`
        SELECT
          COUNT(*) AS total_products,
          SUM(CASE WHEN has_stock = 1 THEN 1 ELSE 0 END) AS in_stock_products
        FROM dbo.showcase_product
      `);
      res.json({
        totalProducts: result.recordset[0]?.total_products ?? 0,
        inStockProducts: result.recordset[0]?.in_stock_products ?? 0,
        integratedSuppliers: configuredSupplierCount,
      });
    } catch (err) {
      console.error('Error fetching catalog stats', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const server: Server = app.listen(PORT, () => {
    console.log(`WebVersion API listening on http://localhost:${PORT}`);
    void prewarmDefaultBrandClusterCache(PORT);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down WebVersion API...`);
    server.close(async () => {
      try {
        if (poolPromise) {
          const pool = await poolPromise.catch(() => null);
          await pool?.close();
        }
      } catch {
        // Ignore close errors during shutdown.
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', () => { void shutdown('SIGINT'); });
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
}

main().catch((error) => {
  console.error('Failed to bootstrap WebVersion API', error);
});
