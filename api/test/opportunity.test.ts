import assert from 'node:assert/strict';
import test from 'node:test';
import {
  combineCategoryOpportunities,
  diversifyOpportunities,
  extractHtmlSignals,
  inferMarket,
  isAllowedByRobots,
  isPublicAddress,
  matchCategories,
  normalizeEan,
  normalizeShopUrl,
  rankDetectedCategories,
  rankOpportunities,
  findScan,
  storeScan,
  type CatalogCandidate,
  type ScanSignals,
} from '../src/opportunity.js';

const signals: ScanSignals = {
  url: 'https://example.dk/',
  domain: 'example.dk',
  market: 'dk',
  marketConfidence: 'high',
  categories: ['Outdoor lighting'],
  brands: ['Northstar'],
  eans: ['5700000000001'],
  pagesScanned: 2,
  warnings: [],
};

const candidate = (overrides: Partial<CatalogCandidate>): CatalogCandidate => ({
  ean: '5700000000002',
  title: 'Outdoor lamp',
  brand: 'Northstar',
  category: 'Lighting',
  image: 'https://cdn.example/image.jpg',
  stockStatus: 'in stock',
  marginGrade: 'A',
  competitorCount: 1,
  marketPrice: 299,
  marketCurrency: 'DKK',
  cheapestMarketLink: null,
  ...overrides,
});

test('normalizes public shop URLs and rejects credentials', () => {
  assert.equal(normalizeShopUrl('example.dk').toString(), 'https://example.dk/');
  assert.throws(() => normalizeShopUrl('https://user:pass@example.dk'), /without credentials/);
  assert.throws(() => normalizeShopUrl('file:///tmp/test'), /http or https/);
});

test('rejects local, private, metadata, reserved, and IPv6 addresses', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '100.64.0.1', '203.0.113.10', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('extracts Shopify-like and WooCommerce-like public structured signals', () => {
  const html = `
    <html lang="da-DK"><head><link rel="alternate" hreflang="da-DK" href="https://shop.example.dk/">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Lamp","brand":{"name":"Northstar"},"category":"Outdoor lighting","gtin13":"5700000000001","offers":{"priceCurrency":"DKK"}}</script></head>
    <body><nav><a href="/collections/outdoor-lighting">Outdoor lighting</a></nav><a href="/products/lamp">Lamp product link</a></body></html>`;
  const parsed = extractHtmlSignals(html);
  assert.deepEqual(parsed.eans, ['5700000000001']);
  assert.ok(parsed.categories.includes('Outdoor lighting'));
  assert.equal(parsed.categories.includes('Lamp product link'), false);
  assert.deepEqual(parsed.brands, ['Northstar']);
  assert.ok(parsed.languages.includes('da-DK'));
  assert.ok(parsed.currencies.includes('DKK'));
});

test('respects applicable robots disallow rules', () => {
  const robots = `
    User-agent: *
    Disallow: /private
    Disallow: /products/hidden

    User-agent: OtherBot
    Disallow: /
  `;
  assert.equal(isAllowedByRobots(robots, '/products/lamp'), true);
  assert.equal(isAllowedByRobots(robots, '/private/wholesale'), false);
  assert.equal(isAllowedByRobots(robots, '/products/hidden'), false);
});

test('normalizes EANs and infers the market from public signals', () => {
  assert.equal(normalizeEan('5700-000-000-001'), '5700000000001');
  assert.equal(normalizeEan('abc'), null);
  assert.deepEqual(inferMarket(new URL('https://shop.example.se'), [], []), { market: 'se', confidence: 'high' });
  assert.deepEqual(inferMarket(new URL('https://shop.example.com'), ['fi-FI'], ['EUR']), { market: 'fi', confidence: 'medium' });
});

const opportunity = (ean: string) => ({ ...candidate({ ean }), reason: 'Matched category.' });

test('retains ordered opportunities and authorizes only their EANs for a scan', () => {
  const scan = storeScan(signals, [opportunity('5700000000002'), opportunity('5700000000002')]);
  assert.deepEqual(scan.opportunityEans, ['5700000000002']);
  assert.deepEqual(scan.opportunities.map((item) => item.ean), ['5700000000002', '5700000000002']);
  assert.equal(findScan(scan.id)?.opportunityEans[0], '5700000000002');
});

test('prioritizes repeatedly observed shop categories before matching', () => {
  const categories = rankDetectedCategories(['Audio', 'Home', 'Gaming', 'Audio', 'Audio', 'Gaming']);
  assert.deepEqual(categories, ['Audio', 'Gaming']);
  assert.deepEqual(
    matchCategories(categories, ['Audio equipment', 'Gaming equipment']).map((item) => item.sourceLabel),
    ['Audio', 'Gaming'],
  );
  assert.deepEqual(
    matchCategories(['Mobiltelefoner'], ['Mobile Phones']),
    [{ sourceLabel: 'Mobiltelefoner', catalogCategory: 'Mobile Phones', confidence: 1 }],
  );
});

test('maps categories, excludes detected EANs, and ranks stably', () => {
  const categories = matchCategories(signals.categories, ['Lighting', 'Garden']);
  assert.deepEqual(categories, [{ sourceLabel: 'Outdoor lighting', catalogCategory: 'Lighting', confidence: 0.5 }]);
  const results = rankOpportunities([
    candidate({ ean: '5700000000001', title: 'Existing lamp' }),
    candidate({ ean: '5700000000003', title: 'B lamp', competitorCount: 4, marginGrade: 'B' }),
    candidate({ ean: '5700000000002', title: 'A lamp', competitorCount: 1, marginGrade: 'A' }),
  ], signals, categories);
  assert.deepEqual(results.map((item) => item.ean), ['5700000000002', '5700000000003']);
  assert.match(results[0].reason, /Outdoor lighting/);
});

test('rotates brands and limits the first results to two products per brand when possible', () => {
  const opportunities = ['Alpha', 'Alpha', 'Alpha', 'Beta', 'Beta', 'Beta', 'Gamma', 'Gamma', 'Gamma', 'Delta', 'Delta', 'Delta']
    .map((brand, index) => ({ ...opportunity(`ean-${index}`), brand }));

  const results = diversifyOpportunities(opportunities, 8);
  assert.deepEqual(results.map((item) => item.brand), ['Alpha', 'Beta', 'Gamma', 'Delta', 'Alpha', 'Beta', 'Gamma', 'Delta']);
  for (const brand of new Set(results.map((item) => item.brand))) {
    assert.equal(results.filter((item) => item.brand === brand).length, 2);
  }
});

test('uses additional products from existing brands only when needed to fill the result limit', () => {
  const opportunities = ['Alpha', 'Alpha', 'Alpha', 'Beta']
    .map((brand, index) => ({ ...opportunity(`ean-${index}`), brand }));

  assert.deepEqual(diversifyOpportunities(opportunities, 4).map((item) => item.ean), ['ean-0', 'ean-3', 'ean-1', 'ean-2']);
});

test('adds secondary categories only when the primary category is below the target', () => {
  const primary = Array.from({ length: 10 }, (_, index) => opportunity(`primary-${index}`));
  const secondary = [opportunity('secondary-1')];
  assert.deepEqual(combineCategoryOpportunities(primary, secondary).map((item) => item.ean), primary.map((item) => item.ean));

  const limitedPrimary = primary.slice(0, 3);
  assert.deepEqual(
    combineCategoryOpportunities(limitedPrimary, secondary).map((item) => item.ean),
    [...limitedPrimary, ...secondary].map((item) => item.ean),
  );
});

test('deduplicates expanded categories and preserves the 24-result limit', () => {
  const primary = Array.from({ length: 9 }, (_, index) => opportunity(`ean-${index}`));
  const secondary = [opportunity('ean-0'), ...Array.from({ length: 30 }, (_, index) => opportunity(`secondary-${index}`))];
  const results = combineCategoryOpportunities(primary, secondary);
  assert.equal(results.length, 24);
  assert.equal(new Set(results.map((item) => item.ean)).size, 24);
  assert.equal(results[0].ean, 'ean-0');
  assert.equal(combineCategoryOpportunities([], secondary, 10, 10).length, 10);
});
