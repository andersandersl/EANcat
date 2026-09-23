/* ProductRow — one row in the search results table. Matches the source
   ProductRow.tsx visually: thumbnail, title + subtitle, EAN, brand tag,
   category, EUR price, market margin stack, stock chip, supplier name. */

function ProductRow({ product, activeMarket, feedStatus, atCap, onAdd, onDismiss, onRestore, onOpen, onRefresh, refreshing }) {
  const I = window.Icons;
  const subtitle = product.title_translated["sv-SE"] || product.title_translated["da-DK"];
  const fmtEUR = (v) => v == null ? "—" : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(v);
  return (
    <tr>
      <td>
        <window.FeedStatusPill
          status={feedStatus}
          atCap={atCap}
          onAdd={() => onAdd(product.ean)}
          onDismiss={() => onDismiss(product.ean)}
          onRestore={() => onRestore(product.ean)}
        />
      </td>
      <td>
        <div className="thumb" />
      </td>
      <td style={{ maxWidth: 380 }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onOpen(product.ean); }}
           className="product-name" style={{ display: 'block', cursor: 'pointer', textDecoration: 'none' }}>
          {product.title}
        </a>
        {subtitle && <div className="product-trans" style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380
        }}>{subtitle}</div>}
      </td>
      <td className="mono tabular muted" style={{ fontSize: 12 }}>{product.ean}</td>
      <td><window.BrandTag>{product.brand}</window.BrandTag></td>
      <td className="muted" style={{ fontSize: 12 }}>{product.category}</td>
      <td className="tabular">{fmtEUR(product.price_eur)}</td>
      <td>
        <div className="row" style={{ gap: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, width: 78 }}>
            <window.MarginPill country="DK" marginPct={product.market.DK.margin_pct} active={activeMarket === "DK"} />
            <window.MarginPill country="SE" marginPct={product.market.SE.margin_pct} active={activeMarket === "SE"} />
            <window.MarginPill country="FI" marginPct={product.market.FI.margin_pct} active={activeMarket === "FI"} />
          </div>
          <button onClick={() => onRefresh(product.ean)} title="Refresh market data"
            style={{
              border: 0, background: 'transparent', cursor: 'pointer',
              padding: 4, borderRadius: 4,
              color: 'hsl(var(--muted-foreground))',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'hsl(var(--accent) / 0.4)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {refreshing ? <I.Loader2 size={14} /> : <I.RotateCw size={14} />}
          </button>
        </div>
      </td>
      <td><window.StockChip stock={product.stock} stockLocal={product.stockLocal} stockRemote={product.stockRemote} days={product.stockRemoteDays} /></td>
      <td className="muted" style={{ fontSize: 12 }}>{product.supplier}</td>
    </tr>
  );
}

Object.assign(window, { ProductRow });
