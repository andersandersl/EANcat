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
  total: number;
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
};
