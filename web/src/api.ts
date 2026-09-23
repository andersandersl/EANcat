import type {
  BrandClusterResponse,
  CatalogStatsResponse,
  CategoriesResponse,
  ProductDetailResponse,
  ProductListResponse,
  SearchSuggestionType,
  SearchSuggestResponse,
  OpportunityScanResponse,
  OpportunityScanPageResponse,
  SupplierConnectionPayload,
} from './types';

// Azure Container App (eancat-api) — reads the isolated showcase_product DB.
// api.ts ignores VITE_API_BASE_URL in prod, so this MUST be hardcoded here.
const PROD_API_BASE = 'https://eancat-api.wonderfulcliff-a6d449df.swedencentral.azurecontainerapps.io';

// In production, force the known backend to avoid stale platform env values.
const RAW_API_BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787')
  : PROD_API_BASE;
const API_BASE = /^https?:\/\//i.test(RAW_API_BASE) ? RAW_API_BASE : `https://${RAW_API_BASE}`;

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload as T;
}

async function postSameOriginJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('The Opportunity Finder service is unavailable. Please try again shortly.');
  }
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload as T;
}

export function getProducts(
  query: string,
  limit = 48,
  category?: string,
  brand?: string,
  market = 'fi',
  page = 1,
  grades?: Set<string>,
  competitionLevels?: Set<number>,
  inStock?: boolean,
  hasImage?: boolean,
  includeTotal = true,
): Promise<ProductListResponse> {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  params.set('limit', String(limit));
  params.set('page', String(page));
  if (category) params.set('category', category);
  if (brand) params.set('brand', brand);
  params.set('market', market);
  if (grades && grades.size > 0) params.set('grades', [...grades].join(','));
  if (competitionLevels && competitionLevels.size > 0) params.set('competition', [...competitionLevels].sort((a, b) => a - b).join(','));
  if (inStock) params.set('inStock', 'true');
  if (hasImage) params.set('hasImage', 'true');
  if (!includeTotal) params.set('includeTotal', 'false');
  return readJson<ProductListResponse>(`/api/public/products?${params.toString()}`);
}

export function getCategories(
  options?: { market?: string; inStock?: boolean; hasImage?: boolean },
): Promise<CategoriesResponse> {
  const params = new URLSearchParams();
  if (options?.market) params.set('market', options.market);
  if (options?.inStock) params.set('inStock', 'true');
  if (options?.hasImage) params.set('hasImage', 'true');
  const query = params.toString();
  return readJson<CategoriesResponse>(`/api/public/categories${query ? `?${query}` : ''}`);
}

export function getBrandClusters(
  query: string,
  market = 'fi',
  brandOffset = 0,
  brandLimit = 20,
  perBrandLimit = 9,
  minBrandProducts = 9,
  category?: string,
  grades?: Set<string>,
  inStock?: boolean,
  hasImage?: boolean,
): Promise<BrandClusterResponse> {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (category) params.set('category', category);
  params.set('market', market);
  params.set('brandOffset', String(brandOffset));
  params.set('brandLimit', String(brandLimit));
  params.set('perBrandLimit', String(perBrandLimit));
  params.set('minBrandProducts', String(minBrandProducts));
  if (grades && grades.size > 0) params.set('grades', [...grades].join(','));
  if (inStock) params.set('inStock', 'true');
  if (hasImage) params.set('hasImage', 'true');
  return readJson<BrandClusterResponse>(`/api/public/brand-clusters?${params.toString()}`);
}

export function getCatalogStats(): Promise<CatalogStatsResponse> {
  return readJson<CatalogStatsResponse>('/api/public/stats');
}

export function getProductByEan(ean: string, market = 'fi'): Promise<ProductDetailResponse> {
  const params = new URLSearchParams({ market });
  return readJson<ProductDetailResponse>(`/api/public/products/${encodeURIComponent(ean)}?${params.toString()}`);
}

export function scanOpportunityShop(url: string): Promise<OpportunityScanResponse> {
  return postSameOriginJson<OpportunityScanResponse>('/api/public/opportunity-scan', { url });
}

export function loadMoreOpportunityProducts(scanId: string, offset: number): Promise<OpportunityScanPageResponse> {
  return postSameOriginJson<OpportunityScanPageResponse>('/api/public/opportunity-scan-page', { scanId, offset });
}

export function requestSupplierConnection(payload: SupplierConnectionPayload): Promise<{ requestId: string; status: 'accepted' }> {
  return postSameOriginJson<{ requestId: string; status: 'accepted' }>('/api/public/supplier-connection', payload);
}

export function getSearchSuggestions(
  query: string,
  options?: { market?: string; inStock?: boolean; hasImage?: boolean; limit?: number; types?: SearchSuggestionType[] },
): Promise<SearchSuggestResponse> {
  const params = new URLSearchParams();
  params.set('q', query);
  if (options?.market) params.set('market', options.market);
  if (options?.inStock) params.set('inStock', 'true');
  if (options?.hasImage) params.set('hasImage', 'true');
  if (options?.limit && options.limit > 0) params.set('limit', String(options.limit));
  if (options?.types && options.types.length > 0) params.set('types', options.types.join(','));
  return readJson<SearchSuggestResponse>(`/api/public/suggest?${params.toString()}`);
}
