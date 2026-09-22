import { createHash, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

export type Market = 'dk' | 'se' | 'fi';
export type MarketConfidence = 'high' | 'medium' | 'low';

export type CatalogCandidate = {
  ean: string;
  title: string;
  brand: string;
  category: string;
  image: string | null;
  stockStatus: 'in stock' | 'not in stock';
  marginGrade: string;
  competitorCount: number;
  marketPrice: number | null;
  marketCurrency: string | null;
  cheapestMarketLink: string | null;
};

export type Opportunity = CatalogCandidate & {
  reason: string;
};

export type ScanSignals = {
  url: string;
  domain: string;
  market: Market;
  marketConfidence: MarketConfidence;
  categories: string[];
  brands: string[];
  eans: string[];
  pagesScanned: number;
  warnings: string[];
};

type FetchResult = { url: URL; body: string; contentType: string };
type HtmlSignals = { categories: string[]; brands: string[]; eans: string[]; languages: string[]; currencies: string[] };

const MAX_REDIRECTS = 3;
const MAX_INITIAL_PAGE_BYTES = 5 * 1024 * 1024;
const MAX_PAGE_BYTES = 512 * 1024;
const MAX_SITEMAP_BYTES = 512 * 1024;
const MAX_PAGES = 8;
const REQUEST_TIMEOUT_MS = 7_000;
const TOTAL_SCAN_TIMEOUT_MS = 20_000;
const USER_AGENT = 'EANrunner-OpportunityFinder/1.0 (+https://eanrunner.com)';
const TEXT_CONTENT_TYPES = /^(text\/(html|plain|xml)|application\/(xml|xhtml\+xml))/i;
const GTIN_KEYS = new Set(['gtin', 'gtin8', 'gtin12', 'gtin13', 'gtin14', 'ean', 'productid', 'sku']);

export class OpportunityError extends Error {
  constructor(
    public readonly code: 'INVALID_URL' | 'UNSAFE_URL' | 'SCAN_BLOCKED' | 'SCAN_FAILED' | 'HANDOFF_UNAVAILABLE' | 'HANDOFF_FAILED',
    message: string,
  ) {
    super(message);
  }
}

export function normalizeShopUrl(raw: string): URL {
  const input = raw.trim();
  if (!input || input.length > 2048) throw new OpportunityError('INVALID_URL', 'Enter a valid webshop URL.');

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input);
  if (hasScheme && !/^https?:\/\//i.test(input)) {
    throw new OpportunityError('INVALID_URL', 'Enter a public http or https webshop URL without credentials.');
  }

  let url: URL;
  try {
    url = new URL(hasScheme ? input : `https://${input}`);
  } catch {
    throw new OpportunityError('INVALID_URL', 'Enter a valid webshop URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) {
    throw new OpportunityError('INVALID_URL', 'Enter a public http or https webshop URL without credentials.');
  }
  url.hash = '';
  return url;
}

function ipv4IsPublic(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0) return false;
  return true;
}

function ipv6IsPublic(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::' || normalized === '::1' || normalized.startsWith('fe80:') || normalized.startsWith('ff')) return false;
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('2001:db8')) return false;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return !mapped || ipv4IsPublic(mapped[1]);
}

export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return ipv4IsPublic(address);
  if (family === 6) return ipv6IsPublic(address);
  return false;
}

async function resolvePublicHost(hostname: string): Promise<{ address: string; family: 4 | 6 }> {
  if (hostname.toLowerCase() === 'localhost' || hostname.endsWith('.localhost')) {
    throw new OpportunityError('UNSAFE_URL', 'Local and private network addresses are not allowed.');
  }

  const directFamily = net.isIP(hostname);
  if (directFamily) {
    if (!isPublicAddress(hostname)) throw new OpportunityError('UNSAFE_URL', 'Local and private network addresses are not allowed.');
    return { address: hostname, family: directFamily as 4 | 6 };
  }

  let records: Array<{ address: string; family: 4 | 6 }>;
  try {
    records = await lookup(hostname, { all: true, verbatim: true }) as Array<{ address: string; family: 4 | 6 }>;
  } catch {
    throw new OpportunityError('SCAN_FAILED', 'The webshop domain could not be resolved.');
  }
  const publicRecord = records.find((record) => isPublicAddress(record.address));
  if (!publicRecord || records.some((record) => !isPublicAddress(record.address))) {
    throw new OpportunityError('UNSAFE_URL', 'The webshop domain resolves to a private or reserved address.');
  }
  return publicRecord;
}

async function fetchPinnedText(initialUrl: URL, maxBytes: number, deadline: number): Promise<FetchResult> {
  let url = initialUrl;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (Date.now() >= deadline) throw new OpportunityError('SCAN_FAILED', 'The webshop scan timed out.');
    const resolved = await resolvePublicHost(url.hostname);
    const response = await new Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
      const transport = url.protocol === 'https:' ? https : http;
      const timeout = Math.max(1, Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now()));
      const requestOptions = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,text/xml,application/xml;q=0.9,*/*;q=0.1' },
        timeout,
        lookup: (_hostname: string, _options: unknown, callback: (error: Error | null, address: string, family: number) => void) => callback(null, resolved.address, resolved.family),
      };
      (requestOptions as typeof requestOptions & { autoSelectFamily?: boolean }).autoSelectFamily = false;
      const request = transport.request(requestOptions, (incoming) => {
        const chunks: Buffer[] = [];
        let size = 0;
        incoming.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            request.destroy(new OpportunityError('SCAN_BLOCKED', 'A scanned page exceeded the size limit.'));
            return;
          }
          chunks.push(chunk);
        });
        incoming.on('end', () => resolve({ statusCode: incoming.statusCode ?? 0, headers: incoming.headers, body: Buffer.concat(chunks) }));
      });
      request.on('timeout', () => request.destroy(new OpportunityError('SCAN_FAILED', 'The webshop request timed out.')));
      request.on('error', reject);
      request.end();
    });

    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = response.headers.location;
      if (!location || redirectCount === MAX_REDIRECTS) throw new OpportunityError('SCAN_BLOCKED', 'The webshop redirected too many times.');
      try {
        url = new URL(location, url);
      } catch {
        throw new OpportunityError('SCAN_BLOCKED', 'The webshop returned an invalid redirect.');
      }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new OpportunityError('UNSAFE_URL', 'The webshop redirected to an unsafe URL.');
      }
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (response.statusCode === 401 || response.statusCode === 403) {
        throw new OpportunityError('SCAN_BLOCKED', 'This webshop blocks automated public scans. Try a webshop that permits public access.');
      }
      throw new OpportunityError('SCAN_FAILED', 'The webshop could not be scanned.');
    }
    const contentType = response.headers['content-type'] || '';
    if (!TEXT_CONTENT_TYPES.test(contentType)) throw new OpportunityError('SCAN_BLOCKED', 'The webshop returned unsupported content.');
    return { url, body: response.body.toString('utf8'), contentType };
  }
  throw new OpportunityError('SCAN_BLOCKED', 'The webshop redirected too many times.');
}

function cleanText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}

export function normalizeEan(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  return /^\d{8}(\d{4})?(\d{1,2})?$/.test(digits) && digits.length >= 8 && digits.length <= 14 ? digits : null;
}

function collectJsonLd(value: unknown, signals: HtmlSignals): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLd(item, signals));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const item = value as Record<string, unknown>;
  const type = Array.isArray(item['@type']) ? item['@type'].join(' ') : String(item['@type'] || '');
  for (const [key, raw] of Object.entries(item)) {
    if (GTIN_KEYS.has(key.toLowerCase()) && typeof raw === 'string') {
      const ean = normalizeEan(raw);
      if (ean) signals.eans.push(ean);
    }
  }
  if (/Product/i.test(type)) {
    if (typeof item.brand === 'string') signals.brands.push(item.brand);
    if (item.brand && typeof item.brand === 'object' && typeof (item.brand as Record<string, unknown>).name === 'string') signals.brands.push((item.brand as Record<string, string>).name);
    if (typeof item.category === 'string') signals.categories.push(item.category);
  }
  if (/BreadcrumbList/i.test(type) && Array.isArray(item.itemListElement)) {
    for (const crumb of item.itemListElement) {
      if (crumb && typeof crumb === 'object' && typeof (crumb as Record<string, unknown>).name === 'string') signals.categories.push((crumb as Record<string, string>).name);
    }
  }
  Object.values(item).forEach((child) => collectJsonLd(child, signals));
}

export function extractHtmlSignals(html: string): HtmlSignals {
  const signals: HtmlSignals = { categories: [], brands: [], eans: [], languages: [], currencies: [] };
  for (const script of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { collectJsonLd(JSON.parse(script[1]), signals); } catch { /* Ignore invalid third-party JSON-LD. */ }
  }
  for (const match of html.matchAll(/(?:gtin(?:-|_)?(?:8|12|13|14)?|ean)\s*["':=\s>]+\s*["']?(\d[\d\s-]{6,16}\d)/gi)) {
    const ean = normalizeEan(match[1]);
    if (ean) signals.eans.push(ean);
  }
  for (const match of html.matchAll(/<(?:meta|html)[^>]+(?:lang|content)=["']([^"']+)["']/gi)) signals.languages.push(match[1]);
  for (const match of html.matchAll(/hreflang=["']([^"']+)["']/gi)) signals.languages.push(match[1]);
  for (const match of html.matchAll(/(?:currency|priceCurrency)["':=\s>]+["']?([A-Z]{3})/gi)) signals.currencies.push(match[1]);
  for (const navigation of html.matchAll(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gi)) {
    for (const match of navigation[1].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
      const category = cleanText(match[1]);
      if (category && !/^(home|shop|menu|search)$/i.test(category)) signals.categories.push(category);
    }
  }
  for (const match of html.matchAll(/<a\b[^>]+href=["'][^"']*(?:category|categories|collection|collections|product-cat)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const category = cleanText(match[1]);
    if (category && !/^(home|shop|menu|search)$/i.test(category)) signals.categories.push(category);
  }
  return {
    categories: uniqueValues(signals.categories, 30),
    brands: uniqueValues(signals.brands, 30),
    eans: uniqueValues(signals.eans, 300),
    languages: uniqueValues(signals.languages, 10),
    currencies: uniqueValues(signals.currencies, 10),
  };
}

function uniqueValues(values: string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.replace(/\s+/g, ' ').trim();
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

export function inferMarket(url: URL, languages: string[], currencies: string[]): { market: Market; confidence: MarketConfidence } {
  const hostname = url.hostname.toLowerCase();
  if (hostname.endsWith('.dk')) return { market: 'dk', confidence: 'high' };
  if (hostname.endsWith('.se')) return { market: 'se', confidence: 'high' };
  if (hostname.endsWith('.fi')) return { market: 'fi', confidence: 'high' };
  const text = `${languages.join(' ')} ${currencies.join(' ')}`.toLowerCase();
  if (/\b(da|dk|dkk)\b/.test(text)) return { market: 'dk', confidence: 'medium' };
  if (/\b(sv|se|sek)\b/.test(text)) return { market: 'se', confidence: 'medium' };
  if (/\b(fi|fi-fi|eur)\b/.test(text)) return { market: 'fi', confidence: 'medium' };
  return { market: 'dk', confidence: 'low' };
}

function parseSitemapLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((match) => match[1]).slice(0, MAX_PAGES - 1);
}

export function isAllowedByRobots(robots: string, pathname: string): boolean {
  const rules: string[] = [];
  let applies = false;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (directive === 'user-agent') {
      applies = value === '*' || value.toLowerCase() === 'eanrunner-opportunityfinder';
    } else if (directive === 'disallow' && applies && value) {
      rules.push(value);
    }
  }
  return !rules.some((rule) => {
    const pattern = `^${rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}`;
    return new RegExp(pattern).test(pathname);
  });
}

export async function scanShop(rawUrl: string): Promise<ScanSignals> {
  const deadline = Date.now() + TOTAL_SCAN_TIMEOUT_MS;
  const initialUrl = normalizeShopUrl(rawUrl);
  const warnings: string[] = [];
  let sitemapUrl: URL | null = null;
  let robotsText: string | null = null;
  try {
    const robots = await fetchPinnedText(new URL('/robots.txt', initialUrl), 128 * 1024, deadline);
    robotsText = robots.body;
    if (!isAllowedByRobots(robots.body, initialUrl.pathname)) {
      throw new OpportunityError('SCAN_BLOCKED', 'The webshop does not allow this public scan.');
    }
    const sitemapLine = robots.body.match(/^sitemap:\s*(\S+)/im)?.[1];
    if (sitemapLine) sitemapUrl = new URL(sitemapLine, initialUrl);
  } catch (error) {
    if (error instanceof OpportunityError && error.code === 'SCAN_BLOCKED') throw error;
    warnings.push('robots.txt was unavailable; the scan used the homepage only.');
  }
  const initial = await fetchPinnedText(initialUrl, MAX_INITIAL_PAGE_BYTES, deadline);
  const aggregate = extractHtmlSignals(initial.body);
  let pagesScanned = 1;
  sitemapUrl ??= robotsText ? new URL('/sitemap.xml', initial.url) : null;

  try {
    if (!sitemapUrl) throw new OpportunityError('SCAN_BLOCKED', 'No sitemap scan is permitted.');
    const sitemap = await fetchPinnedText(sitemapUrl, MAX_SITEMAP_BYTES, deadline);
    const productUrls = parseSitemapLocations(sitemap.body)
      .map((value) => new URL(value, initial.url))
      .filter((url) => url.origin === initial.url.origin && /product|products|shop/i.test(url.pathname));
    for (const pageUrl of productUrls.slice(0, MAX_PAGES - pagesScanned)) {
      if (robotsText && !isAllowedByRobots(robotsText, pageUrl.pathname)) continue;
      try {
        const page = await fetchPinnedText(pageUrl, MAX_PAGE_BYTES, deadline);
        const signals = extractHtmlSignals(page.body);
        aggregate.categories.push(...signals.categories);
        aggregate.brands.push(...signals.brands);
        aggregate.eans.push(...signals.eans);
        aggregate.languages.push(...signals.languages);
        aggregate.currencies.push(...signals.currencies);
        pagesScanned += 1;
      } catch {
        warnings.push('Some public product pages could not be scanned.');
        break;
      }
    }
  } catch {
    warnings.push('No usable sitemap was available; results are based on limited public signals.');
  }

  const market = inferMarket(initial.url, aggregate.languages, aggregate.currencies);
  return {
    url: initial.url.toString(),
    domain: initial.url.hostname,
    market: market.market,
    marketConfidence: market.confidence,
    categories: rankDetectedCategories(aggregate.categories),
    brands: uniqueValues(aggregate.brands, 30),
    eans: uniqueValues(aggregate.eans.map((ean) => normalizeEan(ean) || '').filter(Boolean), 300),
    pagesScanned,
    warnings: uniqueValues(warnings, 5),
  };
}

const CATEGORY_ALIASES: Record<string, string> = {
  mobil: 'mobile phones',
  mobiltelefoner: 'mobile phones',
  mobiltillbehor: 'smartphone mobile phone accessories',
  mobilskal: 'phone cases',
  'laddare kablar': 'chargers cables',
  skarmskydd: 'screen protectors',
  surfplatta: 'tablets',
  surfplattetillbehor: 'tablet accessories',
  'smartklockor aktivitetsarmband': 'smartwatches fitness trackers',
  'tv tillbehor': 'television accessories',
  vaggfasten: 'wall mounts',
  hogtalare: 'speakers',
  'horlurar headset': 'headphones headsets',
  'datorer kontor': 'computers office',
  'stationara datorer': 'desktop computers',
  datorkomponenter: 'computer components',
  datorchassin: 'computer cases',
  'grafikkort gpu': 'graphics cards gpu',
  'processorer cpu': 'processors cpu',
  moderkort: 'motherboards',
};

function normalizePhrase(value: string): string {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(products?|items?|shop|collection|category|categories)\b/g, ' ').trim();
  return CATEGORY_ALIASES[normalized] ?? normalized;
}

export function rankDetectedCategories(categories: string[]): string[] {
  const ranked = new Map<string, { label: string; occurrences: number; firstSeen: number }>();
  for (const [index, category] of categories.entries()) {
    const key = normalizePhrase(category);
    if (key.length < 3 || /^(home|menu|search|account|contact)$/.test(key)) continue;
    const current = ranked.get(key);
    if (current) current.occurrences += 1;
    else ranked.set(key, { label: category, occurrences: 1, firstSeen: index });
  }
  return [...ranked.values()]
    .sort((a, b) => b.occurrences - a.occurrences || a.firstSeen - b.firstSeen)
    .slice(0, 30)
    .map((item) => item.label);
}

export function matchCategories(
  detected: string[],
  catalogCategories: string[],
  minimumConfidence = 0.5,
  maximumMatches = 8,
): Array<{ sourceLabel: string; catalogCategory: string; confidence: number }> {
  const matches = new Map<string, { sourceLabel: string; catalogCategory: string; confidence: number }>();
  const sourcePriority = new Map(detected.map((category, index) => [category, index]));
  for (const sourceLabel of detected) {
    const source = normalizePhrase(sourceLabel);
    if (source.length < 3) continue;
    for (const catalogCategory of catalogCategories) {
      const catalog = normalizePhrase(catalogCategory);
      if (!catalog) continue;
      const sourceWords = new Set(source.split(' '));
      const catalogWords = new Set(catalog.split(' '));
      const overlap = [...sourceWords].filter((word) => catalogWords.has(word)).length;
      const confidence = source === catalog ? 1 : overlap / Math.max(sourceWords.size, catalogWords.size);
      if (confidence < minimumConfidence) continue;
      const existing = matches.get(catalogCategory);
      if (!existing || existing.confidence < confidence) matches.set(catalogCategory, { sourceLabel, catalogCategory, confidence: Math.round(confidence * 100) / 100 });
    }
  }
  return [...matches.values()]
    .sort((a, b) => b.confidence - a.confidence || (sourcePriority.get(a.sourceLabel)! - sourcePriority.get(b.sourceLabel)!) || a.catalogCategory.localeCompare(b.catalogCategory))
    .slice(0, maximumMatches);
}

export function rankOpportunities(candidates: CatalogCandidate[], signals: ScanSignals, categoryMatches: Array<{ sourceLabel: string; catalogCategory: string }>): Opportunity[] {
  const existingEans = new Set(signals.eans);
  const normalizedBrands = new Set(signals.brands.map(normalizePhrase).filter(Boolean));
  const matchedCategories = new Set(categoryMatches.map((item) => item.catalogCategory));
  const graded = candidates
    .filter((candidate) => !existingEans.has(candidate.ean) && Boolean(candidate.title) && Boolean(candidate.image))
    .map((candidate) => {
      const categoryMatch = matchedCategories.has(candidate.category);
      const brandMatch = normalizedBrands.has(normalizePhrase(candidate.brand));
      const grade = candidate.marginGrade.toUpperCase();
      let score = (categoryMatch ? 50 : 0) + (brandMatch ? 12 : 0) + (candidate.stockStatus === 'in stock' ? 20 : 0);
      score += grade === 'A' ? 18 : grade === 'B' ? 12 : grade === 'C' ? 3 : 0;
      score += Math.max(0, 8 - Math.min(candidate.competitorCount, 8));
      const matchingCategory = categoryMatches.find((item) => item.catalogCategory === candidate.category);
      const reason = matchingCategory
        ? `Matches your ${matchingCategory.sourceLabel} category and is not present in the scanned assortment.`
        : brandMatch
          ? `Matches a brand detected in your webshop and is not present in the scanned assortment.`
          : 'A relevant in-stock catalogue product not present in the scanned assortment.';
      return { candidate, score, reason };
    })
    .filter((item) => item.candidate.marginGrade.toUpperCase() !== 'C' || candidates.some((candidate) => ['A', 'B'].includes(candidate.marginGrade.toUpperCase())) === false || item.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title) || a.candidate.ean.localeCompare(b.candidate.ean));

  const primary = graded.filter((item) => ['A', 'B'].includes(item.candidate.marginGrade.toUpperCase()));
  const chosen = primary.length >= 12 ? primary : graded;
  return chosen.slice(0, 24).map(({ candidate, reason }) => ({ ...candidate, reason }));
}

export function combineCategoryOpportunities(
  primary: Opportunity[],
  secondary: Opportunity[],
  targetCount = 10,
  maximumResults = 24,
): Opportunity[] {
  if (primary.length >= targetCount) return primary.slice(0, maximumResults);

  const seenEans = new Set<string>();
  return [...primary, ...secondary]
    .filter((opportunity) => !seenEans.has(opportunity.ean) && (seenEans.add(opportunity.ean), true))
    .slice(0, maximumResults);
}

export type StoredScan = ScanSignals & { id: string; expiresAt: number; opportunityEans: string[]; opportunities: Opportunity[] };
const scans = new Map<string, StoredScan>();
const SCAN_RETENTION_MS = 30 * 60 * 1000;

export function storeScan(signals: ScanSignals, opportunities: Opportunity[]): StoredScan {
  const now = Date.now();
  for (const [id, scan] of scans) if (scan.expiresAt <= now) scans.delete(id);
  while (scans.size >= 500) scans.delete(scans.keys().next().value as string);
  const stored: StoredScan = {
    ...signals,
    id: randomUUID(),
    expiresAt: now + SCAN_RETENTION_MS,
    opportunityEans: [...new Set(opportunities.map((opportunity) => opportunity.ean))],
    opportunities,
  };
  scans.set(stored.id, stored);
  return stored;
}

export function findScan(scanId: string): StoredScan | null {
  const scan = scans.get(scanId);
  if (!scan || scan.expiresAt <= Date.now()) {
    if (scan) scans.delete(scanId);
    return null;
  }
  return scan;
}

export function createIdempotencyKey(scanId: string, selectedEans: string[], email: string): string {
  return createHash('sha256').update(`${scanId}|${[...selectedEans].sort().join(',')}|${email.trim().toLowerCase()}`).digest('hex');
}
