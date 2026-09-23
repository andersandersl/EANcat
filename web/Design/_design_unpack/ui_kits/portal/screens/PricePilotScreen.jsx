/* PricePilotScreen — /pricepilot view. The customer's curated feed, with
   pricing settings, supplier sources, and per-EAN list. Shows the empty
   state when the feed is empty. */

function PricePilotScreen({ feed, dismissFromFeed, setRoute, pushToast }) {
  const I = window.Icons;
  const products = window.SEED_PRODUCTS.filter(p => feed.has(p.ean));
  const feedCap = 100;

  return (
    <>
      <window.TopStrip title="Feed · PricePilot" subtitle={`${feed.size.toLocaleString()} of ${feedCap.toLocaleString()} products selected · hourly push to webshop`} />
      <div className="page stack-4">
        {/* ── Pricing settings card ──────────────────────────────────── */}
        <div className="search-layout">
          <window.Card>
            <window.CardHeader>
              <window.CardTitle>Pricing settings</window.CardTitle>
              <window.CardDesc>Markup rules applied to every product in your feed.</window.CardDesc>
            </window.CardHeader>
            <window.CardBody>
              <div className="stack-3">
                <div className="stack-2">
                  <window.Label>Default markup</window.Label>
                  <div className="row" style={{ gap: 6 }}>
                    <window.Input value="18" style={{ maxWidth: 80 }} />
                    <span className="muted" style={{ font: '400 13px Inter' }}>%</span>
                  </div>
                </div>
                <div className="stack-2">
                  <window.Label>Minimum margin floor</window.Label>
                  <div className="row" style={{ gap: 6 }}>
                    <window.Input value="5" style={{ maxWidth: 80 }} />
                    <span className="muted" style={{ font: '400 13px Inter' }}>%</span>
                  </div>
                </div>
                <div className="stack-2">
                  <window.Label>Active market</window.Label>
                  <window.ToggleGroup options={['DK','SE','FI']} value="SE" onChange={() => {}} />
                </div>
              </div>
            </window.CardBody>
          </window.Card>

          <window.Card>
            <window.CardHeader>
              <window.CardTitle>Tiers</window.CardTitle>
              <window.CardDesc>Markup tiered by EUR price bracket.</window.CardDesc>
            </window.CardHeader>
            <window.CardBody>
              <table className="table">
                <thead><tr><th>Bracket</th><th>Markup</th><th>Min margin</th></tr></thead>
                <tbody>
                  <tr><td className="tabular">€0 – €50</td><td className="tabular">28%</td><td className="tabular">8%</td></tr>
                  <tr><td className="tabular">€50 – €250</td><td className="tabular">18%</td><td className="tabular">5%</td></tr>
                  <tr><td className="tabular">€250 – €1,000</td><td className="tabular">12%</td><td className="tabular">4%</td></tr>
                  <tr><td className="tabular">€1,000+</td><td className="tabular">8%</td><td className="tabular">3%</td></tr>
                </tbody>
              </table>
            </window.CardBody>
          </window.Card>
        </div>

        {/* ── Feed list ──────────────────────────────────────────────── */}
        <window.Card>
          <window.CardHeader>
            <div className="between">
              <div className="row" style={{ gap: 8 }}>
                <window.CardTitle>Your feed</window.CardTitle>
                <span style={{
                  background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))',
                  padding: '2px 8px', borderRadius: 4,
                  font: '500 11px Inter', fontVariantNumeric: 'tabular-nums',
                }}>{products.length.toLocaleString()} selected</span>
              </div>
              <window.Button variant="outline" size="sm" onClick={() => setRoute('/')}>
                <I.Plus size={12} />
                Browse catalog
              </window.Button>
            </div>
          </window.CardHeader>
          <window.CardBody style={{ padding: 0 }}>
            {products.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <I.Tags size={36} style={{ color: 'hsl(var(--muted-foreground))', opacity: 0.5 }} />
                <p style={{ font: '500 14px Inter', marginTop: 12 }}>Your feed is empty.</p>
                <p className="muted" style={{ font: '400 12px Inter', marginTop: 4 }}>
                  Add products from Search and they will appear here.
                </p>
                <window.Button variant="primary" size="sm" onClick={() => setRoute('/')} style={{ marginTop: 14 }}>
                  Browse catalog
                </window.Button>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Product</th>
                    <th>EAN</th>
                    <th>Brand</th>
                    <th>Cost (EUR)</th>
                    <th>List price</th>
                    <th>Markup</th>
                    <th>Stock</th>
                    <th>Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const margin = p.market.SE.margin_pct;
                    const markup = margin ?? 0;
                    const list = p.price_eur * (1 + markup / 100);
                    return (
                      <tr key={p.ean}>
                        <td><div className="thumb" style={{ width: 32, height: 32 }} /></td>
                        <td style={{ maxWidth: 320 }}>
                          <a href="#" onClick={(e) => { e.preventDefault(); setRoute(`/product/${p.ean}`); }}
                             className="product-name" style={{ textDecoration: 'none' }}>{p.title}</a>
                        </td>
                        <td className="mono tabular muted" style={{ fontSize: 12 }}>{p.ean}</td>
                        <td><window.BrandTag>{p.brand}</window.BrandTag></td>
                        <td className="tabular">€{p.price_eur.toFixed(2)}</td>
                        <td className="tabular" style={{ fontWeight: 500 }}>€{list.toFixed(2)}</td>
                        <td>
                          <window.MarginPill country="SE" marginPct={margin} active />
                        </td>
                        <td><window.StockChip stock={p.stock} stockLocal={p.stockLocal} stockRemote={p.stockRemote} days={p.stockRemoteDays} /></td>
                        <td className="muted" style={{ fontSize: 12 }}>{p.supplier}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </window.CardBody>
        </window.Card>
      </div>
    </>
  );
}

Object.assign(window, { PricePilotScreen });
