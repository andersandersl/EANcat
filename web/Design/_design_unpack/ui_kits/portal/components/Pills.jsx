/* Pills — the visual vocabulary of the product. All follow the same recipe:
   active variant: bg-color-200 / text-color-900 / inset-ring 2px color-500/60
   muted variant:  bg-color-50  / text-color-700/70 / inset-ring 1px color-200/60
*/

function _marginColor(pct, active) {
  if (pct === null || Number.isNaN(pct)) return active
    ? { bg: '#D4D4D8', fg: '#18181B', ring: '#71717A99' }
    : { bg: '#F4F4F5', fg: '#71717A99', ring: '#D4D4D899' };
  if (pct >= 20) return active
    ? { bg: '#A7F3D0', fg: '#064E3B', ring: '#10B98199' }
    : { bg: '#ECFDF5', fg: '#04785799', ring: '#A7F3D099' };
  if (pct >= 5)  return active
    ? { bg: '#FDE68A', fg: '#78350F', ring: '#F59E0B99' }
    : { bg: '#FFFBEB', fg: '#78350F99', ring: '#FCD34D99' };
  if (pct >= 0)  return active
    ? { bg: '#D4D4D8', fg: '#18181B', ring: '#71717A99' }
    : { bg: '#F4F4F5', fg: '#3F3F4699', ring: '#D4D4D899' };
  return active
    ? { bg: '#FECDD3', fg: '#881337', ring: '#EF444499' }
    : { bg: '#FFF1F2', fg: '#88133799', ring: '#FECACA99' };
}

function MarginPill({ country, marginPct, active = false }) {
  const isMissing = marginPct === null || Number.isNaN(marginPct);
  const { bg, fg, ring } = _marginColor(isMissing ? null : marginPct, active);
  const sign = !isMissing && marginPct >= 0 ? '+' : '';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between',
      height: 18, width: 78, padding: '0 6px',
      borderRadius: 4,
      fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 10,
      letterSpacing: '0.06em',
      fontVariantNumeric: 'tabular-nums',
      background: bg, color: fg,
      boxShadow: `inset 0 0 0 ${active ? 2 : 1}px ${ring}`,
    }}>
      <span style={{ opacity: active ? 1 : 0.8 }}>{country}</span>
      <span>{isMissing ? '—' : `${sign}${marginPct.toFixed(1)}%`}</span>
    </span>
  );
}

function StockChip({ stock = 0, stockLocal = null, stockRemote = null, days = null }) {
  if (stock <= 0) {
    return <span className="pill" style={{
      borderRadius: 4, background: 'hsl(var(--destructive) / 0.15)', color: '#9F1239',
      boxShadow: 'inset 0 0 0 1px hsl(var(--destructive) / 0.4)',
      height: 22, minWidth: 40, justifyContent: 'center',
      fontVariantNumeric: 'tabular-nums', fontSize: 11,
    }}>Out</span>;
  }
  const localOnly = stockLocal != null && stockLocal > 0;
  const remoteOnly = !localOnly && stockRemote != null && stockRemote > 0;
  const bg = remoteOnly ? 'hsl(38 92% 50% / 0.15)' : 'hsl(152 76% 39% / 0.15)';
  const fg = remoteOnly ? '#92400E' : '#047857';
  const ring = remoteOnly ? 'hsl(38 92% 50% / 0.4)' : 'hsl(152 76% 39% / 0.4)';
  const count = remoteOnly ? stockRemote : (localOnly ? stockLocal : stock);
  return (
    <span title={remoteOnly ? `Bestillingsvare — kun fjernlager · ~${days ?? '4–13'} dage` : undefined}
      className="pill" style={{
      borderRadius: 4, background: bg, color: fg, boxShadow: `inset 0 0 0 1px ${ring}`,
      height: 22, minWidth: 40, justifyContent: 'center',
      fontVariantNumeric: 'tabular-nums', fontSize: 11,
    }}>{count}</span>
  );
}

function FeedStatusPill({ status, onAdd, onDismiss, onRestore, atCap = false }) {
  const I = window.Icons;
  if (status === 'selected') {
    return (
      <button onClick={onDismiss} title="In feed — click to remove" style={{
        cursor: 'pointer', border: 0,
        display: 'inline-flex', alignItems: 'center', gap: 4,
        height: 22, padding: '0 10px', borderRadius: 9999,
        background: 'hsl(152 76% 39% / 0.15)', color: '#047857',
        boxShadow: 'inset 0 0 0 1px hsl(152 76% 39% / 0.4)',
        fontFamily: 'Inter', fontWeight: 600, fontSize: 12,
      }}>
        <I.Check size={12} />on
      </button>
    );
  }
  if (status === 'dismissed') {
    return (
      <button onClick={onRestore} title="Dismissed — click to restore" disabled={atCap} style={{
        cursor: atCap ? 'not-allowed' : 'pointer', border: 0, opacity: atCap ? 0.5 : 1,
        display: 'inline-flex', alignItems: 'center', gap: 4,
        height: 22, padding: '0 10px', borderRadius: 9999,
        background: 'hsl(0 84% 60% / 0.15)', color: '#BE123C',
        boxShadow: 'inset 0 0 0 1px hsl(0 84% 60% / 0.4)',
        fontFamily: 'Inter', fontWeight: 600, fontSize: 12,
      }}>
        <I.X size={12} />off
      </button>
    );
  }
  return (
    <button onClick={onAdd} title={atCap ? "Feed cap reached" : "Add to feed"} disabled={atCap} style={{
      cursor: atCap ? 'not-allowed' : 'pointer', opacity: atCap ? 0.5 : 1,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: 9999,
      background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
      color: 'hsl(var(--muted-foreground))',
    }}>
      <I.Plus size={14} />
    </button>
  );
}

function FilterChip({ label, value, onClear }) {
  const I = window.Icons;
  return (
    <button onClick={onClear} style={{
      cursor: 'pointer', border: '1px solid hsl(var(--border))',
      background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 26, padding: '0 10px', borderRadius: 9999,
      fontFamily: 'Inter', fontWeight: 500, fontSize: 12,
    }}>
      <span style={{ color: 'hsl(var(--muted-foreground))' }}>{label}:</span>
      <span>{value}</span>
      <I.X size={12} style={{ opacity: 0.6 }} />
    </button>
  );
}

function BrandTag({ children }) {
  return <span className="brand-tag">{children}</span>;
}

Object.assign(window, { MarginPill, StockChip, FeedStatusPill, FilterChip, BrandTag });
