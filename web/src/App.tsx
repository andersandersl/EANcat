import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, Filter, Loader2, Menu, Search, X } from 'lucide-react';
import { getBrandClusters, getCategories, getProducts, getSearchSuggestions } from './api';
import type { BrandClusterGroup, CategoryEntry, PublicProduct, SearchSuggestion } from './types';
import SiteFooter from './SiteFooter';
import { useDocumentMeta } from './useDocumentMeta';

const PAGE_SIZE = 48;
const MULTI_FILTER_PAGE_SIZE = 200;
const LIST_LOAD_MORE_BATCH_SIZE = 98;
const BRAND_PAGE_INITIAL_BATCH_SIZE = 60;
const BRAND_PAGE_BATCH_SIZE = 120;
const BRAND_CLUSTER_MIN_PRODUCTS = 9;
const BRAND_CLUSTER_BRAND_BATCH = 10;
const BRAND_CLUSTER_REQUEST_TIMEOUT_MS = 7000;
const ABOVE_THE_FOLD_PRIORITY_COUNT = 8;
const FILTER_OPTIONS_CACHE_KEY = 'webversion.filter-options.cache.v2';
const FILTER_OPTIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const HOME_CATALOG_CACHE_KEY = 'webversion.home-catalog.cache.v4';
const HOME_CATALOG_CACHE_TTL_MS = 60 * 60 * 1000;
const URL_ALLOWED_GRADES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'N/A']);

type HomeCatalogCachePayload =
  | {
      timestamp: number;
      mode: 'clusters';
      cacheKey: string;
      brandClusterGroups: BrandClusterGroup[];
      totalProducts: number;
      totalBrands: number;
    }
  | {
      timestamp: number;
      mode: 'products';
      cacheKey: string;
      products: PublicProduct[];
      totalProducts: number;
    };

function parseBooleanQueryParam(value: string | null): boolean | null {
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') return true;
  if (normalized === '0' || normalized === 'false') return false;
  return null;
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function splitFilterValues(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function joinFilterValues(values: string[]): string {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))].join(',');
}

const GRADE_STYLES: Record<string, { bg: string; text: string }> = {
  A: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  B: { bg: 'bg-blue-100', text: 'text-blue-800' },
  C: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  D: { bg: 'bg-orange-100', text: 'text-orange-800' },
  E: { bg: 'bg-red-100', text: 'text-red-800' },
  F: { bg: 'bg-red-200', text: 'text-red-900' },
  'N/A': { bg: 'bg-gray-100', text: 'text-gray-500' },
};

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23FFFFFF'/%3E%3Ctext x='200' y='210' text-anchor='middle' font-family='Arial%2C sans-serif' font-size='18' fill='%239CA3AF'%3ENo Image%3C/text%3E%3C/svg%3E";

function competitionLevel(competitorCount: number | null | undefined): 0 | 1 | 2 | 3 {
  const count = Math.max(0, competitorCount ?? 0);
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

const COMPETITION_LEVEL_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: 'No competition',
  1: 'Low competition',
  2: 'Medium competition',
  3: 'High competition',
};

function competitionBadge(level: 0 | 1 | 2 | 3): { label: string; chiliColor: string; chiliCount: number } {
  switch (level) {
    case 0:
      return { label: 'No competition', chiliColor: 'text-emerald-600', chiliCount: 1 };
    case 1:
      return { label: 'Low competition', chiliColor: 'text-red-600', chiliCount: 1 };
    case 2:
      return { label: 'Medium competition', chiliColor: 'text-red-600', chiliCount: 2 };
    default:
      return { label: 'High competition', chiliColor: 'text-red-600', chiliCount: 3 };
  }
}

function pickPreferredBrandLabel(current: string, candidate: string): string {
  const currentHasLowercase = /[a-z]/.test(current);
  const candidateHasLowercase = /[a-z]/.test(candidate);
  if (candidateHasLowercase && !currentHasLowercase) {
    return candidate;
  }

  const currentLooksTitleCase = /^[A-Z][a-z]/.test(current);
  const candidateLooksTitleCase = /^[A-Z][a-z]/.test(candidate);
  if (candidateLooksTitleCase && !currentLooksTitleCase) {
    return candidate;
  }

  return current;
}

function getUniqueBrandLabels(brands: Iterable<string>): string[] {
  const brandLabelsByKey = new Map<string, string>();

  for (const rawBrand of brands) {
    const normalizedBrand = rawBrand.trim();
    if (!normalizedBrand) continue;

    const brandKey = normalizedBrand.toUpperCase();
    const existingLabel = brandLabelsByKey.get(brandKey);
    if (!existingLabel) {
      brandLabelsByKey.set(brandKey, normalizedBrand);
      continue;
    }

    brandLabelsByKey.set(brandKey, pickPreferredBrandLabel(existingLabel, normalizedBrand));
  }

  return [...brandLabelsByKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function applyClientFilters(
  items: PublicProduct[],
  keyword: string,
  selectedCompetitionLevels: Set<number>,
): PublicProduct[] {
  let filtered = items;
  if (selectedCompetitionLevels.size > 0) {
    filtered = filtered.filter((p) => selectedCompetitionLevels.has(competitionLevel(p.competitorCount)));
  }
  if (keyword) {
    filtered = filtered.filter((p) =>
      p.ean.toLowerCase().includes(keyword)
      || p.title.toLowerCase().includes(keyword)
      || p.brand.toLowerCase().includes(keyword),
    );
  }
  return filtered;
}

function getFilterOptionsCacheKey(
  market: string,
  inStockOnly: boolean,
  hasPictureOnly: boolean,
): string {
  return `${FILTER_OPTIONS_CACHE_KEY}.${market}.${inStockOnly ? '1' : '0'}.${hasPictureOnly ? '1' : '0'}`;
}

function loadFilterOptionsCache(cacheKey: string): { categories: CategoryEntry[]; brandsByCategory: Record<string, string[]> } | null {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; categories: CategoryEntry[]; brandsByCategory: Record<string, string[]> };
    if (!parsed?.timestamp || Date.now() - parsed.timestamp > FILTER_OPTIONS_CACHE_TTL_MS) {
      return null;
    }
    return {
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      brandsByCategory: parsed.brandsByCategory && typeof parsed.brandsByCategory === 'object' ? parsed.brandsByCategory : {},
    };
  } catch {
    return null;
  }
}

function saveFilterOptionsCache(
  cacheKey: string,
  categories: CategoryEntry[],
  brandsByCategory: Record<string, string[]>,
): void {
  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({ timestamp: Date.now(), categories, brandsByCategory }),
    );
  } catch {
    // Ignore storage failures.
  }
}

function getHomeCatalogCacheKey(mode: 'clusters' | 'products', options: {
  market: string;
  previewCount?: number;
  limit?: number;
}): string {
  return [
    mode,
    options.market,
    options.previewCount ?? '-',
    options.limit ?? '-',
  ].join('.');
}

function loadHomeCatalogCache(cacheKey: string): HomeCatalogCachePayload | null {
  try {
    const raw = localStorage.getItem(HOME_CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeCatalogCachePayload;
    if (!parsed?.timestamp || parsed.cacheKey !== cacheKey) return null;
    if (Date.now() - parsed.timestamp > HOME_CATALOG_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveHomeCatalogCache(payload: HomeCatalogCachePayload): void {
  try {
    localStorage.setItem(HOME_CATALOG_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
}

function getCompactPageSizeForWidth(width: number): number {
  if (width >= 1280) return 9;
  if (width >= 1024) return 6;
  if (width >= 640) return 3;
  return 2;
}

function getCompactBrandPreviewCountForWidth(width: number): number {
  if (width >= 1536) return 9;
  if (width >= 1280) return 8;
  if (width >= 1024) return 6;
  if (width >= 640) return 3;
  return 2;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle != null) clearTimeout(timeoutHandle);
  }
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function marginRangeLabel(grade: string, marketPrice: number | null, currency: string | null): string | null {
  if (!marketPrice || marketPrice <= 0 || grade === 'N/A') return null;
  const sym = currency === 'DKK' || currency === 'SEK' ? '' : '€';
  const suffix = currency === 'DKK' ? ' kr' : currency === 'SEK' ? ' kr' : '';
  const fmt = (v: number) => `${sym}${Math.round(Math.abs(v)).toLocaleString()}${suffix}`;
  switch (grade) {
    case 'A': return `More than +${fmt(marketPrice * 0.20)}`;
    case 'B': return `Between ${fmt(marketPrice * 0.10)} to ${fmt(marketPrice * 0.20)}`;
    case 'C': return `Between ${fmt(marketPrice * 0.05)} to ${fmt(marketPrice * 0.10)}`;
    case 'D': return `Between ${currency === 'DKK' || currency === 'SEK' ? '0 kr' : '\u20ac0'} to ${fmt(marketPrice * 0.05)}`;
    case 'E': return `Loss between 0 and -${fmt(marketPrice * 0.10)}`;
    case 'F': return `Less than -${fmt(marketPrice * 0.10)}`;
    default: return null;
  }
}

const ProductCard = memo(function ProductCard({
  product,
  compact,
  eagerImage,
}: {
  product: PublicProduct;
  compact?: boolean;
  eagerImage?: boolean;
}) {
  const grade = GRADE_STYLES[product.marginGrade] ?? GRADE_STYLES['N/A'];
  const rangeLabel = marginRangeLabel(product.marginGrade, product.marketPrice, product.marketCurrency);
  const level = competitionLevel(product.competitorCount);
  const hot = competitionBadge(level);
  const compactClass = compact ? 'rounded-lg' : 'rounded-xl';

  return (
    <div
      className={`bg-white ${compactClass} border border-[hsl(220_14%_89%)] shadow-[0_1px_3px_0_rgb(0_0_0/0.06)] overflow-hidden flex flex-col hover:shadow-md transition-shadow`}
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: compact ? '330px 180px' : '360px 220px',
      }}
    >
      <Link to={`/product/${encodeURIComponent(product.ean)}`} className="block">
        <div className={`aspect-square bg-white overflow-hidden relative ${compact ? 'max-h-[180px]' : ''}`}>
          <img
            src={product.image || PLACEHOLDER_IMAGE}
            alt={product.title}
            loading={eagerImage ? 'eager' : 'lazy'}
            fetchPriority={eagerImage ? 'high' : 'auto'}
            decoding="async"
            className={`w-full h-full object-contain ${compact ? 'p-2.5' : 'p-3'}`}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              if (img.src !== PLACEHOLDER_IMAGE) img.src = PLACEHOLDER_IMAGE;
            }}
          />
          <span className={`absolute ${compact ? 'top-1.5 right-1.5' : 'top-2 right-2'} text-[10px] font-bold px-1.5 py-0.5 rounded ${grade.bg} ${grade.text}`}>
            {product.marginGrade}
          </span>
          <div className={`absolute ${compact ? 'top-1.5 left-1.5' : 'top-2 left-2'} inline-flex items-center gap-1`}>
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[hsl(220_16%_84%)] bg-white/95 px-1"
              title={product.stockStatus === 'in stock' ? 'In stock' : 'Out of stock'}
            >
              {product.stockStatus === 'in stock' ? (
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              ) : (
                <span className="text-[11px] leading-none text-red-600">🏭</span>
              )}
            </span>
            <span
              className="inline-flex h-5 items-center justify-center rounded-full border border-[hsl(220_16%_84%)] bg-white/95 px-1.5"
              title={hot.label}
            >
              <span className={`text-[10px] leading-none ${hot.chiliColor}`}>{'🌶'.repeat(hot.chiliCount)}</span>
            </span>
          </div>
        </div>
      </Link>
      <div className={`${compact ? 'p-2.5 gap-1.5' : 'p-3 gap-2'} flex flex-col flex-1`}>
        <Link to={`/product/${encodeURIComponent(product.ean)}`} className="block min-w-0 hover:underline decoration-[hsl(221_92%_55%)] underline-offset-2">
          <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-[hsl(220_12%_50%)] font-medium truncate`}>{product.brand || '—'}</p>
          <h3 className={`${compact ? 'text-[11px] min-h-[2rem]' : 'text-xs min-h-[2.25rem]'} font-semibold text-[hsl(222_47%_8%)] line-clamp-2 leading-snug mt-0.5`}>{product.title}</h3>
        </Link>
        <div className="min-w-0">
          <span
            className={`${compact ? 'text-[9px]' : 'text-[10px]'} inline-flex w-full items-center rounded-md border border-[hsl(220_16%_86%)] bg-[hsl(220_18%_98%)] px-1.5 py-0.5 font-mono tracking-wide text-[hsl(220_24%_24%)]`}
            title={`EAN ${product.ean}`}
          >
            <span className="mr-1 shrink-0 text-[hsl(220_12%_52%)]">EAN:</span>
            <span className="break-all">{product.ean}</span>
          </span>
        </div>
        <p className={`${compact ? 'text-[8px]' : 'text-[9px]'} text-[hsl(220_12%_45%)] font-medium whitespace-nowrap overflow-hidden text-ellipsis`}>
          Est. margin: <span className="text-[hsl(222_47%_20%)] font-semibold">{rangeLabel ?? 'Not available'}</span>
        </p>
        <div className={`flex ${compact ? 'gap-1' : 'gap-1.5'} mt-auto`}>
          {product.cheapestMarketLink ? (
            <a
              href={product.cheapestMarketLink}
              target="_blank"
              rel="noreferrer"
              className={`w-full flex items-center justify-center gap-1 font-medium text-[hsl(221_92%_55%)] border border-[hsl(221_92%_55%)] rounded-md ${compact ? 'text-[9px] px-1.5 py-1' : 'text-[10px] px-2 py-1.5'} hover:bg-[hsl(221_80%_95%)] transition-colors`}
            >
              <ExternalLink className={`${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} shrink-0`} />
              {product.marketPrice != null
                ? (product.marketCurrency === 'DKK' || product.marketCurrency === 'SEK'
                    ? `${Math.round(product.marketPrice)} ${product.marketCurrency === 'DKK' ? 'kr' : 'kr'}`
                    : `€${product.marketPrice.toFixed(0)}`)
                : 'Market'}
            </a>
          ) : (
            <span className="flex-1" />
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { brandParam } = useParams<{ brandParam?: string }>();
  const isCompactVersion = true;
  const decodedRouteBrand = useMemo(() => {
    if (!brandParam) return '';
    try {
      return decodeURIComponent(brandParam);
    } catch {
      return brandParam;
    }
  }, [brandParam]);

  useDocumentMeta(
    decodedRouteBrand
      ? {
          title: `${decodedRouteBrand} products`,
          description: `Browse ${decodedRouteBrand} products in the EANrunner catalogue — enriched product data, live stock, and competitive wholesale prices across Europe.`,
          path: `/brand/${encodeURIComponent(decodedRouteBrand)}`,
        }
      : {
          title: 'EANrunner — The catalogue',
          rawTitle: true,
          description:
            'Browse 100,000+ products with enriched data, live stock, and competitive wholesale prices from reliable European distributors.',
          path: '/',
        },
  );

  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState(decodedRouteBrand);
  const [inStockOnly, setInStockOnly] = useState(isCompactVersion);
  const [hasPictureOnly, setHasPictureOnly] = useState(false);
  const [selectedCompetitionLevels, setSelectedCompetitionLevels] = useState<Set<number>>(new Set());
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set());
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [brandSearchTerm, setBrandSearchTerm] = useState('');
  const [market, setMarket] = useState('dk');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Cold-start notice (EANRunner ADR-0114): eancat-api scales to zero and the
  // showcase DB auto-pauses (ADR-0036), so the first visit after a quiet spell
  // waits 10–60 s (brand clusters time out at 7 s and fall back to the plain
  // list, which then waits it out). After 3 s of loading we say so, instead of
  // leaving a bare progress bar that looks like a hang.
  const [wakingUp, setWakingUp] = useState(false);
  useEffect(() => {
    if (!loading) {
      setWakingUp(false);
      return;
    }
    const id = setTimeout(() => setWakingUp(true), 3000);
    return () => clearTimeout(id);
  }, [loading]);
  const [page, setPage] = useState(1);
  const [listVisibleLimit, setListVisibleLimit] = useState(PAGE_SIZE);
  const [brandVisibleLimit, setBrandVisibleLimit] = useState(BRAND_PAGE_INITIAL_BATCH_SIZE);
  const [brandClusterGroups, setBrandClusterGroups] = useState<BrandClusterGroup[]>([]);
  const [brandClusterOffset, setBrandClusterOffset] = useState(0);
  const [brandClusterTotalBrands, setBrandClusterTotalBrands] = useState(0);
  const [disableBrandClusters, setDisableBrandClusters] = useState(false);
  const [showIntroCard, setShowIntroCard] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);
  const [hasLoadedTotalProducts, setHasLoadedTotalProducts] = useState(false);
  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [brandsByCategory, setBrandsByCategory] = useState<Record<string, string[]>>({});
  const preBrandFilterStateRef = useRef<{ inStockOnly: boolean; hasPictureOnly: boolean } | null>(null);
  const hasHydratedFiltersFromUrlRef = useRef(false);
  const skipNextUrlWriteRef = useRef(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const latestSuggestRequestRef = useRef(0);
  const suppressNextSuggestRef = useRef(false);
  const selectedCategoryValues = useMemo(() => splitFilterValues(selectedCategory), [selectedCategory]);
  const selectedBrandValues = useMemo(() => splitFilterValues(selectedBrand), [selectedBrand]);

  const compactPreviewPageSize = getCompactPageSizeForWidth(viewportWidth);
  const hasMultiFilterSelection = selectedCategoryValues.length > 1 || selectedBrandValues.length > 1;
  const defaultListPageSize = hasMultiFilterSelection ? MULTI_FILTER_PAGE_SIZE : PAGE_SIZE;
  const shouldUseCompactPreviewPageSize = isCompactVersion
    && viewMode === 'grid'
    && selectedCategoryValues.length === 0
    && selectedBrandValues.length === 0
    && !debouncedKeyword.trim()
    && selectedCompetitionLevels.size === 0
    && selectedGrades.size === 0
    && market === 'dk'
    && inStockOnly === true
    && hasPictureOnly === false;
  const pageSize = shouldUseCompactPreviewPageSize ? compactPreviewPageSize : defaultListPageSize;
  const compactBrandPreviewCount = getCompactBrandPreviewCountForWidth(viewportWidth);
  const isMobileViewport = viewportWidth < 768;
  const mobileBrandRailProductCount = 9;
  const brandClusterPerBrandLimit = isMobileViewport ? mobileBrandRailProductCount : compactBrandPreviewCount;
  const shouldClusterByBrand = isCompactVersion
    && viewMode === 'grid'
    && selectedCategoryValues.length === 0
    && selectedBrandValues.length === 0
    && !debouncedKeyword.trim()
    && selectedCompetitionLevels.size === 0
    && selectedGrades.size === 0
    && !disableBrandClusters;

  const setBrandFilter = (nextBrandRaw: string) => {
    const nextBrand = nextBrandRaw.trim();
    setSelectedBrand(nextBrand);
    if (nextBrand) {
      if (!selectedBrand) {
        preBrandFilterStateRef.current = {
          inStockOnly,
          hasPictureOnly,
        };
      }
      setInStockOnly(false);
      setHasPictureOnly(false);
      setBrandVisibleLimit(BRAND_PAGE_INITIAL_BATCH_SIZE);
      navigate(`/brand/${encodeURIComponent(nextBrand)}`);
    } else {
      setDisableBrandClusters(false);
      const previous = preBrandFilterStateRef.current;
      if (previous) {
        setInStockOnly(previous.inStockOnly);
        setHasPictureOnly(previous.hasPictureOnly);
      } else {
        setInStockOnly(true);
        setHasPictureOnly(false);
      }
      preBrandFilterStateRef.current = null;
      navigate('/');
    }
  };

  const goToHomeFrontPage = () => {
    setDisableBrandClusters(false);
    setSelectedCategory('');
    setBrandFilter('');
    setKeyword('');
    setMarket('dk');
    setInStockOnly(true);
    setHasPictureOnly(false);
    setSelectedGrades(new Set());
    setSelectedCompetitionLevels(new Set());
    setPage(1);
    setBrandVisibleLimit(BRAND_PAGE_INITIAL_BATCH_SIZE);
    setBrandClusterOffset(0);
    setShowIntroCard(true);
    setFiltersOpen(false);
  };

  useEffect(() => {
    const routeBrand = decodedRouteBrand.trim();
    setSelectedBrand(routeBrand);
    if (routeBrand) {
      setInStockOnly(false);
      setHasPictureOnly(false);
      setBrandVisibleLimit(BRAND_PAGE_INITIAL_BATCH_SIZE);
    }
  }, [decodedRouteBrand]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current && (!target || !menuRef.current.contains(target))) {
        setMenuOpen(false);
      }
      if (searchBoxRef.current && (!target || !searchBoxRef.current.contains(target))) {
        setSuggestionsOpen(false);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, []);

  useEffect(() => {
    skipNextUrlWriteRef.current = true;

    const params = new URLSearchParams(location.search);

    const nextKeyword = (params.get('q') || '').trim();
    const nextCategory = (params.get('category') || '').trim();
    const nextMarketParam = (params.get('market') || '').trim().toLowerCase();
    const nextMarket = nextMarketParam === 'dk' || nextMarketParam === 'se' || nextMarketParam === 'fi' ? nextMarketParam : 'dk';

    const nextGrades = new Set(
      (params.get('grades') || '')
        .split(',')
        .map((grade) => grade.trim().toUpperCase())
        .filter((grade) => URL_ALLOWED_GRADES.has(grade)),
    );

    const nextCompetitionLevels = new Set(
      (params.get('competition') || '')
        .split(',')
        .map((level) => Number.parseInt(level.trim(), 10))
        .filter((level) => Number.isInteger(level) && level >= 0 && level <= 3),
    );

    const defaultInStockToggleValue = isCompactVersion && !decodedRouteBrand;
    const defaultHasPictureToggleValue = false;
    const parsedInStock = parseBooleanQueryParam(params.get('inStock'));
    const parsedHasPicture = parseBooleanQueryParam(params.get('hasPicture'));
    const nextInStockOnly = parsedInStock ?? defaultInStockToggleValue;
    const nextHasPictureOnly = parsedHasPicture ?? defaultHasPictureToggleValue;

    if (keyword !== nextKeyword) setKeyword(nextKeyword);
    if (selectedCategory !== nextCategory) setSelectedCategory(nextCategory);
    if (market !== nextMarket) setMarket(nextMarket);
    if (inStockOnly !== nextInStockOnly) setInStockOnly(nextInStockOnly);
    if (hasPictureOnly !== nextHasPictureOnly) setHasPictureOnly(nextHasPictureOnly);
    if (!setsEqual(selectedGrades, nextGrades)) setSelectedGrades(nextGrades);
    if (!setsEqual(selectedCompetitionLevels, nextCompetitionLevels)) setSelectedCompetitionLevels(nextCompetitionLevels);

    hasHydratedFiltersFromUrlRef.current = true;
  }, [location.search, decodedRouteBrand, isCompactVersion]);

  useEffect(() => {
    if (!isCompactVersion) return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCompactVersion]);

  useEffect(() => {
    if (!isMobileViewport) return;
    if (viewMode !== 'grid') setViewMode('grid');
  }, [isMobileViewport, viewMode]);

  useEffect(() => {
    if (!hasHydratedFiltersFromUrlRef.current) return;
    if (skipNextUrlWriteRef.current) {
      skipNextUrlWriteRef.current = false;
      return;
    }

    const params = new URLSearchParams();
    const normalizedKeyword = keyword.trim();
    if (normalizedKeyword) params.set('q', normalizedKeyword);
    if (selectedCategory.trim()) params.set('category', selectedCategory.trim());
    if (market !== 'dk') params.set('market', market);

    const sortedGrades = [...selectedGrades].sort((a, b) => a.localeCompare(b));
    if (sortedGrades.length > 0) params.set('grades', sortedGrades.join(','));

    const sortedCompetition = [...selectedCompetitionLevels].sort((a, b) => a - b);
    if (sortedCompetition.length > 0) params.set('competition', sortedCompetition.join(','));

    params.set('inStock', inStockOnly ? '1' : '0');
    params.set('hasPicture', hasPictureOnly ? '1' : '0');

    const nextSearch = params.toString();
    const currentSearch = location.search.startsWith('?') ? location.search.slice(1) : location.search;
    if (nextSearch === currentSearch) return;

    navigate(
      {
        pathname: decodedRouteBrand.trim() && selectedBrandValues.length === 1 ? `/brand/${encodeURIComponent(selectedBrandValues[0])}` : '/',
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [
    navigate,
    location.search,
    keyword,
    selectedCategory,
    selectedBrand,
    selectedBrandValues,
    decodedRouteBrand,
    market,
    selectedGrades,
    selectedCompetitionLevels,
    inStockOnly,
    hasPictureOnly,
    isCompactVersion,
  ]);

  // Debounce keyword
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 350);
    return () => clearTimeout(timer);
  }, [keyword]);

  // Load categories on mount
  useEffect(() => {
    const cacheKey = getFilterOptionsCacheKey(market, inStockOnly, hasPictureOnly);
    const cached = loadFilterOptionsCache(cacheKey);
    if (cached) {
      setCategories(cached.categories);
      setBrandsByCategory(cached.brandsByCategory);
    }

    getCategories({ market, inStock: inStockOnly, hasImage: hasPictureOnly })
      .then((data) => {
        setCategories(data.categories);
        setBrandsByCategory(data.brandsByCategory);
        saveFilterOptionsCache(cacheKey, data.categories, data.brandsByCategory);
      })
      .catch((err) => console.error('Failed to load categories', err));
  }, [
    market,
    inStockOnly,
    hasPictureOnly,
  ]);

  // Load products whenever filters change
  useEffect(() => {
    let active = true;
    async function load() {
      const normalizedKeyword = debouncedKeyword.trim();
      const canUseHomeCatalogCache = isCompactVersion
        && !decodedRouteBrand.trim()
        && !normalizedKeyword
        && selectedCategoryValues.length === 0
        && selectedBrandValues.length === 0
        && selectedCompetitionLevels.size === 0
        && selectedGrades.size === 0
        && market === 'dk'
        && inStockOnly === true
        && hasPictureOnly === false;

      if (canUseHomeCatalogCache) {
        const clusterCacheKey = getHomeCatalogCacheKey('clusters', {
          market,
          previewCount: brandClusterPerBrandLimit,
        });
        const productCacheKey = getHomeCatalogCacheKey('products', {
          market,
          limit: Math.max(listVisibleLimit, pageSize),
        });
        const cached = loadHomeCatalogCache(shouldClusterByBrand ? clusterCacheKey : productCacheKey);
        const shouldUseCached = cached
          && (cached.mode !== 'clusters' || cached.brandClusterGroups.length > 0 || cached.totalBrands === 0);

        if (shouldUseCached) {
          setError('');
          setHasLoadedTotalProducts(true);

          if (cached.mode === 'clusters') {
            setDisableBrandClusters(false);
            setBrandClusterGroups(cached.brandClusterGroups);
            setBrandClusterTotalBrands(cached.totalBrands);
            setTotalProducts(cached.totalProducts);
            setProducts([]);
          } else {
            setDisableBrandClusters(true);
            setBrandClusterGroups([]);
            setBrandClusterTotalBrands(0);
            setProducts(cached.products);
            setTotalProducts(cached.totalProducts);
          }

          setLoading(false);
          return;
        }
      }

      setLoading(true);
      setError('');
      try {
        if (shouldClusterByBrand) {
          try {
            const clusterData = await withTimeout(
              getBrandClusters(
                normalizedKeyword,
                market,
                brandClusterOffset,
                BRAND_CLUSTER_BRAND_BATCH,
                brandClusterPerBrandLimit,
                BRAND_CLUSTER_MIN_PRODUCTS,
                selectedCategory || undefined,
                selectedGrades.size > 0 ? selectedGrades : undefined,
                inStockOnly || undefined,
                true,
              ),
              BRAND_CLUSTER_REQUEST_TIMEOUT_MS,
              'Brand cluster request timed out',
            );

            if (!active) return;
            if (brandClusterOffset === 0 && clusterData.totalBrands > 0 && clusterData.brands.length === 0) {
              throw new Error('Empty cluster payload for non-empty catalog');
            }
            setDisableBrandClusters(false);
            setBrandClusterGroups((prev) => (brandClusterOffset === 0 ? clusterData.brands : [...prev, ...clusterData.brands]));
            setBrandClusterTotalBrands(clusterData.totalBrands);
            setTotalProducts(clusterData.totalProducts);
            setHasLoadedTotalProducts(true);
            setProducts([]);

            if (canUseHomeCatalogCache && brandClusterOffset === 0) {
              saveHomeCatalogCache({
                timestamp: Date.now(),
                mode: 'clusters',
                cacheKey: getHomeCatalogCacheKey('clusters', {
                  market,
                  previewCount: brandClusterPerBrandLimit,
                }),
                brandClusterGroups: clusterData.brands,
                totalProducts: clusterData.totalProducts,
                totalBrands: clusterData.totalBrands,
              });
            }
            return;
          } catch (clusterErr) {
            if (!active) return;
            console.warn('[Catalog] Brand cluster request failed, falling back to product list mode.', clusterErr);
            setDisableBrandClusters(true);
            setBrandClusterGroups([]);
            setBrandClusterTotalBrands(0);
          }
        }

        const brandPageMode = isCompactVersion && !!decodedRouteBrand.trim();
        const effectiveLimit = brandPageMode
          ? Math.max(brandVisibleLimit, BRAND_PAGE_INITIAL_BATCH_SIZE)
          : Math.max(listVisibleLimit, pageSize);
        const effectivePage = 1;
        const selectedCategoryFilter = selectedCategoryValues.length > 0 ? joinFilterValues(selectedCategoryValues) : undefined;
        const selectedBrandFilter = selectedBrandValues.length > 0 ? joinFilterValues(selectedBrandValues) : undefined;
        const data = await getProducts(
          normalizedKeyword,
          effectiveLimit,
          selectedCategoryFilter,
          selectedBrandFilter,
          market,
          effectivePage,
          selectedGrades.size > 0 ? selectedGrades : undefined,
          inStockOnly || undefined,
          hasPictureOnly || undefined,
        );
        const backendTotal = data.total ?? data.count;

        if (!active) return;
        setProducts(data.products);
        setTotalProducts(backendTotal);
        setHasLoadedTotalProducts(true);

        if (canUseHomeCatalogCache) {
          saveHomeCatalogCache({
            timestamp: Date.now(),
            mode: 'products',
            cacheKey: getHomeCatalogCacheKey('products', {
              market,
              limit: effectiveLimit,
            }),
            products: data.products,
            totalProducts: backendTotal,
          });
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load products');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [
    debouncedKeyword,
    selectedCategory,
    selectedBrand,
    selectedCategoryValues,
    selectedBrandValues,
    decodedRouteBrand,
    market,
    page,
    selectedGrades,
    inStockOnly,
    hasPictureOnly,
    selectedCompetitionLevels,
    brandClusterOffset,
    disableBrandClusters,
    isCompactVersion,
    brandVisibleLimit,
    listVisibleLimit,
    shouldClusterByBrand,
    pageSize,
    compactBrandPreviewCount,
    brandClusterPerBrandLimit,
  ]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
    setListVisibleLimit(pageSize);
    setBrandClusterOffset(0);
    setBrandClusterGroups([]);
  }, [
    debouncedKeyword,
    selectedCategory,
    selectedBrand,
    market,
    selectedGrades,
    inStockOnly,
    hasPictureOnly,
    selectedCompetitionLevels,
    pageSize,
  ]);

  useEffect(() => {
    setBrandVisibleLimit(BRAND_PAGE_INITIAL_BATCH_SIZE);
  }, [isCompactVersion, selectedBrand]);

  const visibleProducts = useMemo(() => {
    const keyword = debouncedKeyword.trim().toLowerCase();
    const filtered = applyClientFilters(
      products,
      keyword,
      selectedCompetitionLevels,
    );

    return [...filtered]
      .sort((a, b) => {
      if (decodedRouteBrand.trim() || selectedBrandValues.length > 0) {
        const aHasImage = a.image ? 1 : 0;
        const bHasImage = b.image ? 1 : 0;
        if (aHasImage !== bHasImage) return bHasImage - aHasImage;
      }

      const aNa = a.marginGrade === 'N/A' ? 1 : 0;
      const bNa = b.marginGrade === 'N/A' ? 1 : 0;
      return aNa - bNa;
      })
        .slice(0, (isCompactVersion && decodedRouteBrand.trim()) ? brandVisibleLimit : listVisibleLimit);
      }, [products, selectedCompetitionLevels, debouncedKeyword, isCompactVersion, decodedRouteBrand, selectedBrandValues, brandVisibleLimit, listVisibleLimit]);

  const brandGroups = useMemo(() => brandClusterGroups, [brandClusterGroups]);

  const sortedCategories = useMemo(
    () => [...categories]
      .filter((entry) => entry.count > 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  const availableCategoryOptions = useMemo(() => {
    if (selectedBrandValues.length === 0) return sortedCategories;
    const normalizedBrands = new Set(selectedBrandValues.map((brand) => brand.trim().toUpperCase()).filter(Boolean));
    if (normalizedBrands.size === 0) return sortedCategories;

    return sortedCategories.filter((item) =>
      (brandsByCategory[item.name] ?? []).some((brand) => normalizedBrands.has(brand.trim().toUpperCase())),
    );
  }, [sortedCategories, brandsByCategory, selectedBrandValues]);

  const availableBrandOptions = useMemo(() => {
    if (selectedCategoryValues.length === 0) {
      return getUniqueBrandLabels(Object.values(brandsByCategory).flat());
    }

    const categoriesToUse = selectedCategoryValues.length > 0
      ? selectedCategoryValues
      : sortedCategories.map((item) => item.name);

    const brandsToMerge: string[] = [];
    for (const categoryName of categoriesToUse) {
      for (const brand of brandsByCategory[categoryName] ?? []) {
        brandsToMerge.push(brand);
      }
    }

    return getUniqueBrandLabels(brandsToMerge);
  }, [brandsByCategory, selectedCategoryValues, sortedCategories]);

  const allBrandTagOptions = useMemo(() => {
    return getUniqueBrandLabels(Object.values(brandsByCategory).flat());
  }, [brandsByCategory]);

  const filteredCategoryOptions = useMemo(() => {
    const query = categorySearchTerm.trim().toLowerCase();
    if (!query) return availableCategoryOptions;
    return availableCategoryOptions.filter((item) => item.name.toLowerCase().includes(query));
  }, [availableCategoryOptions, categorySearchTerm]);

  const filteredBrandOptions = useMemo(() => {
    const query = brandSearchTerm.trim().toLowerCase();
    if (!query) return availableBrandOptions;
    return availableBrandOptions.filter((brand) => brand.toLowerCase().includes(query));
  }, [availableBrandOptions, brandSearchTerm]);

  useEffect(() => {
    if (selectedCategoryValues.length === 0) return;
    const allowed = new Set(availableCategoryOptions.map((item) => item.name));
    const filtered = selectedCategoryValues.filter((category) => allowed.has(category));
    if (filtered.length !== selectedCategoryValues.length) {
      setSelectedCategory(joinFilterValues(filtered));
    }
  }, [selectedCategoryValues, availableCategoryOptions]);

  useEffect(() => {
    if (selectedBrandValues.length === 0 || availableBrandOptions.length === 0) return;
    const availableNormalized = new Set(availableBrandOptions.map((brand) => brand.trim().toUpperCase()));
    const filtered = selectedBrandValues.filter((brand) => availableNormalized.has(brand.trim().toUpperCase()));
    if (filtered.length !== selectedBrandValues.length) {
      setSelectedBrand(joinFilterValues(filtered));
    }
  }, [selectedBrandValues, availableBrandOptions]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    for (const brand of selectedBrandValues) {
      chips.push({
        key: `brand-${brand}`,
        label: `Brand: ${brand}`,
        clear: () => setSelectedBrand(joinFilterValues(selectedBrandValues.filter((item) => item !== brand))),
      });
    }
    for (const category of selectedCategoryValues) {
      chips.push({
        key: `category-${category}`,
        label: `Category: ${category}`,
        clear: () => {
          setSelectedCategory(joinFilterValues(selectedCategoryValues.filter((item) => item !== category)));
        },
      });
    }
    if (keyword.trim()) {
      chips.push({ key: 'search', label: `Search: ${keyword.trim()}`, clear: () => setKeyword('') });
    }
    if (market !== 'dk') {
      chips.push({ key: 'market', label: `Market: ${market.toUpperCase()}`, clear: () => setMarket('dk') });
    }
    const isDefaultFrontPageState = isCompactVersion
      && !decodedRouteBrand.trim()
      && inStockOnly
      && !hasPictureOnly
      && market === 'dk'
      && !keyword.trim()
      && selectedCategoryValues.length === 0
      && selectedBrandValues.length === 0
      && selectedGrades.size === 0
      && selectedCompetitionLevels.size === 0;

    if (inStockOnly && !isDefaultFrontPageState) {
      chips.push({ key: 'stock', label: 'In stock only', clear: () => setInStockOnly(false) });
    }
    if (hasPictureOnly) {
      chips.push({ key: 'picture', label: 'Has picture', clear: () => setHasPictureOnly(false) });
    }

    for (const grade of [...selectedGrades].sort((a, b) => a.localeCompare(b))) {
      chips.push({
        key: `grade-${grade}`,
        label: `Grade: ${grade}`,
        clear: () => {
          const next = new Set(selectedGrades);
          next.delete(grade);
          setSelectedGrades(next);
        },
      });
    }

    for (const level of [...selectedCompetitionLevels].sort((a, b) => a - b)) {
      chips.push({
        key: `competition-${level}`,
        label: COMPETITION_LEVEL_LABELS[level as 0 | 1 | 2 | 3],
        clear: () => {
          const next = new Set(selectedCompetitionLevels);
          next.delete(level);
          setSelectedCompetitionLevels(next);
        },
      });
    }

    return chips;
  }, [
    selectedBrandValues,
    selectedCategoryValues,
    keyword,
    market,
    inStockOnly,
    hasPictureOnly,
    selectedGrades,
    selectedCompetitionLevels,
    isCompactVersion,
    decodedRouteBrand,
  ]);

  const searchPlaceholder = hasLoadedTotalProducts
    ? `Search EAN, Title, MPN of ${totalProducts.toLocaleString()} products`
    : 'Search EAN, Title, MPN';

  useEffect(() => {
    const inputFocused = typeof document !== 'undefined' && document.activeElement === searchInputRef.current;
    if (!inputFocused) {
      setSuggestionsOpen(false);
      setSuggestionsLoading(false);
      return;
    }

    if (suppressNextSuggestRef.current) {
      suppressNextSuggestRef.current = false;
      return;
    }

    const query = keyword.trim();
    if (query.length < 2) {
      setSearchSuggestions([]);
      setSuggestionsLoading(false);
      setSuggestionsOpen(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    const queryLower = query.toLowerCase();
    const localBrandStartsWith = availableBrandOptions
      .filter((brand) => brand.toLowerCase().startsWith(queryLower))
      .slice(0, 4)
      .map((brand) => ({ type: 'brand' as const, value: brand, label: brand, hitCount: 0 }));
    const localCategoryStartsWith = availableCategoryOptions
      .map((item) => item.name)
      .filter((category) => category.toLowerCase().startsWith(queryLower))
      .slice(0, 3)
      .map((category) => ({ type: 'category' as const, value: category, label: category, hitCount: 0 }));

    const localKeywordStartsWith = products
      .map((product) => product.title)
      .filter((title): title is string => Boolean(title && title.trim()))
      .filter((title) => title.toLowerCase().startsWith(queryLower))
      .filter((title, index, all) => all.findIndex((item) => item.toLowerCase() === title.toLowerCase()) === index)
      .slice(0, 3)
      .map((title) => ({ type: 'keyword' as const, value: title, label: title, hitCount: 0 }));

    const localEanStartsWith = products
      .map((product) => product.ean)
      .filter((ean) => ean.toLowerCase().startsWith(queryLower))
      .filter((ean, index, all) => all.indexOf(ean) === index)
      .slice(0, 2)
      .map((ean) => ({ type: 'ean' as const, value: ean, label: ean, hitCount: 0 }));

    const localSuggestionsSeed: SearchSuggestion[] = [
      { type: 'keyword', value: query, label: query, hitCount: 0 },
      ...localBrandStartsWith,
      ...localCategoryStartsWith,
      ...localKeywordStartsWith,
      ...localEanStartsWith,
    ];

    const seenLocal = new Set<string>();
    const localSuggestions: SearchSuggestion[] = [];
    for (const item of localSuggestionsSeed) {
      const key = `${item.type}:${item.value.toUpperCase()}`;
      if (seenLocal.has(key)) continue;
      seenLocal.add(key);
      localSuggestions.push(item);
      if (localSuggestions.length >= 8) break;
    }

    setSearchSuggestions(localSuggestions);
    setSuggestionsOpen(true);
    setActiveSuggestionIndex(localSuggestions.length > 0 ? 0 : -1);

    const requestId = latestSuggestRequestRef.current + 1;
    latestSuggestRequestRef.current = requestId;
    setSuggestionsLoading(true);

    const timer = setTimeout(() => {
      const mergeSuggestions = (base: SearchSuggestion[], incoming: SearchSuggestion[], cap: number) => {
        const seen = new Set(base.map((item) => `${item.type}:${item.value.toUpperCase()}`));
        return [
          ...base,
          ...incoming.filter((item) => {
            const key = `${item.type}:${item.value.toUpperCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }),
        ].slice(0, cap);
      };

      getSearchSuggestions(query, {
        market,
        inStock: inStockOnly,
        hasImage: hasPictureOnly,
        limit: 8,
        types: ['brand', 'category'],
      })
        .then((firstPass) => {
          if (latestSuggestRequestRef.current !== requestId) return;
          const firstMerged = mergeSuggestions(localSuggestions, firstPass.suggestions, 10);
          setSearchSuggestions(firstMerged);
          setSuggestionsOpen(firstMerged.length > 0);
          setActiveSuggestionIndex(firstMerged.length > 0 ? 0 : -1);
          setSuggestionsLoading(false);

          void getSearchSuggestions(query, {
            market,
            inStock: inStockOnly,
            hasImage: hasPictureOnly,
            limit: 8,
            types: ['keyword', 'ean'],
          })
            .then((secondPass) => {
              if (latestSuggestRequestRef.current !== requestId) return;
              const secondMerged = mergeSuggestions(firstMerged, secondPass.suggestions, 12);
              setSearchSuggestions(secondMerged);
              setSuggestionsOpen(secondMerged.length > 0);
              setActiveSuggestionIndex((prev) => (prev >= 0 ? prev : secondMerged.length > 0 ? 0 : -1));
            })
            .catch(() => {
              // Keep first-pass suggestions if second pass fails.
            });
        })
        .catch(() => {
          if (latestSuggestRequestRef.current !== requestId) return;
          setSearchSuggestions(localSuggestions);
          setSuggestionsOpen(localSuggestions.length > 0);
          setActiveSuggestionIndex(localSuggestions.length > 0 ? 0 : -1);
          setSuggestionsLoading(false);
        });
    }, 60);

    return () => clearTimeout(timer);
  }, [keyword, market, inStockOnly, hasPictureOnly, availableBrandOptions, availableCategoryOptions, products]);

  const applySuggestion = (suggestion: SearchSuggestion) => {
    suppressNextSuggestRef.current = true;
    if (suggestion.type === 'brand') {
      setSelectedBrand(joinFilterValues([...selectedBrandValues, suggestion.value]));
      setKeyword('');
    } else if (suggestion.type === 'category') {
      setSelectedCategory(joinFilterValues([...selectedCategoryValues, suggestion.value]));
      setKeyword('');
    } else {
      setKeyword(suggestion.value);
    }
    setSearchSuggestions([]);
    setSuggestionsOpen(false);
    setSuggestionsLoading(false);
    setActiveSuggestionIndex(-1);
    searchInputRef.current?.blur();
  };

  const suggestionTypeLabel: Record<SearchSuggestion['type'], string> = {
    brand: 'Brand',
    category: 'Category',
    keyword: 'Search',
    ean: 'EAN',
  };

  if (isCompactVersion) {
    return (
      <>
        <div className="min-h-screen bg-[hsl(220_18%_97%)]">
          <div className="sticky top-0 z-40 border-b border-[hsl(220_14%_91%)] bg-[hsl(220_18%_97%)]/95 backdrop-blur-sm">
            <div className="mx-auto w-full max-w-[1760px] px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={goToHomeFrontPage}
                  className="inline-flex h-9 shrink-0 items-center px-0.5"
                >
                  <img
                    src="/marketing/logo-ean.png"
                    alt="EANrunner"
                    className="h-6 w-auto object-contain"
                  />
                </button>

                <div
                  ref={searchBoxRef}
                  className={`relative flex min-h-9 flex-1 flex-wrap items-center gap-1 rounded-lg border border-[hsl(220_14%_89%)] bg-white px-2 py-1 ${
                    isMobileViewport ? 'order-2 basis-full min-w-0' : 'min-w-[260px]'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center">
                    <Search className="h-3.5 w-3.5 shrink-0 text-[hsl(220_12%_55%)]" />
                    <input
                      ref={searchInputRef}
                      type="search"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      onFocus={() => {
                        if (searchSuggestions.length > 0 || suggestionsLoading) {
                          setSuggestionsOpen(true);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (!suggestionsOpen && searchSuggestions.length > 0 && event.key === 'ArrowDown') {
                          event.preventDefault();
                          setSuggestionsOpen(true);
                          setActiveSuggestionIndex(0);
                          return;
                        }
                        if (!suggestionsOpen || searchSuggestions.length === 0) return;
                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          setActiveSuggestionIndex((index) => Math.min(index + 1, searchSuggestions.length - 1));
                        } else if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          setActiveSuggestionIndex((index) => Math.max(index - 1, 0));
                        } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
                          event.preventDefault();
                          const selected = searchSuggestions[activeSuggestionIndex];
                          if (selected) applySuggestion(selected);
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          setSuggestionsOpen(false);
                          setActiveSuggestionIndex(-1);
                        }
                      }}
                      placeholder={searchPlaceholder}
                      className="h-7 min-w-0 flex-1 border-0 bg-transparent px-2 text-xs text-[hsl(222_47%_8%)] placeholder:text-[hsl(220_12%_60%)] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((v) => !v)}
                    className={`inline-flex h-7 shrink-0 items-center rounded-md border px-2 text-[11px] font-semibold transition-colors ${
                      filtersOpen
                        ? 'border-[hsl(221_72%_72%)] bg-[hsl(221_84%_95%)] text-[hsl(221_72%_32%)]'
                        : 'border-[hsl(220_16%_84%)] bg-white text-[hsl(222_47%_20%)] hover:bg-[hsl(220_18%_95%)]'
                    }`}
                  >
                    <Filter className="mr-1 h-3 w-3" />
                    Filters
                  </button>
                  {!isMobileViewport && (
                    <div className="inline-flex h-7 shrink-0 items-center overflow-hidden rounded-md border border-[hsl(220_16%_84%)] bg-white">
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={`h-full px-2 text-[10px] font-semibold ${
                          viewMode === 'grid'
                            ? 'bg-[hsl(221_84%_95%)] text-[hsl(221_72%_32%)]'
                            : 'text-[hsl(220_12%_45%)] hover:bg-[hsl(220_18%_95%)]'
                        }`}
                      >
                        Pictures
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`h-full border-l border-[hsl(220_16%_84%)] px-2 text-[10px] font-semibold ${
                          viewMode === 'list'
                            ? 'bg-[hsl(221_84%_95%)] text-[hsl(221_72%_32%)]'
                            : 'text-[hsl(220_12%_45%)] hover:bg-[hsl(220_18%_95%)]'
                        }`}
                      >
                        List
                      </button>
                    </div>
                  )}
                  {loading ? (
                    <span className="inline-flex h-7 shrink-0 items-center rounded-md border border-[hsl(221_72%_72%)] bg-[hsl(221_84%_95%)] px-2 text-[10px] font-semibold text-[hsl(221_72%_32%)]">
                      Loading results...
                    </span>
                  ) : null}

                  {suggestionsOpen && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-[hsl(220_16%_84%)] bg-white shadow-[0_10px_28px_rgb(18_32_74/0.16)]">
                      {searchSuggestions.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-[hsl(220_12%_46%)]">No suggestions yet</div>
                      ) : (
                        <div className="max-h-72 overflow-y-auto py-1">
                          {searchSuggestions.map((suggestion, index) => (
                            <button
                              key={`${suggestion.type}:${suggestion.value}:${index}`}
                              type="button"
                              onPointerDown={(event) => {
                                event.preventDefault();
                                applySuggestion(suggestion);
                              }}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${
                                index === activeSuggestionIndex
                                  ? 'bg-[hsl(221_84%_95%)] text-[hsl(221_72%_24%)]'
                                  : 'text-[hsl(222_47%_16%)] hover:bg-[hsl(220_18%_96%)]'
                              }`}
                            >
                              <span className="inline-flex shrink-0 rounded-md border border-[hsl(220_16%_84%)] bg-[hsl(220_18%_98%)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[hsl(220_12%_44%)]">
                                {suggestionTypeLabel[suggestion.type]}
                              </span>
                              <span className="min-w-0 flex-1 truncate">{suggestion.label}</span>
                              {suggestion.hitCount > 0 ? (
                                <span className="shrink-0 text-[10px] text-[hsl(220_12%_50%)]">{suggestion.hitCount}</span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      )}
                      {suggestionsLoading ? (
                        <div className="border-t border-[hsl(220_16%_90%)] px-3 py-1.5 text-[10px] text-[hsl(220_12%_46%)]">Loading more suggestions...</div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className={`flex shrink-0 flex-wrap items-center gap-1.5 text-xs text-[hsl(220_12%_50%)] ${isMobileViewport ? 'order-1 ml-auto' : ''}`}>
                  {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin text-[hsl(220_16%_40%)]" /> : null}
                  {!isMobileViewport && (
                    <a
                      href="https://app.eanrunner.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center rounded-lg border border-[hsl(220_16%_84%)] bg-white px-3 text-xs font-semibold text-[hsl(222_47%_20%)] hover:bg-[hsl(220_18%_95%)]"
                    >
                      Login
                    </a>
                  )}
                  <div className="relative" ref={menuRef}>
                    <button
                      type="button"
                      onClick={() => setMenuOpen((v) => !v)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[hsl(220_16%_84%)] bg-white text-[hsl(222_47%_20%)] hover:bg-[hsl(220_18%_95%)]"
                      aria-label="Open menu"
                      title="Menu"
                    >
                      <Menu className="h-4 w-4" />
                    </button>

                    {menuOpen && (
                      <div className="absolute right-0 top-11 z-50 w-[296px] rounded-xl border border-[hsl(220_16%_84%)] bg-white p-4 shadow-[0_12px_30px_rgb(18_32_74/0.18)]">
                        <div className="space-y-4 text-[13px] text-[hsl(222_47%_18%)]">
                          {isMobileViewport && (
                            <section>
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_46%)]">Account</p>
                              <a
                                href="https://app.eanrunner.com/"
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center rounded-md border border-[hsl(220_16%_84%)] bg-[hsl(220_18%_98%)] px-2.5 py-1 text-[12px] font-semibold text-[hsl(222_47%_20%)] hover:bg-[hsl(220_18%_95%)]"
                                onClick={() => setMenuOpen(false)}
                              >
                                Login
                              </a>
                            </section>
                          )}
                          <section>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_46%)]">Explore</p>
                            <div className="flex flex-col gap-1 text-[13px] leading-6">
                              <Link to="/for-retailers" className="hover:underline" onClick={() => setMenuOpen(false)}>For Retailers</Link>
                              <Link to="/for-distributors" className="hover:underline" onClick={() => setMenuOpen(false)}>For Distributors</Link>
                              <Link to="/about-us" className="hover:underline" onClick={() => setMenuOpen(false)}>About us</Link>
                              <Link to="/how-it-works" className="hover:underline" onClick={() => setMenuOpen(false)}>How it works</Link>
                              <Link to="/work-with-us" className="hover:underline" onClick={() => setMenuOpen(false)}>Small team. Big network.</Link>
                            </div>
                          </section>

                          <section className="border-t border-[hsl(220_14%_90%)] pt-3">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_46%)]">Company</p>
                            <div className="flex flex-col gap-0.5 text-[13px] leading-6 text-[hsl(220_14%_36%)]">
                              <p>EANrunner by Etaility AB</p>
                              <p>VAT SE559006389601</p>
                              <a href="mailto:info@eanrunner.com" className="font-medium text-[hsl(221_92%_42%)] hover:underline">info@eanrunner.com</a>
                            </div>
                          </section>

                          <section className="border-t border-[hsl(220_14%_90%)] pt-3">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_46%)]">Follow</p>
                            <a href="https://www.linkedin.com/company/eanrunner" target="_blank" rel="noreferrer" className="text-[13px] leading-6 hover:underline">LinkedIn</a>
                          </section>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {activeFilterChips.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {activeFilterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.clear}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[hsl(220_16%_84%)] bg-[hsl(220_18%_98%)] px-2 text-[11px] font-semibold text-[hsl(220_24%_24%)] hover:bg-[hsl(221_80%_96%)]"
                      title={`Remove ${chip.label} filter`}
                    >
                      <span className="max-w-[160px] truncate">{chip.label}</span>
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}

              {loading ? (
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[hsl(220_16%_90%)]">
                  <div className="catalog-loading-bar__indicator h-full w-1/3 rounded-full bg-[hsl(221_92%_55%)]" />
                </div>
              ) : null}
              {loading && wakingUp ? (
                <p className="mt-1.5 text-xs text-[hsl(220_16%_40%)]" role="status" aria-live="polite">
                  The catalogue is waking up — the first visit after a quiet spell can take up to a minute. Hang on.
                </p>
              ) : null}

            </div>

            {filtersOpen && (
              <div className="border-t border-[hsl(220_14%_91%)] bg-[hsl(220_18%_97%)]">
                <div className="mx-auto grid w-full max-w-[1760px] grid-cols-1 gap-3 px-4 py-3 lg:grid-cols-12">
                  <label className="space-y-1.5 lg:col-span-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)]">Market</span>
                    <select
                      value={market}
                      onChange={(e) => setMarket(e.target.value)}
                      className="w-full rounded-md border border-[hsl(220_14%_89%)] bg-white px-3 py-2 text-xs text-[hsl(222_47%_8%)]"
                    >
                      <option value="dk">DK</option>
                      <option value="se">SE</option>
                      <option value="fi">FI</option>
                    </select>
                  </label>

                  <label className="space-y-1.5 lg:col-span-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)]">Category</span>
                    <input
                      type="text"
                      value={categorySearchTerm}
                      onChange={(e) => setCategorySearchTerm(e.target.value)}
                      placeholder="Type to filter categories..."
                      className="w-full rounded-md border border-[hsl(220_14%_89%)] bg-white px-3 py-2 text-xs text-[hsl(222_47%_8%)] placeholder:text-[hsl(220_12%_60%)] focus:outline-none focus:ring-1 focus:ring-[hsl(221_92%_55%)]"
                    />
                    <div className="h-24 overflow-y-auto rounded-md border border-[hsl(220_14%_89%)] bg-white px-2 py-1.5">
                      {filteredCategoryOptions.map((item) => {
                        const checked = selectedCategoryValues.includes(item.name);
                        return (
                          <label key={item.name} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs text-[hsl(222_47%_8%)] hover:bg-[hsl(220_18%_96%)]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(selectedCategoryValues);
                                if (e.target.checked) next.add(item.name); else next.delete(item.name);
                                setSelectedCategory(joinFilterValues([...next]));
                              }}
                            />
                            <span className="truncate">{item.name}</span>
                          </label>
                        );
                      })}
                      {filteredCategoryOptions.length === 0 && (
                        <p className="px-1 py-1 text-[10px] text-[hsl(220_12%_50%)]">No matching categories</p>
                      )}
                    </div>
                    <p className="text-[9px] text-[hsl(220_12%_50%)]">Checked options use OR logic</p>
                  </label>

                  <label className="space-y-1.5 lg:col-span-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)]">Brand</span>
                    <input
                      type="text"
                      value={brandSearchTerm}
                      onChange={(e) => setBrandSearchTerm(e.target.value)}
                      placeholder="Type to filter brands..."
                      className="w-full rounded-md border border-[hsl(220_14%_89%)] bg-white px-3 py-2 text-xs text-[hsl(222_47%_8%)] placeholder:text-[hsl(220_12%_60%)] focus:outline-none focus:ring-1 focus:ring-[hsl(221_92%_55%)]"
                    />
                    <div className="h-24 overflow-y-auto rounded-md border border-[hsl(220_14%_89%)] bg-white px-2 py-1.5">
                      {filteredBrandOptions.map((brand) => {
                        const checked = selectedBrandValues.includes(brand);
                        return (
                          <label key={brand} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs text-[hsl(222_47%_8%)] hover:bg-[hsl(220_18%_96%)]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(selectedBrandValues);
                                if (e.target.checked) next.add(brand); else next.delete(brand);
                                setSelectedBrand(joinFilterValues([...next]));
                                if (decodedRouteBrand.trim()) {
                                  navigate('/');
                                }
                              }}
                            />
                            <span className="truncate">{brand}</span>
                          </label>
                        );
                      })}
                      {filteredBrandOptions.length === 0 && (
                        <p className="px-1 py-1 text-[10px] text-[hsl(220_12%_50%)]">No matching brands</p>
                      )}
                    </div>
                    <p className="text-[9px] text-[hsl(220_12%_50%)]">Checked options use OR logic</p>
                  </label>

                  <div className="flex flex-wrap items-end gap-2 lg:col-span-12">
                    <div className="flex w-full min-w-[260px] flex-col gap-2 sm:w-auto sm:min-w-[420px] sm:flex-row">
                      <label className="flex h-10 flex-1 items-center gap-2 rounded-md border border-[hsl(220_14%_89%)] bg-white px-3 text-xs font-medium text-[hsl(222_47%_8%)]">
                        <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
                        In stock only
                      </label>

                      <label className="flex h-10 flex-1 items-center gap-2 rounded-md border border-[hsl(220_14%_89%)] bg-white px-3 text-xs font-medium text-[hsl(222_47%_8%)]">
                        <input type="checkbox" checked={hasPictureOnly} onChange={(e) => setHasPictureOnly(e.target.checked)} />
                        Has picture
                      </label>
                    </div>

                    <div className="w-full rounded-md border border-[hsl(220_14%_89%)] bg-white px-3 py-2">
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)]">Margin grade</p>
                        {selectedGrades.size > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedGrades(new Set())}
                            className="text-[9px] font-medium text-[hsl(221_92%_55%)] hover:underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="mb-2 rounded-md border border-[hsl(221_60%_88%)] bg-[hsl(221_80%_97%)] px-3 py-2 text-xs text-[hsl(221_40%_35%)] space-y-1">
                        <p className="font-semibold text-[hsl(221_60%_30%)] text-[10px] uppercase tracking-wide">About this catalog</p>
                        <p>
                          Each product displays a margin grade estimated from cost versus the cheapest public market price.
                        </p>
                        <p className="font-medium">Margin indicators work like this:</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                          {[
                            { grade: 'A', label: 'Above 20%', bg: 'bg-emerald-100', text: 'text-emerald-800' },
                            { grade: 'B', label: '10-20%', bg: 'bg-blue-100', text: 'text-blue-800' },
                            { grade: 'C', label: '5-10%', bg: 'bg-yellow-100', text: 'text-yellow-800' },
                            { grade: 'D', label: '0-5%', bg: 'bg-orange-100', text: 'text-orange-800' },
                            { grade: 'E', label: 'Loss 0-10%', bg: 'bg-red-100', text: 'text-red-800' },
                            { grade: 'F', label: 'Loss >10%', bg: 'bg-red-200', text: 'text-red-900' },
                          ].map(({ grade, label, bg, text }) => (
                            <span key={grade} className="inline-flex items-center gap-1">
                              <span className={`inline-block font-bold px-1.5 py-0.5 rounded text-[10px] ${bg} ${text}`}>{grade}</span>
                              <span className="text-[hsl(220_12%_40%)]">{label}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(['A', 'B', 'C', 'D', 'E', 'F', 'N/A'] as const).map((g) => {
                          const styles = GRADE_STYLES[g];
                          const active = selectedGrades.has(g);
                          return (
                            <button
                              key={g}
                              type="button"
                              onClick={() => {
                                const next = new Set(selectedGrades);
                                if (active) next.delete(g); else next.add(g);
                                setSelectedGrades(next);
                              }}
                              className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${
                                active
                                  ? `${styles.bg} ${styles.text} border-transparent ring-1 ring-offset-1 ring-current`
                                  : 'bg-white text-[hsl(220_12%_50%)] border-[hsl(220_14%_85%)] hover:border-[hsl(220_14%_65%)]'
                              }`}
                            >
                              {g}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="w-full rounded-md border border-[hsl(220_14%_89%)] bg-white px-3 py-2">
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)]">Competition</p>
                        {selectedCompetitionLevels.size > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedCompetitionLevels(new Set())}
                            className="text-[9px] font-medium text-[hsl(221_92%_55%)] hover:underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {([0, 1, 2, 3] as const).map((level) => {
                          const active = selectedCompetitionLevels.has(level);
                          return (
                            <button
                              key={level}
                              type="button"
                              onClick={() => {
                                const next = new Set(selectedCompetitionLevels);
                                if (active) next.delete(level); else next.add(level);
                                setSelectedCompetitionLevels(next);
                              }}
                              className={`inline-flex items-center justify-center whitespace-nowrap px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                                active
                                  ? 'bg-[hsl(221_80%_95%)] text-[hsl(221_92%_40%)] border-transparent ring-1 ring-offset-1 ring-[hsl(221_92%_55%)]'
                                  : 'bg-white text-[hsl(220_12%_50%)] border-[hsl(220_14%_85%)] hover:border-[hsl(220_14%_65%)]'
                              }`}
                            >
                              {COMPETITION_LEVEL_LABELS[level]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="ml-auto flex items-end gap-2">
                      <button
                        type="button"
                        className="inline-flex h-10 items-center rounded-md bg-[hsl(221_92%_55%)] px-4 text-xs font-semibold text-white hover:brightness-95"
                        onClick={() => setFiltersOpen(false)}
                      >
                        Hide filters
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-10 items-center rounded-md border border-[hsl(220_14%_80%)] bg-white px-4 text-xs font-semibold text-[hsl(222_47%_12%)] hover:bg-[hsl(220_18%_95%)]"
                        onClick={() => {
                          setSelectedCategory('');
                          setBrandFilter('');
                          setKeyword('');
                          setMarket('dk');
                          setInStockOnly(true);
                          setHasPictureOnly(false);
                          setSelectedGrades(new Set());
                          setSelectedCompetitionLevels(new Set());
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mx-auto w-full max-w-[1760px] px-4 py-4 space-y-4">
            {error && (
              <div className="mb-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {shouldClusterByBrand ? (
              <div className="space-y-4">
                {!loading && brandGroups.length === 0 && !error && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Search className="w-10 h-10 text-[hsl(220_12%_70%)] mb-3" />
                    <p className="text-sm font-medium text-[hsl(222_47%_8%)]">No products found</p>
                    <p className="text-xs text-[hsl(220_12%_40%)] mt-1">
                      {selectedCategory || keyword ? 'Try adjusting your filters' : 'Select a category or search by keyword'}
                    </p>
                  </div>
                )}

                {showIntroCard && isMobileViewport && (
                  <article className="relative min-h-[320px] overflow-hidden rounded-lg border border-[hsl(221_70%_24%)] p-4 text-white shadow-[0_8px_24px_rgb(10_24_64/0.28)]">
                    <div
                      className="absolute inset-0"
                      aria-hidden="true"
                      style={{
                        backgroundImage: [
                          'linear-gradient(135deg, hsl(225 92% 16%) 0%, hsl(228 88% 14%) 45%, hsl(233 78% 23%) 100%)',
                          'radial-gradient(120% 100% at 88% -8%, rgba(72, 96, 255, 0.28) 0%, rgba(72, 96, 255, 0) 58%)',
                          'repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, rgba(255,255,255,0) 1px 28px)',
                        ].join(','),
                      }}
                    />
                    <div className="intro-bigmark" aria-hidden="true">
                      <span className="intro-bigmark__bar intro-bigmark__bar--1" />
                      <span className="intro-bigmark__bar intro-bigmark__bar--2" />
                      <span className="intro-bigmark__bar intro-bigmark__bar--3" />
                    </div>
                    <div className="relative z-10 flex h-full flex-col">
                      <button
                        type="button"
                        onClick={() => setShowIntroCard(false)}
                        className="absolute right-0 top-0 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white hover:bg-white/20"
                        aria-label="Close introduction"
                        title="Close"
                      >
                        <X className="h-3 w-3" />
                      </button>

                      <img
                        src="/marketing/logo-ean.png"
                        alt="EANrunner"
                        className="h-6 w-auto self-start object-contain brightness-0 invert"
                      />

                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9bb8ff]">Product data platform</p>
                      <p className="mt-2 text-[19px] font-bold leading-[1.06] text-white sm:text-[24px] xl:text-[26px]">
                        All supplier products,
                        <br />
                        one catalog,
                        <br />
                        <span className="text-[#a8caff]">priced for your market</span>
                      </p>
                      <p className="mt-3 max-w-[34ch] text-[12px] leading-relaxed text-white/80 sm:text-[13px]">
                        Consolidated product data from European distributors, enriched,
                        translated, and priced for your market, ready for your webshop.
                      </p>
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                        <Link
                          to="/how-it-works"
                          className="inline-flex items-center rounded-md border border-white/40 bg-white/10 px-2 py-1 text-[10px] font-semibold text-white hover:bg-white/20"
                        >
                          How it works
                        </Link>
                      </div>
                    </div>
                  </article>
                )}

                {brandGroups.map((group, groupIndex) => {
                  const isSecondLine = groupIndex === 1;
                  const showIntroTile = showIntroCard && !isMobileViewport && isSecondLine;
                  const previewLimit = showIntroTile
                    ? Math.min(6, compactBrandPreviewCount)
                    : compactBrandPreviewCount;
                  const introTileSpan = showIntroTile
                    ? Math.max(1, compactBrandPreviewCount - previewLimit)
                    : 0;
                  const introTile = showIntroTile ? (
                    <article
                      className="relative min-h-[320px] overflow-hidden rounded-lg border border-[hsl(221_70%_24%)] p-4 text-white shadow-[0_8px_24px_rgb(10_24_64/0.28)]"
                      style={{ gridColumn: `span ${introTileSpan} / span ${introTileSpan}` }}
                    >
                      <div
                        className="absolute inset-0"
                        aria-hidden="true"
                        style={{
                          backgroundImage: [
                            'linear-gradient(135deg, hsl(225 92% 16%) 0%, hsl(228 88% 14%) 45%, hsl(233 78% 23%) 100%)',
                            'radial-gradient(120% 100% at 88% -8%, rgba(72, 96, 255, 0.28) 0%, rgba(72, 96, 255, 0) 58%)',
                            'repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, rgba(255,255,255,0) 1px 28px)',
                          ].join(','),
                        }}
                      />
                      <div className="intro-bigmark" aria-hidden="true">
                        <span className="intro-bigmark__bar intro-bigmark__bar--1" />
                        <span className="intro-bigmark__bar intro-bigmark__bar--2" />
                        <span className="intro-bigmark__bar intro-bigmark__bar--3" />
                      </div>
                      <div className="relative z-10 flex h-full flex-col">
                        <button
                          type="button"
                          onClick={() => setShowIntroCard(false)}
                          className="absolute right-0 top-0 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white hover:bg-white/20"
                          aria-label="Close introduction"
                          title="Close"
                        >
                          <X className="h-3 w-3" />
                        </button>

                        <img
                          src="/marketing/logo-ean.png"
                          alt="EANrunner"
                          className="h-6 w-auto self-start object-contain brightness-0 invert"
                        />

                        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9bb8ff]">Product data platform</p>
                        <p className="mt-2 text-[19px] font-bold leading-[1.06] text-white sm:text-[24px] xl:text-[26px]">
                          All supplier products,
                          <br />
                          one catalog,
                          <br />
                          <span className="text-[#a8caff]">priced for your market</span>
                        </p>
                        <p className="mt-3 max-w-[34ch] text-[12px] leading-relaxed text-white/80 sm:text-[13px]">
                          Consolidated product data from European distributors, enriched,
                          translated, and priced for your market, ready for your webshop.
                        </p>
                        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                          <Link
                            to="/how-it-works"
                            className="inline-flex items-center rounded-md border border-white/40 bg-white/10 px-2 py-1 text-[10px] font-semibold text-white hover:bg-white/20"
                          >
                            How it works
                          </Link>
                        </div>
                      </div>
                    </article>
                  ) : null;
                  const mobileBrandRailItems = group.items.slice(0, mobileBrandRailProductCount);

                  return (
                  <section key={group.brand} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[hsl(220_14%_89%)] bg-white px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          className="block w-full truncate text-left text-sm font-semibold text-[hsl(222_47%_8%)] hover:text-[hsl(221_72%_32%)]"
                          onClick={() => {
                            setBrandFilter(group.brand);
                            setInStockOnly(false);
                            setHasPictureOnly(false);
                            setFiltersOpen(false);
                            setPage(1);
                          }}
                        >
                          {group.brand}{' '}
                          <span className="text-[11px] font-medium text-[hsl(220_12%_45%)]">
                            ({group.totalProducts.toLocaleString()} products)
                          </span>
                        </button>
                      </div>
                      {!isMobileViewport && (
                        <button
                          type="button"
                          className="inline-flex items-center rounded-md bg-[hsl(221_92%_55%)] px-3 py-1.5 text-[10px] font-semibold text-white hover:brightness-95"
                          onClick={() => {
                            setBrandFilter(group.brand);
                            setInStockOnly(false);
                            setHasPictureOnly(false);
                            setFiltersOpen(false);
                            setPage(1);
                          }}
                        >
                          See all products from {group.brand} here
                        </button>
                      )}
                    </div>
                    {isMobileViewport ? (
                      <div className="-mx-1 flex items-stretch snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1" aria-label={`${group.brand} products`}>
                        {mobileBrandRailItems.map((product, index) => (
                          <div key={product.ean} className="flex w-[156px] shrink-0 snap-start [&>div]:h-full [&>div]:w-full">
                            <ProductCard
                              product={product}
                              compact
                              eagerImage={groupIndex === 0 && index < ABOVE_THE_FOLD_PRIORITY_COUNT}
                            />
                          </div>
                        ))}
                        <div className="flex w-[156px] shrink-0 snap-start">
                          <button
                            type="button"
                            className="flex h-full w-full items-center justify-center rounded-lg border border-[hsl(221_72%_72%)] bg-[hsl(221_84%_95%)] px-3 text-center text-[11px] font-semibold text-[hsl(221_72%_32%)] hover:bg-[hsl(221_80%_92%)]"
                            onClick={() => {
                              setBrandFilter(group.brand);
                              setInStockOnly(false);
                              setHasPictureOnly(false);
                              setFiltersOpen(false);
                              setPage(1);
                            }}
                          >
                            See all products from {group.brand} here
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="grid gap-2"
                        style={{ gridTemplateColumns: `repeat(${compactBrandPreviewCount}, minmax(0, 1fr))` }}
                      >
                        {group.items.slice(0, previewLimit).map((product, index) => (
                          <ProductCard
                            key={product.ean}
                            product={product}
                            compact
                            eagerImage={groupIndex === 0 && index < ABOVE_THE_FOLD_PRIORITY_COUNT}
                          />
                        ))}
                        {introTile}
                      </div>
                    )}
                  </section>
                  );
                })}

                {brandGroups.length < brandClusterTotalBrands && (
                  <div className="space-y-2 pt-1 pb-2">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setBrandClusterOffset((v) => v + BRAND_CLUSTER_BRAND_BATCH)}
                        disabled={loading}
                        className="px-4 py-1.5 text-xs font-medium rounded-md border border-[hsl(220_12%_80%)] bg-white text-[hsl(222_47%_12%)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[hsl(221_60%_97%)] transition-colors"
                      >
                        {loading
                          ? 'Loading…'
                          : `Load ${BRAND_CLUSTER_BRAND_BATCH} more brands (${brandGroups.length.toLocaleString()} of ${brandClusterTotalBrands.toLocaleString()})`}
                      </button>
                    </div>

                    {brandGroups.length >= BRAND_CLUSTER_BRAND_BATCH && !isMobileViewport && (
                      <div className="rounded-lg border border-[hsl(220_16%_90%)] bg-[hsl(220_22%_98%)] px-3 py-2">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[hsl(220_12%_48%)]">
                          Browse brands directly
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {allBrandTagOptions.map((brand) => (
                            <button
                              key={brand}
                              type="button"
                              onClick={() => {
                                setBrandFilter(brand);
                                setFiltersOpen(false);
                              }}
                              className="inline-flex h-8 items-center rounded-full border border-[hsl(220_16%_84%)] bg-white px-3 text-[11px] font-medium text-[hsl(220_24%_24%)] hover:border-[hsl(221_72%_72%)] hover:bg-[hsl(221_84%_95%)] hover:text-[hsl(221_72%_32%)]"
                            >
                              {brand}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                {!loading && visibleProducts.length === 0 && !error && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Search className="w-10 h-10 text-[hsl(220_12%_70%)] mb-3" />
                    <p className="text-sm font-medium text-[hsl(222_47%_8%)]">No products found</p>
                    <p className="text-xs text-[hsl(220_12%_40%)] mt-1">
                      {selectedCategory || keyword ? 'Try adjusting your filters' : 'Select a category or search by keyword'}
                    </p>
                  </div>
                )}

                {viewMode === 'grid' ? (
                  <div className={`grid gap-2 ${isMobileViewport ? 'grid-cols-2' : '[grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]'}`}>
                    {visibleProducts.map((product, index) => (
                      <ProductCard
                        key={product.ean}
                        product={product}
                        compact
                        eagerImage={index < ABOVE_THE_FOLD_PRIORITY_COUNT}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-[hsl(220_14%_89%)] bg-white">
                    <table className="min-w-full text-left text-[12px] text-[hsl(222_47%_12%)]">
                      <thead className="bg-[hsl(220_20%_97%)] text-[10px] uppercase tracking-wide text-[hsl(220_12%_45%)]">
                        <tr>
                          <th className="px-3 py-2 font-semibold">EAN</th>
                          <th className="px-3 py-2 font-semibold">Brand</th>
                          <th className="px-3 py-2 font-semibold">Title</th>
                          <th className="px-3 py-2 font-semibold">Stock</th>
                          <th className="px-3 py-2 font-semibold">Competition</th>
                          <th className="px-3 py-2 font-semibold">Margin</th>
                          <th className="px-3 py-2 font-semibold">Market</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleProducts.map((product) => {
                          const level = competitionLevel(product.competitorCount);
                          const hot = competitionBadge(level);
                          const rangeLabel = marginRangeLabel(product.marginGrade, product.marketPrice, product.marketCurrency);
                          return (
                            <tr key={product.ean} className="border-t border-[hsl(220_14%_91%)] hover:bg-[hsl(220_22%_98%)]">
                              <td className="px-3 py-2 font-mono text-[11px]">{product.ean}</td>
                              <td className="px-3 py-2">{product.brand || '—'}</td>
                              <td className="max-w-[520px] px-3 py-2">
                                <Link to={`/product/${encodeURIComponent(product.ean)}`} className="line-clamp-1 hover:underline">
                                  {product.title}
                                </Link>
                              </td>
                              <td className="px-3 py-2">{product.stockStatus === 'in stock' ? '● In stock' : '🏭 Out'}</td>
                              <td className="px-3 py-2">
                                <span className={hot.chiliColor}>{'🌶'.repeat(hot.chiliCount)}</span>
                              </td>
                              <td className="px-3 py-2">{rangeLabel ?? 'Not available'}</td>
                              <td className="px-3 py-2">
                                {product.cheapestMarketLink ? (
                                  <a href={product.cheapestMarketLink} target="_blank" rel="noreferrer" className="font-medium text-[hsl(221_92%_45%)] hover:underline">
                                    {product.marketPrice != null
                                      ? (product.marketCurrency === 'DKK' || product.marketCurrency === 'SEK'
                                          ? `${Math.round(product.marketPrice)} kr`
                                          : `€${product.marketPrice.toFixed(0)}`)
                                      : 'Open'}
                                  </a>
                                ) : (
                                  <span className="text-[hsl(220_12%_50%)]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {totalProducts > pageSize && !shouldClusterByBrand && !(isCompactVersion && decodedRouteBrand.trim()) && (
              <div className="flex flex-col items-center justify-center gap-1.5 pt-2 pb-2">
                {visibleProducts.length < totalProducts && (
                  <button
                    type="button"
                    onClick={() => setListVisibleLimit((v) => v + LIST_LOAD_MORE_BATCH_SIZE)}
                    disabled={loading}
                    className="px-4 py-1.5 text-xs font-medium rounded-md border border-[hsl(220_12%_80%)] bg-white text-[hsl(222_47%_12%)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[hsl(221_60%_97%)] transition-colors"
                  >
                    {loading ? 'Loading…' : `Load ${LIST_LOAD_MORE_BATCH_SIZE} more`}
                  </button>
                )}
                <span className="text-xs text-[hsl(220_12%_45%)]">
                  Loaded {visibleProducts.length.toLocaleString()} of {totalProducts.toLocaleString()} products
                </span>
              </div>
            )}

            {isCompactVersion && decodedRouteBrand.trim() && visibleProducts.length < totalProducts && (
              <div className="flex items-center justify-center gap-3 pt-2 pb-2">
                <button
                  type="button"
                  onClick={() => setBrandVisibleLimit((v) => v + BRAND_PAGE_BATCH_SIZE)}
                  disabled={loading}
                  className="px-4 py-1.5 text-xs font-medium rounded-md border border-[hsl(220_12%_80%)] bg-white text-[hsl(222_47%_12%)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[hsl(221_60%_97%)] transition-colors"
                >
                  {loading ? 'Loading…' : `Load ${BRAND_PAGE_BATCH_SIZE} more (${visibleProducts.length.toLocaleString()} of ${totalProducts.toLocaleString()})`}
                </button>
              </div>
            )}

            <SiteFooter className="mt-10" />
          </div>
        </div>

      </>
    );
  }

  return null;
}


export default App;

