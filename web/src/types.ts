export type MarginGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'N/A';

export type PublicProduct = {
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

export type ProductListResponse = {
  products: PublicProduct[];
  count: number;
  total: number | null;
};

export type BrandClusterGroup = {
  brand: string;
  latestUpdatedAt: string | null;
  totalProducts: number;
  items: PublicProduct[];
};

export type BrandClusterResponse = {
  brands: BrandClusterGroup[];
  totalBrands: number;
  totalProducts: number;
  count: number;
};

export type ProductDetailResponse = {
  product: PublicProduct;
};

export type CategoryEntry = {
  name: string;
  count: number;
};

export type CategoriesResponse = {
  categories: CategoryEntry[];
  brandsByCategory: Record<string, string[]>;
};

export type CatalogStatsResponse = {
  totalProducts: number;
  inStockProducts: number;
  integratedSuppliers: number;
};

export type SearchSuggestionType = 'brand' | 'category' | 'keyword' | 'ean';

export type SearchSuggestion = {
  type: SearchSuggestionType;
  value: string;
  label: string;
  hitCount: number;
};

export type SearchSuggestResponse = {
  query: string;
  suggestions: SearchSuggestion[];
};

export type Opportunity = Omit<PublicProduct, 'updatedAt'> & {
  reason: string;
};

export type OpportunityScanResponse = {
  scanId: string;
  shop: { url: string; domain: string };
  market: { code: 'DK' | 'SE' | 'FI'; confidence: 'high' | 'medium' | 'low' };
  detectedCategories: Array<{ sourceLabel: string; catalogCategory: string; confidence: number }>;
  detectedBrands: string[];
  detectedEanCount: number;
  coverage: { pagesScanned: number; isPartial: boolean; warnings: string[] };
  opportunities: Opportunity[];
  hasMore: boolean;
};

export type OpportunityScanPageResponse = {
  opportunities: Opportunity[];
  hasMore: boolean;
};

export type SupplierConnectionPayload = {
  scanId: string;
  shopUrl: string;
  market: 'DK' | 'SE' | 'FI';
  selectedEans: string[];
  contact: { name: string; email: string; company: string; phone?: string };
  consent: true;
};
