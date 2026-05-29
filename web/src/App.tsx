import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, Filter, Loader2, Search, X } from 'lucide-react';
import { getBrandClusters, getCategories, getProducts } from './api';
import type { BrandClusterGroup, CategoryEntry, PublicProduct } from './types';

const PAGE_SIZE = 48;
const MULTI_FILTER_PAGE_SIZE = 200;
const BRAND_PAGE_INITIAL_BATCH_SIZE = 60;
const BRAND_PAGE_BATCH_SIZE = 120;
const BRAND_CLUSTER_MIN_PRODUCTS = 9;
const BRAND_CLUSTER_BRAND_BATCH = 10;
const BRAND_CLUSTER_REQUEST_TIMEOUT_MS = 7000;
const FILTER_OPTIONS_CACHE_KEY = 'webversion.filter-options.cache';
const FILTER_OPTIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const URL_ALLOWED_GRADES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'N/A']);

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

function competitionBadge(level: 0 | 1 | 2 | 3): { label: string; chiliColor: string; chip: string } {
  switch (level) {
    case 0:
      return { label: 'No competition', chiliColor: 'text-emerald-600', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 1:
      return { label: 'Low competition', chiliColor: 'text-lime-600', chip: 'bg-lime-50 text-lime-700 border-lime-200' };
    case 2:
      return { label: 'Medium competition', chiliColor: 'text-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200' };
    default:
      return { label: 'High competition', chiliColor: 'text-red-600', chip: 'bg-red-50 text-red-700 border-red-200' };
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

function ProductCard({
  product,
  compact,
}: {
  product: PublicProduct;
  compact?: boolean;
}) {
  const grade = GRADE_STYLES[product.marginGrade] ?? GRADE_STYLES['N/A'];
  const rangeLabel = marginRangeLabel(product.marginGrade, product.marketPrice, product.marketCurrency);
  const level = competitionLevel(product.competitorCount);
  const hot = competitionBadge(level);
  const compactClass = compact ? 'rounded-lg' : 'rounded-xl';

  return (
    <div className={`bg-white ${compactClass} border border-[hsl(220_14%_89%)] shadow-[0_1px_3px_0_rgb(0_0_0/0.06)] overflow-hidden flex flex-col hover:shadow-md transition-shadow`}>
      <Link to={`/product/${encodeURIComponent(product.ean)}`} className="block">
        <div className={`aspect-square bg-white overflow-hidden relative ${compact ? 'max-h-[180px]' : ''}`}>
          <img
            src={product.image || PLACEHOLDER_IMAGE}
            alt={product.title}
            width={400}
            height={400}
            loading="lazy"
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
        <div className={`flex flex-wrap items-center ${compact ? 'gap-1' : 'gap-1.5'} text-[10px]`}>
          <span className={`inline-flex items-center gap-1 whitespace-nowrap px-1.5 py-0.5 rounded-full font-medium ${
            product.stockStatus === 'in stock'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${product.stockStatus === 'in stock' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {product.stockStatus === 'in stock' ? 'In stock' : 'Out of stock'}
          </span>
          <span className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap px-1.5 py-0.5 rounded-full border font-medium ${hot.chip}`}>
            <span className={`leading-none ${hot.chiliColor}`}>🌶</span>
            <span className="truncate">{hot.label}</span>
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
}

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
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
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
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [brandVisibleLimit, setBrandVisibleLimit] = useState(BRAND_PAGE_INITIAL_BATCH_SIZE);
  const [brandClusterGroups, setBrandClusterGroups] = useState<BrandClusterGroup[]>([]);
  const [brandClusterOffset, setBrandClusterOffset] = useState(0);
  const [brandClusterTotalBrands, setBrandClusterTotalBrands] = useState(0);
  const [disableBrandClusters, setDisableBrandClusters] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);
  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [brandsByCategory, setBrandsByCategory] = useState<Record<string, string[]>>({});
  const preBrandFilterStateRef = useRef<{ inStockOnly: boolean; hasPictureOnly: boolean } | null>(null);
  const hasHydratedFiltersFromUrlRef = useRef(false);
  const skipNextUrlWriteRef = useRef(false);
  const selectedCategoryValues = useMemo(() => splitFilterValues(selectedCategory), [selectedCategory]);
  const selectedBrandValues = useMemo(() => splitFilterValues(selectedBrand), [selectedBrand]);

  const compactPreviewPageSize = getCompactPageSizeForWidth(viewportWidth);
  const hasMultiFilterSelection = selectedCategoryValues.length > 1 || selectedBrandValues.length > 1;
  const defaultListPageSize = hasMultiFilterSelection ? MULTI_FILTER_PAGE_SIZE : PAGE_SIZE;
  const shouldUseCompactPreviewPageSize = isCompactVersion
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
  const shouldClusterByBrand = isCompactVersion
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
      setLoading(true);
      setError('');
      try {
        const normalizedKeyword = debouncedKeyword.trim();
        if (shouldClusterByBrand) {
          try {
            const clusterData = await withTimeout(
              getBrandClusters(
                normalizedKeyword,
                market,
                brandClusterOffset,
                BRAND_CLUSTER_BRAND_BATCH,
                compactBrandPreviewCount,
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
            setDisableBrandClusters(false);
            setBrandClusterGroups((prev) => (brandClusterOffset === 0 ? clusterData.brands : [...prev, ...clusterData.brands]));
            setBrandClusterTotalBrands(clusterData.totalBrands);
            setTotalProducts(clusterData.totalProducts);
            setProducts([]);
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
        const effectiveLimit = brandPageMode ? Math.max(brandVisibleLimit, BRAND_PAGE_INITIAL_BATCH_SIZE) : pageSize;
        const effectivePage = normalizedKeyword || brandPageMode ? 1 : page;
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
    shouldClusterByBrand,
    pageSize,
    compactBrandPreviewCount,
  ]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
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
      if (isCompactVersion && decodedRouteBrand.trim()) {
        const aHasImage = a.image ? 1 : 0;
        const bHasImage = b.image ? 1 : 0;
        if (aHasImage !== bHasImage) return bHasImage - aHasImage;
      }

      const aNa = a.marginGrade === 'N/A' ? 1 : 0;
      const bNa = b.marginGrade === 'N/A' ? 1 : 0;
      return aNa - bNa;
      })
        .slice(0, (isCompactVersion && decodedRouteBrand.trim()) ? brandVisibleLimit : pageSize);
      }, [products, selectedCompetitionLevels, debouncedKeyword, isCompactVersion, decodedRouteBrand, brandVisibleLimit, pageSize]);

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
    const categoriesToUse = selectedCategoryValues.length > 0
      ? selectedCategoryValues
      : availableCategoryOptions.map((item) => item.name);

    const brandsToMerge: string[] = [];
    for (const categoryName of categoriesToUse) {
      for (const brand of brandsByCategory[categoryName] ?? []) {
        brandsToMerge.push(brand);
      }
    }

    return getUniqueBrandLabels(brandsToMerge);
  }, [brandsByCategory, selectedCategoryValues, availableCategoryOptions]);

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
    if (inStockOnly) {
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
  }, [selectedBrandValues, selectedCategoryValues, keyword, market, inStockOnly, hasPictureOnly, selectedGrades, selectedCompetitionLevels]);

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
                  className="inline-flex h-9 items-center px-0.5"
                >
                  <img
                    src="https://www.eanrunner.com/sites/eanrunner.com/assets/img/logo-ean.png"
                    alt="EANrunner"
                    className="h-6 w-auto object-contain"
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setFiltersOpen((v) => !v)}
                  className={`inline-flex h-9 items-center rounded-lg border px-3 text-xs font-semibold transition-colors ${
                    filtersOpen
                      ? 'border-[hsl(221_72%_72%)] bg-[hsl(221_84%_95%)] text-[hsl(221_72%_32%)]'
                      : 'border-[hsl(220_16%_84%)] bg-white text-[hsl(222_47%_20%)] hover:bg-[hsl(220_18%_95%)]'
                  }`}
                >
                  <Filter className="mr-1.5 h-3.5 w-3.5" />
                  Filter
                </button>

                {activeFilterChips.length > 0 && (
                  <div className="flex h-9 min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-[hsl(220_16%_88%)] bg-white px-2.5">
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[hsl(220_12%_46%)]">
                      Current filters
                    </span>
                    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                      {activeFilterChips.map((chip) => (
                        <button
                          key={chip.key}
                          type="button"
                          onClick={chip.clear}
                          className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-[hsl(220_16%_84%)] bg-[hsl(220_18%_98%)] px-2 text-[11px] font-medium text-[hsl(220_24%_24%)] hover:bg-[hsl(221_80%_96%)]"
                          title={`Remove ${chip.label} filter`}
                        >
                          <span className="max-w-[160px] truncate">{chip.label}</span>
                          <X className="h-3 w-3" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="ml-auto flex flex-wrap items-center gap-1.5 text-xs text-[hsl(220_12%_50%)]">
                  <span className="inline-flex h-9 items-center px-1 text-[hsl(220_16%_40%)]">
                    {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                    {totalProducts.toLocaleString()} products
                  </span>
                  <Link
                    to="/about-us"
                    className="inline-flex h-9 items-center rounded-lg border border-[hsl(220_16%_84%)] bg-white px-3 text-xs font-semibold text-[hsl(222_47%_20%)] hover:bg-[hsl(220_18%_95%)]"
                  >
                    About us
                  </Link>
                </div>
              </div>

            </div>

            {filtersOpen && (
              <div className="border-t border-[hsl(220_14%_91%)] bg-[hsl(220_18%_97%)]">
                <div className="mx-auto grid w-full max-w-[1760px] grid-cols-1 gap-3 px-4 py-3 lg:grid-cols-12">
                  <label className="space-y-1.5 lg:col-span-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)]">Search</span>
                    <input
                      type="search"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="EAN, title, brand…"
                      className="w-full rounded-md border border-[hsl(220_14%_89%)] bg-white px-3 py-2 text-xs text-[hsl(222_47%_8%)] placeholder:text-[hsl(220_12%_60%)] focus:outline-none focus:ring-1 focus:ring-[hsl(221_92%_55%)]"
                    />
                  </label>

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

                {brandGroups.map((group) => (
                  <section key={group.brand} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[hsl(220_14%_89%)] bg-white px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[hsl(222_47%_8%)] truncate">{group.brand}</div>
                        <div className="text-[10px] text-[hsl(220_12%_50%)]">
                          Latest added: {group.latestUpdatedAt ? new Date(group.latestUpdatedAt).toLocaleString() : 'Unknown'} · {group.totalProducts.toLocaleString()} products
                        </div>
                      </div>
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
                    </div>
                    <div
                      className="grid gap-2"
                      style={{ gridTemplateColumns: `repeat(${compactBrandPreviewCount}, minmax(0, 1fr))` }}
                    >
                      {group.items.slice(0, compactBrandPreviewCount).map((product) => (
                        <ProductCard
                          key={product.ean}
                          product={product}
                          compact
                        />
                      ))}
                    </div>
                  </section>
                ))}

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

                    {brandGroups.length >= BRAND_CLUSTER_BRAND_BATCH && (
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

                <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
                  {visibleProducts.map((product) => (
                    <ProductCard
                      key={product.ean}
                      product={product}
                      compact
                    />
                  ))}
                </div>
              </>
            )}

            {totalProducts > pageSize && !loading && !shouldClusterByBrand && !(isCompactVersion && decodedRouteBrand.trim()) && (
              <div className="flex items-center justify-center gap-3 pt-2 pb-2">
                <button
                  type="button"
                  onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={page === 1}
                  className="px-4 py-1.5 text-xs font-medium rounded-md border border-[hsl(220_12%_80%)] bg-white text-[hsl(222_47%_12%)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[hsl(221_60%_97%)] transition-colors"
                >
                  ← Previous
                </button>
                <span className="text-xs text-[hsl(220_12%_45%)]">
                  Page {page} of {Math.ceil(totalProducts / pageSize)}
                </span>
                <button
                  type="button"
                  onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={page >= Math.ceil(totalProducts / pageSize)}
                  className="px-4 py-1.5 text-xs font-medium rounded-md border border-[hsl(220_12%_80%)] bg-white text-[hsl(222_47%_12%)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[hsl(221_60%_97%)] transition-colors"
                >
                  Next →
                </button>
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
          </div>
        </div>

      </>
    );
  }

  return null;
}


export default App;

