import { OpportunityError, type CatalogCandidate, type Market } from './_opportunity.js';

type CategoryEntry = { name: string; count: number };
type CategoriesResponse = { categories: CategoryEntry[] };
type ProductListResponse = { products: Array<CatalogCandidate & { updatedAt?: string | null }> };

const DEFAULT_PUBLIC_API_BASE = 'https://eancat-api.wonderfulcliff-a6d449df.swedencentral.azurecontainerapps.io';
const PUBLIC_API_BASE = normalizeApiBase(
  process.env.EANCAT_PUBLIC_API_BASE
    || process.env.EANRUNNER_PUBLIC_API_BASE
    || process.env.VITE_API_BASE_URL
    || DEFAULT_PUBLIC_API_BASE,
);

function normalizeApiBase(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

async function readPublicApi<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${PUBLIC_API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new OpportunityError('SCAN_FAILED', 'The opportunity catalogue is temporarily unavailable. Please try again shortly.');
  }
  if (!response.ok) {
    throw new OpportunityError('SCAN_FAILED', 'The opportunity catalogue is temporarily unavailable. Please try again shortly.');
  }
  return response.json() as Promise<T>;
}

export async function loadCatalogCategories(market: Market): Promise<string[]> {
  const params = new URLSearchParams({ market, inStock: 'true', hasImage: 'true' });
  const payload = await readPublicApi<CategoriesResponse>(`/api/public/categories?${params.toString()}`);
  return payload.categories
    .map((category) => category.name.trim())
    .filter(Boolean);
}

export async function loadCatalogCandidates(market: Market, category: string): Promise<CatalogCandidate[]> {
  const params = new URLSearchParams({
    limit: '48',
    page: '1',
    market,
    category,
    grades: 'A,B,C',
    inStock: 'true',
    hasImage: 'true',
    includeTotal: 'false',
  });
  const payload = await readPublicApi<ProductListResponse>(`/api/public/products?${params.toString()}`);
  return payload.products
    .map(({ updatedAt: _updatedAt, ...product }) => product)
    .filter((product) => product.stockStatus === 'in stock' && product.image && ['A', 'B', 'C'].includes(product.marginGrade));
}
