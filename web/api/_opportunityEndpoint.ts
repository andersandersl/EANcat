import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { createIdempotencyKey, normalizeEan, OpportunityError, scanShop, matchCategories, rankOpportunities, combineCategoryOpportunities, diversifyOpportunities, type Market, type MarketConfidence, type Opportunity, type ScanSignals } from './_opportunity.js';
import { loadCatalogCandidates, loadCatalogCategories } from './_catalog.js';

export const OPPORTUNITY_PAGE_SIZE = 20;
export const MAX_STORED_OPPORTUNITIES = 20;

const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

type CategoryMatch = ReturnType<typeof matchCategories>[number];
type ScanTokenPayload = {
  v: 1 | 2;
  id: string;
  exp: number;
  url: string;
  domain: string;
  market: Market;
  marketConfidence?: MarketConfidence;
  categoryMatches?: CategoryMatch[];
  brands?: string[];
  eanCount?: number;
  pagesScanned?: number;
  warnings?: string[];
  opportunities: Opportunity[];
};

function encodeScanToken(signals: ScanSignals, opportunities: Opportunity[], categoryMatches: CategoryMatch[]): string {
  const payload: ScanTokenPayload = {
    v: 2,
    id: randomUUID(),
    exp: Date.now() + 24 * 60 * 60 * 1000,
    url: signals.url,
    domain: signals.domain,
    market: signals.market,
    marketConfidence: signals.marketConfidence,
    categoryMatches,
    brands: signals.brands,
    eanCount: signals.eans.length,
    pagesScanned: signals.pagesScanned,
    warnings: signals.warnings,
    opportunities,
  };
  const encoded = deflateRawSync(Buffer.from(JSON.stringify(payload), 'utf8')).toString('base64url');
  const signature = signScanToken(encoded);
  return signature ? `${encoded}.${signature}` : encoded;
}

function decodeScanToken(scanId: string): ScanTokenPayload | null {
  try {
    const [encoded, signature] = scanId.split('.');
    if (!encoded || !hasValidScanTokenSignature(encoded, signature)) return null;
    const encodedBuffer = Buffer.from(encoded, 'base64url');
    let json: string;
    try {
      json = inflateRawSync(encodedBuffer).toString('utf8');
    } catch {
      json = encodedBuffer.toString('utf8');
    }
    const payload = JSON.parse(json) as Partial<ScanTokenPayload>;
    if (
      ![1, 2].includes(Number(payload.v))
      || typeof payload.id !== 'string'
      || typeof payload.exp !== 'number'
      || payload.exp <= Date.now()
      || typeof payload.url !== 'string'
      || typeof payload.domain !== 'string'
      || !['dk', 'se', 'fi'].includes(String(payload.market))
      || !Array.isArray(payload.opportunities)
    ) {
      return null;
    }
    return payload as ScanTokenPayload;
  } catch {
    return null;
  }
}

function scanTokenSecret(): string | null {
  return process.env.OPPORTUNITY_SCAN_TOKEN_SECRET || process.env.RESEND_API_KEY || null;
}

function signScanToken(encodedPayload: string): string | null {
  const secret = scanTokenSecret();
  if (!secret) return null;
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function hasValidScanTokenSignature(encodedPayload: string, signature: string | undefined): boolean {
  const expected = signScanToken(encodedPayload);
  if (!expected) return true;
  if (!signature) return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function enforceOpportunityRateLimit(ip: string, scope: string): number | null {
  const now = Date.now();
  const key = `${scope}:${ip}`;
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }

  current.count += 1;
  if (current.count > RATE_LIMIT_MAX_REQUESTS) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  }
  return null;
}

export async function createOpportunityScan(url: string, selectedMarket: Market) {
  const inferredSignals = await scanShop(url);
  const signals: ScanSignals = {
    ...inferredSignals,
    market: selectedMarket,
    marketConfidence: 'high',
  };
  const market = signals.market as Market;
  const catalogCategories = await loadCatalogCategories(market);
  const primaryCategoryMatches = matchCategories(signals.categories, catalogCategories);
  const secondaryCategoryMatches = matchCategories(signals.categories, catalogCategories, 0.25, 24)
    .filter((match) => !primaryCategoryMatches.some((primary) => primary.catalogCategory === match.catalogCategory));
  const orderedCategoryMatches = [...primaryCategoryMatches, ...secondaryCategoryMatches];

  const categoryMatches: CategoryMatch[] = [];
  let opportunities: ReturnType<typeof rankOpportunities> = [];
  for (const categoryMatch of orderedCategoryMatches) {
    if (opportunities.length >= MAX_STORED_OPPORTUNITIES) break;
    const categoryOpportunities = rankOpportunities(await loadCatalogCandidates(market, categoryMatch.catalogCategory), signals, [categoryMatch]);
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
  const initialOpportunities = opportunities.slice(0, OPPORTUNITY_PAGE_SIZE);
  return {
    scanId: encodeScanToken(signals, opportunities, categoryMatches),
    shop: { url: signals.url, domain: signals.domain },
    market: { code: signals.market.toUpperCase(), confidence: signals.marketConfidence },
    detectedCategories: categoryMatches,
    detectedBrands: signals.brands,
    detectedEanCount: signals.eans.length,
    coverage: { pagesScanned: signals.pagesScanned, isPartial: signals.warnings.length > 0, warnings: signals.warnings },
    opportunities: initialOpportunities,
    hasMore: opportunities.length > initialOpportunities.length,
  };
}

export function getOpportunityResult(scanId: string) {
  const stored = decodeScanToken(scanId);
  if (!stored) return null;
  const initialOpportunities = stored.opportunities.slice(0, OPPORTUNITY_PAGE_SIZE);
  const warnings = stored.warnings ?? [];
  return {
    scanId,
    shop: { url: stored.url, domain: stored.domain },
    market: { code: stored.market.toUpperCase(), confidence: stored.marketConfidence ?? 'high' },
    detectedCategories: stored.categoryMatches ?? [],
    detectedBrands: stored.brands ?? [],
    detectedEanCount: stored.eanCount ?? 0,
    coverage: { pagesScanned: stored.pagesScanned ?? 0, isPartial: warnings.length > 0, warnings },
    opportunities: initialOpportunities,
    hasMore: stored.opportunities.length > initialOpportunities.length,
  };
}

export function getOpportunityPage(scanId: string, offset: number) {
  const stored = decodeScanToken(scanId);
  if (!stored) return null;
  const opportunities = stored.opportunities.slice(offset, offset + OPPORTUNITY_PAGE_SIZE);
  return {
    opportunities,
    hasMore: offset + opportunities.length < stored.opportunities.length,
  };
}

export function mapOpportunityError(error: unknown, scanCompleted = false): { status: number; code: string; message: string } {
  const known = error instanceof OpportunityError ? error : null;
  const code = known?.code ?? (scanCompleted ? 'CATALOG_UNAVAILABLE' : 'SCAN_FAILED');
  const message = known?.message ?? (scanCompleted
    ? 'The opportunity catalogue is temporarily unavailable. Please try again shortly.'
    : 'The webshop could not be scanned. Please try again.');
  const status = code === 'INVALID_URL' || code === 'UNSAFE_URL' ? 400 : code === 'SCAN_BLOCKED' ? 422 : code === 'CATALOG_UNAVAILABLE' ? 503 : 502;
  return { status, code, message };
}

export function validateConnectionSelection(payload: {
  scanId: string;
  market?: string;
  selectedEans: string[];
}) {
  const scan = decodeScanToken(payload.scanId);
  const selectedEans = [...new Set(payload.selectedEans.map(normalizeEan).filter((ean): ean is string => Boolean(ean)))];
  if (!scan || selectedEans.length !== payload.selectedEans.length) {
    return { error: 'This scan has expired or the selected products are invalid. Please scan your shop again.' };
  }
  if (payload.market && scan.market.toUpperCase() !== payload.market) {
    return { error: 'The selected market does not match this scan. Please scan your shop again.' };
  }
  const opportunityEans = scan.opportunities.map((opportunity) => opportunity.ean);
  if (!selectedEans.every((ean) => opportunityEans.includes(ean))) {
    return { error: 'Choose products from the current scan before requesting an introduction.' };
  }
  return { scan, selectedEans };
}

export { createIdempotencyKey };
