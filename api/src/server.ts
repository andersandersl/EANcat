import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import type { Server } from 'node:http';
import sql from 'mssql';
import { z } from 'zod';

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
const BRAND_CLUSTER_CACHE_TTL_MS = Number.parseInt(process.env.BRAND_CLUSTER_CACHE_TTL_MS || String(10 * 60 * 1000), 10);
const BRAND_CLUSTER_CACHE_MAX_ENTRIES = Number.parseInt(process.env.BRAND_CLUSTER_CACHE_MAX_ENTRIES || '200', 10);

// Connects to the ISOLATED public showcase DB (eanrunner-catalog-db), NOT
// production. This API only ever reads the flat, public-safe dbo.showcase_product
// table — it has no path to supplier names, cost prices, or margin percentages.
const sqlConfig: sql.config = {
  server: process.env.SQL_SERVER || 'eanrunner-catalog-sql.database.windows.net',
  database: process.env.SQL_DATABASE || 'eanrunner-catalog-db',
  user: process.env.SQL_USER || '',
  password: process.env.SQL_PASSWORD || '',
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

function sqlEnvSummary(): {
  server: string;
  database: string;
  userConfigured: boolean;
  passwordConfigured: boolean;
} {
  return {
    server: sqlConfig.server || '',
    database: sqlConfig.database || '',
    userConfigured: Boolean(sqlConfig.user),
    passwordConfigured: Boolean(sqlConfig.password),
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

const eanParamSchema = z.object({ market: z.enum(['dk', 'se', 'fi']).optional() });

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
    const params = new URLSearchParams({
      market: 'dk',
      brandOffset: '0',
      brandLimit: '10',
      perBrandLimit: '9',
      minBrandProducts: '9',
      inStock: 'true',
      hasImage: 'true',
    });
    const response = await fetch(`http://localhost:${port}/api/public/brand-clusters?${params.toString()}`);
    if (!response.ok) {
      console.warn(`[BrandCluster prewarm] Failed: HTTP ${response.status}`);
      return;
    }
    console.log('[BrandCluster prewarm] Default homepage cluster cache warmed');
  } catch (error) {
    console.warn('[BrandCluster prewarm] Failed to warm cache:', error);
  }
}

// ── App ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const app = express();

  const envSummary = sqlEnvSummary();
  if (!envSummary.userConfigured || !envSummary.passwordConfigured) {
    console.warn('SQL configuration is incomplete', envSummary);
  }
  if (process.env.NODE_ENV === 'production' && WEB_ORIGINS.some((origin) => origin.includes('localhost'))) {
    console.warn('CORS is configured with localhost origins in production', { WEB_ORIGINS });
  }

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

    const rawQuery = normalizeQueryToken(parsed.data.query || '');
    const categoryValues = splitCsv(parsed.data.category);
    const brandValues = splitCsv(parsed.data.brand);
    const activeGrades = activeGradesFrom(parsed.data.grades);

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
        return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      };

      const dataRequest = pool.request();
      dataRequest.input('limit', sql.Int, limit);
      dataRequest.input('offset', sql.Int, offset);
      const whereClause = buildWhere(dataRequest);

      const countRequest = pool.request();
      buildWhere(countRequest); // rebind same params on the count request

      const [dataResult, countResult] = await Promise.all([
        dataRequest.query(`
          SELECT ${productSelectColumns(m)}
          FROM dbo.showcase_product
          ${whereClause}
          ORDER BY ${m.competitors} DESC,
                   CASE WHEN ${m.grade} = 'N/A' THEN 1 ELSE 0 END,
                   synced_at DESC, ean ASC
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `),
        countRequest.query(`SELECT COUNT(*) AS total FROM dbo.showcase_product ${whereClause}`),
      ]);

      const products = (dataResult.recordset as ShowcaseRow[]).map(mapRow);
      res.json({ products, count: products.length, total: countResult.recordset[0]?.total ?? 0 });
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

      // filtered_products is the public-safe row set; everything downstream
      // (ranking, brand selection) operates on these rows.
      const buildFiltered = (request: sql.Request): string => {
        const conditions: string[] = [];
        if (rawQuery) {
          request.input('query', sql.NVarChar, `%${rawQuery}%`);
          conditions.push('(ean LIKE @query OR title LIKE @query OR brand LIKE @query)');
        }
        if (rawCategory) {
          request.input('category', sql.NVarChar, rawCategory);
          conditions.push('category = @category');
        }
        if (parsed.data.inStock === 'true') conditions.push(`${m.inStock} = 1`);
        if (parsed.data.hasImage === 'true') conditions.push('has_image = 1');
        return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      };

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
      const countWhere = buildFiltered(countRequest);
      const countResult = await countRequest.query(`
        WITH ${filteredCte(countWhere)},
        graded AS ( SELECT * FROM filtered_products ${gradeWhereClause} ),
        eligible_brands AS (
          SELECT brand FROM graded GROUP BY brand HAVING COUNT(*) >= @minBrandProducts
        )
        SELECT COUNT(*) AS totalProducts, COUNT(DISTINCT g.brand) AS totalBrands
        FROM graded g INNER JOIN eligible_brands eb ON eb.brand = g.brand
      `);
      const totalProducts = countResult.recordset[0]?.totalProducts ?? 0;
      const totalBrands = countResult.recordset[0]?.totalBrands ?? 0;

      // Data: rank items per brand, page brands, take perBrandLimit per brand.
      const dataRequest = pool.request();
      dataRequest.input('brandOffset', sql.Int, brandOffset);
      dataRequest.input('brandLimit', sql.Int, brandLimit);
      dataRequest.input('perBrandLimit', sql.Int, perBrandLimit);
      dataRequest.input('minBrandProducts', sql.Int, minBrandProducts);
      const dataWhere = buildFiltered(dataRequest);
      const dataResult = await dataRequest.query(`
        WITH ${filteredCte(dataWhere)},
        graded AS ( SELECT * FROM filtered_products ${gradeWhereClause} ),
        ranked AS (
          SELECT g.*,
            ROW_NUMBER() OVER (PARTITION BY g.brand ORDER BY g.updated_at DESC, g.ean ASC) AS brand_item_rank,
            MAX(g.updated_at) OVER (PARTITION BY g.brand) AS brand_latest_added,
            COUNT(*) OVER (PARTITION BY g.brand) AS brand_product_count
          FROM graded g
        ),
        ranked_brands AS (
          SELECT DISTINCT r.brand, r.brand_latest_added, r.brand_product_count,
            DENSE_RANK() OVER (ORDER BY r.brand_latest_added DESC, r.brand ASC) AS brand_rank
          FROM ranked r
          WHERE r.brand_product_count >= @minBrandProducts
        ),
        selected_brands AS (
          SELECT rb.brand, rb.brand_latest_added, rb.brand_product_count
          FROM ranked_brands rb
          WHERE rb.brand_rank > @brandOffset AND rb.brand_rank <= (@brandOffset + @brandLimit)
        )
        SELECT
          r.ean, r.title, r.brand, r.category, r.image, r.has_image, r.updated_at,
          r.margin_grade, r.in_stock, r.competitor_count, r.market_price, r.market_currency, r.market_url,
          sb.brand_latest_added, sb.brand_product_count
        FROM ranked r
        INNER JOIN selected_brands sb ON sb.brand = r.brand
        WHERE r.brand_item_rank <= @perBrandLimit
        ORDER BY sb.brand_latest_added DESC, r.brand ASC, r.brand_item_rank ASC
      `);

      const grouped = new Map<string, { brand: string; latestUpdatedAt: string | null; totalProducts: number; items: PublicProduct[] }>();
      for (const row of dataResult.recordset as Array<ShowcaseRow & { brand_latest_added: Date | null; brand_product_count: number | null }>) {
        const brand = row.brand || 'Unknown brand';
        if (!grouped.has(brand)) {
          grouped.set(brand, {
            brand,
            latestUpdatedAt: row.brand_latest_added ? new Date(row.brand_latest_added).toISOString() : null,
            totalProducts: row.brand_product_count ?? 0,
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
      const conditions = [`category IS NOT NULL AND LTRIM(RTRIM(category)) <> ''`];
      if (parsed.data.inStock === 'true') conditions.push(`${m.inStock} = 1`);
      if (parsed.data.hasImage === 'true') conditions.push('has_image = 1');
      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const [categoryResult, brandResult] = await Promise.all([
        pool.request().query(`
          SELECT category, COUNT(*) AS product_count
          FROM dbo.showcase_product ${whereClause}
          GROUP BY category ORDER BY product_count DESC
        `),
        pool.request().query(`
          SELECT category, UPPER(LTRIM(RTRIM(brand))) AS brand
          FROM dbo.showcase_product ${whereClause}
            AND brand IS NOT NULL AND LTRIM(RTRIM(brand)) <> ''
          GROUP BY category, UPPER(LTRIM(RTRIM(brand)))
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

  // ── GET /api/public/stats ──────────────────────────────────────────────────────
  app.get('/api/public/stats', async (_req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT
          COUNT(*) AS total_products,
          SUM(CASE WHEN has_stock = 1 THEN 1 ELSE 0 END) AS in_stock_products
        FROM dbo.showcase_product
      `);
      res.json({
        totalProducts: result.recordset[0]?.total_products ?? 0,
        inStockProducts: result.recordset[0]?.in_stock_products ?? 0,
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
