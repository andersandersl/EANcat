/* SearchScreen — / route. Sidebar with feed capacity + facets,
   main column with filters card + results table. Recreates
   client/src/pages/SearchProducts.tsx visually. */

function SearchScreen({ feed, addToFeed, dismissFromFeed, restoreToFeed, setRoute, pushToast }) {
  const I = window.Icons;
  const [keyword, setKeyword] = React.useState("");
  const [ean, setEan] = React.useState("");
  const [market, setMarket] = React.useState("SE");
  const [minMargin, setMinMargin] = React.useState("");
  const [inStockOnly, setInStockOnly] = React.useState(false);
  const [withImage, setWithImage] = React.useState(false);
  const [brands, setBrands] = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [suppliers, setSuppliers] = React.useState([]);
  const [filtersOpen, setFiltersOpen] = React.useState(true);
  const [refreshingEan, setRefreshingEan] = React.useState(null);

  const all = window.SEED_PRODUCTS;
  const products = all.filter(p => {
    if (keyword && !(`${p.title} ${p.brand} ${p.ean}`.toLowerCase().includes(keyword.toLowerCase()))) return false;
    if (ean && !p.ean.includes(ean)) return false;
    if (brands.length && !brands.includes(p.brand.charAt(0) + p.brand.slice(1).toLowerCase())) return false;
    if (categories.length && !categories.includes(p.category)) return false;
    if (suppliers.length && !suppliers.includes(p.supplier)) return false;
    if (inStockOnly && p.stock <= 0) return false;
    const m = p.market[market]?.margin_pct;
    if (minMargin && (m == null || m < parseFloat(minMargin))) return false;
    return true;
  });

  const visibleEans = products.map(p => p.ean);
  const feedCap = 100;
  const atCap = feed.size >= feedCap;
  const feedPctRaw = (feed.size / feedCap) * 100;
  const feedPct = Math.min(100, feedPctRaw);
  const feedTone = atCap
    ? { text: '#BE123C', bar: '#EF4444' }
    : feedPctRaw >= 80
    ? { text: '#92400E', bar: '#F59E0B' }
    : { text: '#047857', bar: '#10B981' };

  const chipList = [];
  if (keyword)             chipList.push({ key: 'q',        label: 'Keyword',  value: keyword });
  if (ean)                 chipList.push({ key: 'ean',      label: 'EAN',      value: ean });
  if (minMargin)           chipList.push({ key: 'min',      label: `${market} margin ≥`, value: `${minMargin}%` });
  if (inStockOnly)         chipList.push({ key: 'instock',  label: 'In stock', value: 'on' });
  if (withImage)           chipList.push({ key: 'image',    label: 'Image',    value: 'on' });
  brands.forEach(b =>      chipList.push({ key: 'b' + b,    label: 'Brand',    value: b }));
  categories.forEach(c =>  chipList.push({ key: 'c' + c,    label: 'Category', value: c }));
  suppliers.forEach(s =>   chipList.push({ key: 's' + s,    label: 'Supplier', value: s }));

  const clearAll = () => {
    setKeyword(""); setEan(""); setMinMargin("");
    setInStockOnly(false); setWithImage(false);
    setBrands([]); setCategories([]); setSuppliers([]);
  };
  const clearChip = (c) => {
    if (c.key === 'q') setKeyword('');
    else if (c.key === 'ean') setEan('');
    else if (c.key === 'min') setMinMargin('');
    else if (c.key === 'instock') setInStockOnly(false);
    else if (c.key === 'image') setWithImage(false);
    else if (c.key.startsWith('b')) setBrands(brands.filter(x => x !== c.value));
    else if (c.key.startsWith('c')) setCategories(categories.filter(x => x !== c.value));
    else if (c.key.startsWith('s')) setSuppliers(suppliers.filter(x => x !== c.value));
  };

  const handleAdd = (ean) => {
    if (atCap) {
      pushToast({ variant: 'error', title: 'Feed cap reached', desc: 'Remove a product first or contact support.' });
      return;
    }
    addToFeed(ean);
    pushToast({ title: 'Added to feed', desc: `EAN ${ean}` });
  };
  const handleDismiss = (ean) => {
    dismissFromFeed(ean);
    pushToast({ title: 'Removed from feed', desc: `EAN ${ean}` });
  };
  const handleRestore = (ean) => {
    if (atCap) {
      pushToast({ variant: 'error', title: 'Feed cap reached', desc: 'Remove a product first.' });
      return;
    }
    restoreToFeed(ean);
    pushToast({ title: 'Restored to feed', desc: `EAN ${ean}` });
  };
  const handleRefresh = (ean) => {
    setRefreshingEan(ean);
    setTimeout(() => {
      setRefreshingEan(null);
      pushToast({ title: 'Market data refreshed', desc: 'Updated 3/3 markets.' });
    }, 700);
  };
  const handleRefreshAll = () => {
    setRefreshingEan('*');
    setTimeout(() => {
      setRefreshingEan(null);
      pushToast({ title: 'Market data refreshed', desc: `Updated 3/3 markets across ${products.length} products.` });
    }, 900);
  };
  const handleAddAll = () => {
    if (atCap) return;
    visibleEans.forEach(e => feed.has(e) || addToFeed(e));
    pushToast({ title: 'Added to feed', desc: `${visibleEans.length} products added.` });
  };

  const sortOptions = [
    { value: 'margin_desc', label: 'PR margin: high → low (active market)' },
    { value: 'margin_asc',  label: 'PR margin: low → high (active market)' },
    { value: 'relevance',   label: 'By EAN' },
    { value: 'price_asc',   label: 'Price: low → high' },
    { value: 'price_desc',  label: 'Price: high → low' },
  ];

  return (
    <>
      <window.TopStrip title="Search Products" subtitle={`Source: ip_agency · ${products.length.toLocaleString()} products`} />
      <div className="page search-layout">
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="stack-4">
          <window.Card>
            <window.CardBody style={{ padding: 12 }}>
              <div className="between" style={{ marginBottom: 6 }}>
                <span className="eyebrow">Feed</span>
                <span className="tabular" style={{ font: '600 14px Inter', color: feedTone.text }}>
                  {feed.size.toLocaleString()} / {feedCap.toLocaleString()}
                </span>
              </div>
              <div style={{ height: 8, background: 'hsl(var(--muted))', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: feedTone.bar, width: `${feedPct}%`, transition: 'width 180ms ease' }} />
              </div>
              {atCap && <p className="muted" style={{ font: '400 11px Inter', marginTop: 6 }}>Feed is full — remove a product first.</p>}
            </window.CardBody>
          </window.Card>

          <window.Card>
            <window.CardHeader>
              <div className="between">
                <div style={{ font: '500 12px Inter', lineHeight: 1.3 }}>
                  <span style={{ fontWeight: 600 }}>Filters: </span>
                  <span className="muted">{chipList.length ? chipList.map(c => c.label).join(', ') : 'None'}</span>
                </div>
                {chipList.length > 0 && (
                  <button onClick={clearAll} style={{
                    background: 'transparent', border: 0, cursor: 'pointer',
                    color: 'hsl(var(--muted-foreground))', font: '500 11px Inter',
                  }}>Clear all</button>
                )}
              </div>
            </window.CardHeader>
            <window.CardBody className="stack-3">
              <window.FacetPanel title="Brand" values={window.SEED_BRANDS} selected={brands} onChange={setBrands} />
              <window.FacetPanel title="Category" values={window.SEED_CATEGORIES} selected={categories} onChange={setCategories} />
              <window.FacetPanel title="Supplier" values={window.SEED_SUPPLIERS} selected={suppliers} onChange={setSuppliers} />
            </window.CardBody>
          </window.Card>
        </aside>

        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="stack-4" style={{ minWidth: 0 }}>
          <window.Card>
            <window.CardHeader>
              <button onClick={() => setFiltersOpen(v => !v)}
                style={{
                  background: 'transparent', border: 0, cursor: 'pointer', padding: 0,
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  font: '600 16px Inter',
                }}>
                <span className="row" style={{ gap: 8 }}><I.Search />Filters</span>
                {filtersOpen ? <I.ChevronUp /> : <I.ChevronDown />}
              </button>
            </window.CardHeader>
            {filtersOpen && (
              <window.CardBody>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div className="stack-2">
                    <window.Label>Exact EAN</window.Label>
                    <window.Input placeholder="e.g. 4013288234186" value={ean} onChange={(e) => setEan(e.target.value)} />
                  </div>
                  <div className="stack-2">
                    <window.Label>MPN</window.Label>
                    <window.Input placeholder="e.g. 0462-799" />
                  </div>
                  <div className="stack-2">
                    <window.Label>Keyword</window.Label>
                    <window.Input placeholder="Search by name, brand, or EAN…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                  </div>
                  <div className="stack-2">
                    <window.Label>Sort</window.Label>
                    <window.Select value="margin_desc" onChange={() => {}} options={sortOptions} />
                  </div>
                  <div className="stack-2">
                    <window.Label>{market} margin ≥ %</window.Label>
                    <window.Input type="number" placeholder="e.g. 20" value={minMargin} onChange={(e) => setMinMargin(e.target.value)} />
                  </div>
                  <div className="stack-2">
                    <window.Label>{market} margin ≤ %</window.Label>
                    <window.Input type="number" placeholder="e.g. 80" />
                  </div>
                  <div style={{ gridColumn: '1 / -1', paddingTop: 4 }}>
                    <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="eyebrow">Market</span>
                        <window.ToggleGroup options={['DK','SE','FI']} value={market} onChange={setMarket} ariaLabel="Active market" />
                      </div>
                      <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
                        <window.Switch checked={inStockOnly} onChange={setInStockOnly} />
                        <span className="label">In stock only</span>
                      </label>
                      <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
                        <window.Switch checked={withImage} onChange={setWithImage} />
                        <span className="label">With image</span>
                      </label>
                    </div>
                  </div>
                </div>
                {chipList.length > 0 && (
                  <div className="row" style={{ marginTop: 12, gap: 6, flexWrap: 'wrap' }}>
                    {chipList.map(c => (
                      <window.FilterChip key={c.key} label={c.label} value={c.value} onClear={() => clearChip(c)} />
                    ))}
                  </div>
                )}
              </window.CardBody>
            )}
          </window.Card>

          <window.Card>
            <window.CardHeader>
              <div className="between">
                <div className="row" style={{ gap: 8 }}>
                  <span className="card__title">Results</span>
                  <span style={{
                    background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))',
                    padding: '2px 8px', borderRadius: 4,
                    font: '500 11px Inter', fontVariantNumeric: 'tabular-nums',
                  }}>{products.length.toLocaleString()} loaded</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <window.Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={refreshingEan === '*'}>
                    {refreshingEan === '*' ? <I.Loader2 size={12} /> : <I.RotateCw size={12} />}
                    Refresh all margins
                  </window.Button>
                  <span className="muted" style={{ font: '400 11px Inter' }}>Per page</span>
                  <window.Select value="25" onChange={() => {}} options={['10','25','50']} className="input--sm" />
                </div>
              </div>
            </window.CardHeader>
            <window.CardBody style={{ padding: 0 }}>
              {products.length === 0 ? (
                <p className="muted" style={{ textAlign: 'center', padding: 40, font: '400 13px Inter' }}>
                  No products match your filters.
                </p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th colSpan={2}>
                        <window.Button variant="primary" size="xs" disabled={atCap || visibleEans.length === 0}
                          onClick={handleAddAll}>
                          Add all ({visibleEans.length})
                        </window.Button>
                      </th>
                      <th>Product</th>
                      <th>EAN</th>
                      <th>Brand</th>
                      <th>Category</th>
                      <th>Best Price</th>
                      <th>PR Margin</th>
                      <th>Stock</th>
                      <th>Supplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <window.ProductRow
                        key={p.ean}
                        product={p}
                        activeMarket={market}
                        feedStatus={feed.has(p.ean) ? 'selected' : (feed.dismissed?.has(p.ean) ? 'dismissed' : null)}
                        atCap={atCap}
                        onAdd={handleAdd}
                        onDismiss={handleDismiss}
                        onRestore={handleRestore}
                        onOpen={(ean) => setRoute(`/product/${ean}`)}
                        onRefresh={handleRefresh}
                        refreshing={refreshingEan === p.ean || refreshingEan === '*'}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </window.CardBody>
          </window.Card>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { SearchScreen });
