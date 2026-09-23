/* FacetPanel — the brand/category/supplier sidebar widget.
   Recreated from client/src/components/FacetPanel.tsx with the same
   selected-first ordering and live filter behavior. */

function FacetPanel({ title, values, selected, onChange, visibleRows = 6 }) {
  const I = window.Icons;
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState(true);
  const sel = new Set(selected);
  const selectedRows = selected.map(v => values.find(e => e.value === v) || { value: v, count: 0 });
  const filteredRows = values
    .filter(e => !sel.has(e.value))
    .filter(e => search ? e.value.toLowerCase().includes(search.toLowerCase()) : true);
  const ordered = [...selectedRows, ...filteredRows];

  const toggle = (v) => {
    if (sel.has(v)) onChange(selected.filter(x => x !== v));
    else onChange([...selected, v]);
  };

  return (
    <div style={{ borderBottom: '1px solid hsl(var(--border) / 0.6)', paddingBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="between">
        <button onClick={() => setExpanded(v => !v)} style={{
          background: 'transparent', border: 0, cursor: 'pointer', padding: 0,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          font: '600 13px Inter', color: 'hsl(var(--foreground))',
        }}>
          {title}
          {expanded ? <I.ChevronUp size={12} /> : <I.ChevronDown size={12} />}
        </button>
        {selected.length > 0 && (
          <button onClick={() => onChange([])} style={{
            background: 'transparent', border: 0, cursor: 'pointer',
            color: 'hsl(var(--muted-foreground))', font: '500 11px Inter',
          }}>Clear</button>
        )}
      </div>
      {expanded && (
        <>
          <input type="search" className="input input--sm"
            placeholder={`Search ${title.toLowerCase()}…`}
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {values.length === 0 ? (
            <div className="muted" style={{ font: '400 12px Inter', padding: '8px 4px' }}>No values.</div>
          ) : (
            <div style={{
              maxHeight: visibleRows * 28 + 4,
              overflowY: 'auto',
              border: '1px solid hsl(var(--border) / 0.4)',
              borderRadius: 6,
              background: 'hsl(var(--card) / 0.4)',
            }}>
              <ul style={{ listStyle: 'none', margin: 0, padding: '4px 0' }}>
                {ordered.map(entry => {
                  const checked = sel.has(entry.value);
                  return (
                    <li key={entry.value}
                      onClick={() => toggle(entry.value)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '18px 1fr auto',
                        alignItems: 'center',
                        gap: 8,
                        padding: '2px 8px',
                        cursor: 'pointer',
                        background: checked ? 'hsl(var(--accent) / 0.3)' : 'transparent',
                        fontSize: 12,
                      }}
                    >
                      <div style={{
                        width: 14, height: 14,
                        borderRadius: 3,
                        border: '1.5px solid ' + (checked ? 'hsl(var(--primary))' : '#B8BFCF'),
                        background: checked ? 'hsl(var(--primary))' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {checked && <window.Icons.Check size={10} style={{ color: '#fff' }} />}
                      </div>
                      <span style={{ color: 'hsl(var(--foreground))', fontWeight: checked ? 500 : 400 }}>{entry.value}</span>
                      {entry.count > 0 && (
                        <span style={{ font: '500 10px Inter', color: 'hsl(var(--muted-foreground))', fontVariantNumeric: 'tabular-nums' }}>
                          {entry.count.toLocaleString()}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

Object.assign(window, { FacetPanel });
