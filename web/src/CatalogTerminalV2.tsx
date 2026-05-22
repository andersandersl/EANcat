import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownUp, Command, Loader2, Search } from 'lucide-react';
import { getCategories, getProducts } from './api';
import type { CategoryEntry, PublicProduct } from './types';
import { useAuth } from './auth-context';
import LoginArea from './components/LoginArea';
import RequestSupplierModal from './components/RequestSupplierModal';
import './terminal-v2.css';

const PAGE_SIZE = 120;
const POLL_MS = 15000;
const LAYOUT_STORAGE_KEY = 'eanrunner.v2.layout';
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'%3E%3Crect width='56' height='56' fill='%23151b23'/%3E%3Cpath d='M8 40h40L36 24l-8 10-6-7-14 13z' fill='%23343d4d'/%3E%3C/svg%3E";

type SortKey = 'title' | 'brand' | 'stock' | 'suppliers' | 'margin' | 'competition' | 'marketPrice';
type SortDir = 'asc' | 'desc';
type SmartViewKey =
  | 'high-margin'
  | 'low-competition'
  | 'recently-restocked'
  | 'trending'
  | 'fast-movers'
  | 'new-listings'
  | 'market-gaps'
  | 'supplier-price-changes';
type ColumnKey =
  | 'thumbnail'
  | 'product'
  | 'brand'
  | 'market'
  | 'stock'
  | 'suppliers'
  | 'margin'
  | 'competition'
  | 'cheapestSupplier'
  | 'marketPrice';
type LayoutPresetKey = 'all' | 'pricing' | 'supply' | 'minimal';

type LayoutState = {
  dense: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  visibleColumns: Record<ColumnKey, boolean>;
  preset: LayoutPresetKey;
};

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  thumbnail: true,
  product: true,
  brand: true,
  market: true,
  stock: true,
  suppliers: true,
  margin: true,
  competition: true,
  cheapestSupplier: true,
  marketPrice: true,
};

const LAYOUT_PRESETS: Record<LayoutPresetKey, Record<ColumnKey, boolean>> = {
  all: { ...DEFAULT_COLUMNS },
  pricing: {
    thumbnail: false,
    product: true,
    brand: true,
    market: true,
    stock: false,
    suppliers: true,
    margin: true,
    competition: true,
    cheapestSupplier: true,
    marketPrice: true,
  },
  supply: {
    thumbnail: true,
    product: true,
    brand: true,
    market: true,
    stock: true,
    suppliers: true,
    margin: true,
    competition: false,
    cheapestSupplier: true,
    marketPrice: false,
  },
  minimal: {
    thumbnail: false,
    product: true,
    brand: true,
    market: true,
    stock: true,
    suppliers: false,
    margin: true,
    competition: false,
    cheapestSupplier: false,
    marketPrice: true,
  },
};

function readSavedLayout(): LayoutState | null {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LayoutState;
    return {
      dense: parsed.dense ?? true,
      sortKey: parsed.sortKey ?? 'margin',
      sortDir: parsed.sortDir ?? 'desc',
      preset: parsed.preset ?? 'all',
      visibleColumns: {
        ...DEFAULT_COLUMNS,
        ...(parsed.visibleColumns || {}),
      },
    };
  } catch {
    return null;
  }
}

function competitionLabel(count: number): string {
  if (count <= 0) return 'No';
  if (count === 1) return 'Low';
  if (count <= 3) return 'Medium';
  return 'High';
}

function marginScore(product: PublicProduct): number {
  if (product.actualMarginPercent != null) return product.actualMarginPercent;
  const rank: Record<string, number> = { A: 24, B: 16, C: 8, D: 3, E: -4, F: -12, 'N/A': -30 };
  return rank[product.marginGrade] ?? -30;
}

function stockScore(product: PublicProduct): number {
  return product.stockStatus === 'in stock' ? 1 : 0;
}

function cheapestSupplier(product: PublicProduct): string {
  const row = product.supplierRows?.[0];
  if (!row) return 'Hidden';
  return `${row.supplier} ${row.price.toFixed(2)} ${row.currency}`;
}

function applySmartView(items: PublicProduct[], key: SmartViewKey): PublicProduct[] {
  const copy = [...items];
  switch (key) {
    case 'high-margin':
      return copy.sort((a, b) => marginScore(b) - marginScore(a));
    case 'low-competition':
      return copy.sort((a, b) => (a.competitorCount - b.competitorCount) || (marginScore(b) - marginScore(a)));
    case 'recently-restocked':
      return copy
        .filter((p) => p.stockStatus === 'in stock')
        .sort((a, b) => (Date.parse(b.updatedAt || '0') - Date.parse(a.updatedAt || '0')));
    case 'trending':
      return copy.sort((a, b) => b.competitorCount - a.competitorCount);
    case 'fast-movers':
      return copy
        .filter((p) => p.stockStatus === 'in stock')
        .sort((a, b) => (b.competitorCount + marginScore(b)) - (a.competitorCount + marginScore(a)));
    case 'new-listings':
      return copy.sort((a, b) => Date.parse(b.updatedAt || '0') - Date.parse(a.updatedAt || '0'));
    case 'market-gaps':
      return copy
        .filter((p) => p.competitorCount === 0)
        .sort((a, b) => marginScore(b) - marginScore(a));
    case 'supplier-price-changes':
      return copy
        .filter((p) => p.actualMarginPercent != null)
        .sort((a, b) => Date.parse(b.updatedAt || '0') - Date.parse(a.updatedAt || '0'));
    default:
      return copy;
  }
}

function SmartViewTabs({
  active,
  onChange,
}: {
  active: SmartViewKey;
  onChange: (view: SmartViewKey) => void;
}) {
  const views: Array<{ key: SmartViewKey; label: string }> = [
    { key: 'high-margin', label: 'High Margin Opportunities' },
    { key: 'low-competition', label: 'Low Competition Products' },
    { key: 'recently-restocked', label: 'Recently Restocked' },
    { key: 'trending', label: 'Trending Products' },
    { key: 'fast-movers', label: 'Fast Movers' },
    { key: 'new-listings', label: 'New Distributor Listings' },
    { key: 'market-gaps', label: 'Market Gaps' },
    { key: 'supplier-price-changes', label: 'Supplier Price Changes' },
  ];

  return (
    <div className="v2-tabs" role="tablist" aria-label="Smart views">
      {views.map((view) => (
        <button
          key={view.key}
          type="button"
          role="tab"
          aria-selected={active === view.key}
          className={`v2-tab ${active === view.key ? 'is-active' : ''}`}
          onClick={() => onChange(view.key)}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

function CommandPalette({
  open,
  query,
  onQuery,
  onClose,
  onRun,
}: {
  open: boolean;
  query: string;
  onQuery: (value: string) => void;
  onClose: () => void;
  onRun: (command: string) => void;
}) {
  if (!open) return null;
  const options = [
    'view: high-margin',
    'view: low-competition',
    'view: recently-restocked',
    'view: trending',
    'view: fast-movers',
    'view: new-listings',
    'view: market-gaps',
    'view: supplier-price-changes',
    'bulk: select-all',
    'bulk: clear-selection',
    'bulk: export-csv',
  ].filter((item) => item.includes(query.toLowerCase()));

  return (
    <div className="v2-palette-backdrop" onClick={onClose}>
      <div className="v2-palette" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="v2-palette-input-wrap">
          <Command size={14} />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Type a command..."
            autoFocus
          />
        </div>
        <div className="v2-palette-list">
          {options.map((option) => (
            <button key={option} type="button" onClick={() => onRun(option)} className="v2-palette-option">
              {option}
            </button>
          ))}
          {options.length === 0 && <div className="v2-palette-empty">No commands</div>}
        </div>
      </div>
    </div>
  );
}

export default function CatalogTerminalV2() {
  const navigate = useNavigate();
  const { user, idToken, approvedAccount, loading: authLoading } = useAuth();
  const hasSupplierAccess = (approvedAccount?.allowedSuppliers?.length || 0) > 0 || approvedAccount?.isSuperAdmin === true;
  const savedLayout = useMemo(() => readSavedLayout(), []);

  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [category, setCategory] = useState('');
  const [market, setMarket] = useState('dk');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [smartView, setSmartView] = useState<SmartViewKey>('high-margin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>(savedLayout?.sortKey || 'margin');
  const [sortDir, setSortDir] = useState<SortDir>(savedLayout?.sortDir || 'desc');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [anchorIndex, setAnchorIndex] = useState(0);
  const [dense, setDense] = useState(savedLayout?.dense ?? true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [modalEan, setModalEan] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [updatedEans, setUpdatedEans] = useState<Set<string>>(new Set());
  const [selectedEans, setSelectedEans] = useState<Set<string>>(new Set());
  const [preset, setPreset] = useState<LayoutPresetKey>(savedLayout?.preset || 'all');
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(
    savedLayout?.visibleColumns || { ...DEFAULT_COLUMNS },
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword.trim()), 120);
    return () => clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    const timer = setInterval(() => setRefreshTick((tick) => tick + 1), POLL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    getCategories(idToken)
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, [idToken]);

  useEffect(() => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({ dense, sortKey, sortDir, visibleColumns, preset } satisfies LayoutState),
    );
  }, [dense, sortKey, sortDir, visibleColumns, preset]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (authLoading) return;
      if (user && hasSupplierAccess && !idToken) return;
      setLoading(true);
      setError('');
      try {
        const data = await getProducts(
          debouncedKeyword,
          PAGE_SIZE,
          category || undefined,
          undefined,
          market,
          1,
          undefined,
          idToken,
          approvedAccount?.allowedSuppliers,
          approvedAccount?.email,
          undefined,
          undefined,
        );
        if (!active) return;
        setProducts((prev) => {
          const previousByEan = new Map(prev.map((item) => [item.ean, item]));
          const changed = new Set<string>();
          for (const item of data.products) {
            const previous = previousByEan.get(item.ean);
            if (!previous) continue;
            if (
              previous.stockStatus !== item.stockStatus
              || previous.marketPrice !== item.marketPrice
              || previous.marginGrade !== item.marginGrade
              || previous.actualMarginPercent !== item.actualMarginPercent
            ) {
              changed.add(item.ean);
            }
          }
          if (changed.size > 0) {
            setUpdatedEans(changed);
            setTimeout(() => setUpdatedEans(new Set()), 2200);
          }
          return data.products;
        });
        setTotalProducts(data.total ?? data.count);
        setLastUpdate(new Date());
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load products');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [
    authLoading,
    user,
    hasSupplierAccess,
    idToken,
    approvedAccount?.allowedSuppliers,
    approvedAccount?.email,
    debouncedKeyword,
    category,
    market,
    refreshTick,
  ]);

  const displayed = useMemo(() => {
    const withView = applySmartView(products, smartView);
    const sorted = [...withView].sort((a, b) => {
      const sign = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'title': return sign * a.title.localeCompare(b.title);
        case 'brand': return sign * a.brand.localeCompare(b.brand);
        case 'stock': return sign * (stockScore(a) - stockScore(b));
        case 'suppliers': return sign * ((a.supplierRows?.length || 0) - (b.supplierRows?.length || 0));
        case 'margin': return sign * (marginScore(a) - marginScore(b));
        case 'competition': return sign * (a.competitorCount - b.competitorCount);
        case 'marketPrice': return sign * ((a.marketPrice || 0) - (b.marketPrice || 0));
        default: return 0;
      }
    });
    return sorted;
  }, [products, smartView, sortDir, sortKey]);

  useEffect(() => {
    if (selectedIndex >= displayed.length) {
      setSelectedIndex(Math.max(0, displayed.length - 1));
    }
  }, [selectedIndex, displayed.length]);

  useEffect(() => {
    const visible = new Set(displayed.map((item) => item.ean));
    setSelectedEans((prev) => new Set([...prev].filter((ean) => visible.has(ean))));
  }, [displayed]);

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDir('desc');
  }

  function setPresetLayout(nextPreset: LayoutPresetKey) {
    setPreset(nextPreset);
    setVisibleColumns({ ...LAYOUT_PRESETS[nextPreset] });
  }

  function toggleRowSelected(ean: string) {
    setSelectedEans((prev) => {
      const next = new Set(prev);
      if (next.has(ean)) next.delete(ean);
      else next.add(ean);
      return next;
    });
  }

  function toggleColumn(column: ColumnKey) {
    setPreset('all');
    setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  }

  function runCommand(command: string) {
    const map: Record<string, SmartViewKey> = {
      'view: high-margin': 'high-margin',
      'view: low-competition': 'low-competition',
      'view: recently-restocked': 'recently-restocked',
      'view: trending': 'trending',
      'view: fast-movers': 'fast-movers',
      'view: new-listings': 'new-listings',
      'view: market-gaps': 'market-gaps',
      'view: supplier-price-changes': 'supplier-price-changes',
    };
    const view = map[command];
    if (view) setSmartView(view);
    if (command === 'bulk: select-all') {
      setSelectedEans(new Set(displayed.map((item) => item.ean)));
    }
    if (command === 'bulk: clear-selection') {
      setSelectedEans(new Set());
    }
    if (command === 'bulk: export-csv') {
      exportSelectionCsv();
    }
    setPaletteOpen(false);
    setPaletteQuery('');
  }

  function exportSelectionCsv() {
    const selectedRows = displayed.filter((item) => selectedEans.has(item.ean));
    if (selectedRows.length === 0) return;
    const header = ['ean', 'title', 'brand', 'stock', 'suppliers', 'margin', 'competition', 'market_price'];
    const lines = selectedRows.map((item) => {
      const margin = item.actualMarginPercent != null ? item.actualMarginPercent.toFixed(1) : item.marginGrade;
      const marketPrice = item.marketPrice != null ? String(item.marketPrice) : '';
      return [
        item.ean,
        item.title.replaceAll(',', ' '),
        item.brand.replaceAll(',', ' '),
        item.stockStatus,
        String(item.supplierRows?.length || 0),
        margin,
        String(item.competitorCount),
        marketPrice,
      ].join(',');
    });
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eanrunner-selected-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelectedEans(new Set(displayed.map((item) => item.ean)));
        return;
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false);
        setPaletteQuery('');
        setModalEan(null);
        return;
      }
      if (paletteOpen || isTyping) return;

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        setSelectedIndex((idx) => {
          const next = Math.max(0, Math.min(displayed.length - 1, idx + delta));
          if (event.shiftKey) {
            const start = Math.min(anchorIndex, next);
            const end = Math.max(anchorIndex, next);
            const rangeEans = displayed.slice(start, end + 1).map((item) => item.ean);
            setSelectedEans(new Set(rangeEans));
          } else {
            setAnchorIndex(next);
          }
          return next;
        });
        return;
      }

      if (event.key === ' ' || event.key.toLowerCase() === 'x') {
        event.preventDefault();
        const item = displayed[selectedIndex];
        if (item) toggleRowSelected(item.ean);
        return;
      }

      if (event.key === 'Enter') {
        const item = displayed[selectedIndex];
        if (item) navigate(`/product/${encodeURIComponent(item.ean)}`);
        return;
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        setSelectedEans(new Set());
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [displayed, selectedIndex, navigate, paletteOpen, anchorIndex]);

  const selectedProduct = displayed[selectedIndex] || null;
  const modalProduct = useMemo(
    () => (modalEan ? products.find((p) => p.ean === modalEan) || null : null),
    [products, modalEan],
  );
  const allVisibleSelected = displayed.length > 0 && displayed.every((item) => selectedEans.has(item.ean));

  return (
    <div className="v2-shell">
      <header className="v2-header">
        <div className="v2-title-wrap">
          <div className="v2-kicker">Commerce Intelligence Terminal</div>
          <h1>EANrunner 2.0</h1>
        </div>

        <div className="v2-header-actions">
          <Link to="/" className="v2-link">Open V1</Link>
          <Link to="/signup" className="v2-link">Register</Link>
          <LoginArea />
        </div>
      </header>

      <section className="v2-toolbar">
        <label className="v2-search">
          <Search size={14} />
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search EAN, product, brand" />
        </label>

        <select value={market} onChange={(e) => setMarket(e.target.value)}>
          <option value="dk">DK</option>
          <option value="se">SE</option>
          <option value="fi">FI</option>
        </select>

        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item.name} value={item.name}>{item.name}</option>
          ))}
        </select>

        <select value={preset} onChange={(e) => setPresetLayout(e.target.value as LayoutPresetKey)}>
          <option value="all">Preset: All columns</option>
          <option value="pricing">Preset: Pricing focus</option>
          <option value="supply">Preset: Supply focus</option>
          <option value="minimal">Preset: Minimal</option>
        </select>

        <button type="button" className="v2-outline" onClick={() => setDense((d) => !d)}>
          {dense ? 'Dense on' : 'Dense off'}
        </button>

        <button
          type="button"
          className="v2-outline"
          onClick={() => {
            setVisibleColumns({ ...DEFAULT_COLUMNS });
            setPreset('all');
          }}
        >
          Reset layout
        </button>

        <button type="button" className="v2-outline" onClick={() => setPaletteOpen(true)}>
          <Command size={13} />
          Cmd/Ctrl+K
        </button>

        <div className="v2-meta">
          {loading ? <Loader2 size={14} className="spin" /> : <span className="v2-dot" />}
          <span>{totalProducts.toLocaleString()} rows</span>
          <span>{lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Awaiting update'}</span>
        </div>
      </section>

      <div className="v2-column-toggles">
        {(Object.keys(DEFAULT_COLUMNS) as ColumnKey[]).map((column) => (
          <label key={column}>
            <input
              type="checkbox"
              checked={visibleColumns[column]}
              onChange={() => toggleColumn(column)}
            />
            <span>{column}</span>
          </label>
        ))}
      </div>

      <SmartViewTabs active={smartView} onChange={setSmartView} />

      {error && <div className="v2-error">{error}</div>}

      {selectedEans.size > 0 && (
        <div className="v2-bulkbar">
          <span>{selectedEans.size} selected</span>
          <button type="button" className="v2-outline" onClick={exportSelectionCsv}>Export CSV</button>
          <button type="button" className="v2-outline" onClick={() => setSelectedEans(new Set())}>Clear</button>
          {!hasSupplierAccess && (
            <button
              type="button"
              className="v2-primary"
              onClick={() => {
                const first = displayed.find((item) => selectedEans.has(item.ean));
                if (first) setModalEan(first.ean);
              }}
            >
              Request supplier for first selected
            </button>
          )}
        </div>
      )}

      <div className="v2-table-wrap">
        <table className={`v2-table ${dense ? 'is-dense' : ''}`}>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() => {
                    if (allVisibleSelected) {
                      setSelectedEans(new Set());
                    } else {
                      setSelectedEans(new Set(displayed.map((item) => item.ean)));
                    }
                  }}
                />
              </th>
              {visibleColumns.thumbnail && <th>Thumbnail</th>}
              {visibleColumns.product && <th><button type="button" onClick={() => toggleSort('title')}>Product <ArrowDownUp size={12} /></button></th>}
              {visibleColumns.brand && <th><button type="button" onClick={() => toggleSort('brand')}>Brand <ArrowDownUp size={12} /></button></th>}
              {visibleColumns.market && <th>Market</th>}
              {visibleColumns.stock && <th><button type="button" onClick={() => toggleSort('stock')}>Stock <ArrowDownUp size={12} /></button></th>}
              {visibleColumns.suppliers && <th><button type="button" onClick={() => toggleSort('suppliers')}>Suppliers <ArrowDownUp size={12} /></button></th>}
              {visibleColumns.margin && <th><button type="button" onClick={() => toggleSort('margin')}>Margin <ArrowDownUp size={12} /></button></th>}
              {visibleColumns.competition && <th><button type="button" onClick={() => toggleSort('competition')}>Competition <ArrowDownUp size={12} /></button></th>}
              {visibleColumns.cheapestSupplier && <th>Cheapest Supplier</th>}
              {visibleColumns.marketPrice && <th><button type="button" onClick={() => toggleSort('marketPrice')}>Market Price <ArrowDownUp size={12} /></button></th>}
            </tr>
          </thead>
          <tbody>
            {displayed.map((product, index) => {
              const isFocused = index === selectedIndex;
              const isMultiSelected = selectedEans.has(product.ean);
              const isUpdated = updatedEans.has(product.ean);
              const margin = product.actualMarginPercent != null
                ? `${product.actualMarginPercent.toFixed(1)}%`
                : product.marginGrade;
              return (
                <tr
                  key={product.ean}
                  className={`${isFocused ? 'is-selected' : ''} ${isMultiSelected ? 'is-multi-selected' : ''} ${isUpdated ? 'is-updated' : ''}`}
                  onMouseEnter={() => {
                    setSelectedIndex(index);
                    setAnchorIndex(index);
                  }}
                  onDoubleClick={() => navigate(`/product/${encodeURIComponent(product.ean)}`)}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={isMultiSelected}
                      onChange={() => toggleRowSelected(product.ean)}
                      aria-label={`Select ${product.ean}`}
                    />
                  </td>
                  {visibleColumns.thumbnail && <td><img src={product.image || PLACEHOLDER_IMAGE} alt="" loading="lazy" /></td>}
                  {visibleColumns.product && (
                    <td>
                      <div className="v2-product-cell">
                        <Link to={`/product/${encodeURIComponent(product.ean)}`}>{product.title}</Link>
                        <span>{product.ean}</span>
                      </div>
                    </td>
                  )}
                  {visibleColumns.brand && <td>{product.brand || '-'}</td>}
                  {visibleColumns.market && <td>{market.toUpperCase()}</td>}
                  {visibleColumns.stock && <td>{product.stockStatus === 'in stock' ? 'In stock' : 'Out'}</td>}
                  {visibleColumns.suppliers && <td>{product.supplierRows?.length || 0}</td>}
                  {visibleColumns.margin && <td>{margin}</td>}
                  {visibleColumns.competition && <td>{competitionLabel(product.competitorCount)} ({product.competitorCount})</td>}
                  {visibleColumns.cheapestSupplier && <td>{hasSupplierAccess ? cheapestSupplier(product) : 'Locked'}</td>}
                  {visibleColumns.marketPrice && <td>{product.marketPrice != null ? `${Math.round(product.marketPrice)} ${product.marketCurrency || ''}` : '-'}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="v2-footer">
        <div>
          {selectedProduct
            ? `${selectedProduct.title} | ${selectedProduct.brand} | Competition ${selectedProduct.competitorCount}`
            : 'No row selected'}
        </div>
        {!hasSupplierAccess && selectedProduct && (
          <button type="button" className="v2-primary" onClick={() => setModalEan(selectedProduct.ean)}>
            Request supplier data
          </button>
        )}
      </footer>

      <CommandPalette
        open={paletteOpen}
        query={paletteQuery}
        onQuery={setPaletteQuery}
        onClose={() => {
          setPaletteOpen(false);
          setPaletteQuery('');
        }}
        onRun={runCommand}
      />

      {modalProduct && (
        <RequestSupplierModal
          ean={modalProduct.ean}
          title={modalProduct.title}
          sourcePage="webversion-catalog-v2"
          onClose={() => setModalEan(null)}
        />
      )}
    </div>
  );
}
