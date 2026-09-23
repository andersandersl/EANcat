/* ProductDetailScreen — /product/:ean. Image gallery, supplier breakdown,
   market pricing table. Recreated from ProductDetail.tsx visually. */

function ProductDetailScreen({ ean, setRoute, feed, addToFeed, dismissFromFeed, pushToast }) {
  const I = window.Icons;
  const product = window.SEED_PRODUCTS.find(p => p.ean === ean) || window.SEED_PRODUCTS[0];
  const inFeed = feed.has(product.ean);

  return (
    <>
      <window.TopStrip title={product.title} subtitle={`EAN ${product.ean} · ${product.brand} · ${product.category}`} />
      <div className="page stack-4">
        <button onClick={() => setRoute('/')} style={{
          background: 'transparent', border: 0, cursor: 'pointer', padding: 0,
          color: 'hsl(var(--muted-foreground))', font: '500 12px Inter',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <I.ArrowLeft size={14} />Back to search
        </button>

        <div className="product-grid">
          <div className="product-hero">
            <div className="hero-img">Image placeholder</div>
            <div className="thumbs">
              <div className="active"></div><div></div><div></div><div></div>
            </div>
          </div>

          <window.Card>
            <window.CardHeader>
              <div className="between">
                <div>
                  <window.CardTitle>{product.title}</window.CardTitle>
                  <window.CardDesc>{product.title_translated["sv-SE"]}</window.CardDesc>
                </div>
                {inFeed ? (
                  <window.Button variant="destructive" size="sm" onClick={() => {
                    dismissFromFeed(product.ean);
                    pushToast({ title: 'Removed from feed', desc: `EAN ${product.ean}` });
                  }}>
                    <I.X size={12} />Remove from feed
                  </window.Button>
                ) : (
                  <window.Button variant="primary" size="sm" onClick={() => {
                    addToFeed(product.ean);
                    pushToast({ title: 'Added to feed', desc: `EAN ${product.ean}` });
                  }}>
                    <I.Plus size={12} />Add to feed
                  </window.Button>
                )}
              </div>
            </window.CardHeader>
            <window.CardBody>
              <dl className="kv">
                <dt>EAN</dt><dd className="mono">{product.ean}</dd>
                <dt>MPN</dt><dd className="mono">{product.mpn}</dd>
                <dt>Brand</dt><dd><window.BrandTag>{product.brand}</window.BrandTag></dd>
                <dt>Category</dt><dd>{product.category}</dd>
                <dt>Best price</dt><dd style={{ font: '600 16px Inter' }}>€{product.price_eur.toFixed(2)}</dd>
                <dt>Cheapest supplier</dt><dd>{product.supplier}</dd>
                <dt>Stock</dt><dd>
                  <window.StockChip stock={product.stock} stockLocal={product.stockLocal} stockRemote={product.stockRemote} days={product.stockRemoteDays} />
                  {product.stockRemote > 0 && product.stockLocal > 0 && (
                    <span className="muted" style={{ font: '400 12px Inter', marginLeft: 8 }}>
                      +{product.stockRemote} fra fjernlager (~{product.stockRemoteDays} dage)
                    </span>
                  )}
                </dd>
              </dl>
            </window.CardBody>
          </window.Card>
        </div>

        <window.Card>
          <window.CardHeader>
            <window.CardTitle>Market pricing</window.CardTitle>
            <window.CardDesc>PriceRunner offers across the three Nordic markets.</window.CardDesc>
          </window.CardHeader>
          <window.CardBody style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr><th>Market</th><th>Our price (EUR)</th><th>Cheapest competitor</th><th>Margin</th><th>Last refresh</th></tr>
              </thead>
              <tbody>
                {['DK','SE','FI'].map(m => {
                  const margin = product.market[m].margin_pct;
                  const comp = margin == null ? null : product.price_eur / (1 + margin / 100);
                  return (
                    <tr key={m}>
                      <td><span className="eyebrow" style={{ letterSpacing: '0.08em' }}>{m}</span></td>
                      <td className="tabular">€{product.price_eur.toFixed(2)}</td>
                      <td className="tabular muted">{comp == null ? '—' : `€${comp.toFixed(2)}`}</td>
                      <td><window.MarginPill country={m} marginPct={margin} active /></td>
                      <td className="muted mono" style={{ fontSize: 12 }}>kl. 14:00 · 1m 04s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </window.CardBody>
        </window.Card>

        <window.Card>
          <window.CardHeader>
            <window.CardTitle>Supplier offers</window.CardTitle>
            <window.CardDesc>Cheapest supplier wins; rest are surfaced for reference.</window.CardDesc>
          </window.CardHeader>
          <window.CardBody style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr><th>Supplier</th><th>Currency</th><th>Cost</th><th>Cost (EUR)</th><th>Stock</th><th>Last fetched</th></tr>
              </thead>
              <tbody>
                {[
                  { name: product.supplier, ccy: 'SEK', cost: '849', costEur: product.price_eur.toFixed(2), winner: true,  stock: product.stock },
                  { name: 'Dremote', ccy: 'SEK', cost: '892', costEur: (product.price_eur + 4.20).toFixed(2), winner: false, stock: 18 },
                  { name: 'Difox',   ccy: 'EUR', cost: (product.price_eur + 5.10).toFixed(2), costEur: (product.price_eur + 5.10).toFixed(2), winner: false, stock: 5 },
                  { name: 'Egenta',  ccy: 'CZK', cost: '2,189', costEur: (product.price_eur + 7.20).toFixed(2), winner: false, stock: 0 },
                ].map(s => (
                  <tr key={s.name} style={s.winner ? { background: 'hsl(var(--accent) / 0.4)' } : null}>
                    <td>
                      <span style={{ font: s.winner ? '600 13px Inter' : '500 13px Inter' }}>{s.name}</span>
                      {s.winner && <span style={{
                        marginLeft: 6,
                        background: 'hsl(152 76% 39% / 0.15)', color: '#047857',
                        boxShadow: 'inset 0 0 0 1px hsl(152 76% 39% / 0.4)',
                        padding: '1px 6px', borderRadius: 4,
                        font: '600 10px Inter', letterSpacing: '0.04em', textTransform: 'uppercase',
                      }}>Cheapest</span>}
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{s.ccy}</td>
                    <td className="tabular">{s.cost}</td>
                    <td className="tabular">€{s.costEur}</td>
                    <td><window.StockChip stock={s.stock} /></td>
                    <td className="muted mono" style={{ fontSize: 12 }}>kl. 03:32 · 4.2s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </window.CardBody>
        </window.Card>
      </div>
    </>
  );
}

Object.assign(window, { ProductDetailScreen });
