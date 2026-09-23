/* AdminPipelineScreen — /admin/pipeline. The hourly orchestrator status
   view. Admin-only — note the amber banner at the top. Visually inspired
   by AdminPipeline.tsx + SupplierPills.tsx. */

const STATUS_TOKENS = {
  success: { bg: 'hsl(152 76% 39% / 0.15)', text: '#047857', border: 'hsl(152 76% 39% / 0.4)', dot: '#10B981', label: 'OK' },
  running: { bg: 'hsl(221 92% 55% / 0.15)', text: '#1A5EFF', border: 'hsl(221 92% 55% / 0.4)', dot: '#1A5EFF', label: 'Running' },
  pending: { bg: 'hsl(var(--muted))',       text: '#5A6178', border: 'hsl(var(--border))',     dot: '#A1A6B3', label: 'Pending' },
  failed:  { bg: 'hsl(0 84% 60% / 0.15)',   text: '#BE123C', border: 'hsl(0 84% 60% / 0.4)',   dot: '#EF4444', label: 'Failed' },
  skipped: { bg: 'hsl(38 92% 50% / 0.15)',  text: '#92400E', border: 'hsl(38 92% 50% / 0.4)',  dot: '#F59E0B', label: 'Skipped' },
};

function StatusPill({ status }) {
  const s = STATUS_TOKENS[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 22, padding: '0 8px', borderRadius: 4,
      background: s.bg, color: s.text,
      boxShadow: `inset 0 0 0 1px ${s.border}`,
      font: '600 11px Inter',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  );
}

function SupplierRow({ code, status, meta, value }) {
  const s = STATUS_TOKENS[status];
  return (
    <div className="supplier-row">
      <div className="row" style={{ gap: 8 }}>
        <span className="dot" style={{ background: s.dot }} />
        <span style={{ font: '600 12px Inter' }}>{code}</span>
        <span className="muted mono" style={{ fontSize: 11 }}>{meta}</span>
      </div>
      <span className="tabular" style={{ font: '500 12px Inter', color: s.text }}>{value}</span>
    </div>
  );
}

function AdminPipelineScreen() {
  const I = window.Icons;
  const now = "14:00";

  const sourceSuppliers = [
    { code: 'cenor',   status: 'success', meta: 'kl. 13:32 · 4.2s',  value: '1.2 MB' },
    { code: 'difox',   status: 'success', meta: 'kl. 13:34 · 12.8s', value: '24.4 MB' },
    { code: 'dcs',     status: 'running', meta: 'startet kl. 13:55', value: '...' },
    { code: 'dremote', status: 'pending', meta: 'afventer',          value: '—' },
    { code: 'egenta',  status: 'failed',  meta: 'kl. 13:41 · 2.1s',  value: '— FAIL: 504 Gateway Timeout' },
  ];
  const bronzeSuppliers = [
    { code: 'cenor',   status: 'success', meta: 'kl. 13:33 · 1.8s', value: '3,271 rk' },
    { code: 'difox',   status: 'success', meta: 'kl. 13:38 · 8.2s', value: '40,949 rk' },
    { code: 'dcs',     status: 'pending', meta: 'afventer source',  value: '—' },
    { code: 'dremote', status: 'pending', meta: 'afventer source',  value: '—' },
    { code: 'egenta',  status: 'skipped', meta: 'upstream failure', value: '0 rk' },
  ];

  return (
    <>
      <window.TopStrip title="Pipeline status" subtitle={`hourly-cycle-${now} · 3 of 5 suppliers complete`} />
      <div className="page stack-4">
        <div className="admin-banner">
          <I.ShieldAlert size={14} />
          You are viewing the admin pipeline as the synthetic <code className="mono">admin</code> tenant.
          Real customer data is read-only from this screen.
        </div>

        {/* Quick-stat row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Cycle',              value: `hourly-cycle-${now}`, eyebrow: 'Now running' },
            { label: 'Last morning chain', value: '05:15 · 12m 04s',     eyebrow: 'Yesterday' },
            { label: 'Translate queue',    value: '184 / 2,049 EANs',    eyebrow: 'In flight' },
            { label: 'Push status',        value: '6 / 6 customers',     eyebrow: 'Last cycle' },
          ].map(s => (
            <window.Card key={s.label}>
              <window.CardBody>
                <div className="eyebrow">{s.eyebrow}</div>
                <div style={{ font: '600 18px Inter', marginTop: 4 }}>{s.value}</div>
                <div className="muted" style={{ font: '400 12px Inter', marginTop: 2 }}>{s.label}</div>
              </window.CardBody>
            </window.Card>
          ))}
        </div>

        {/* Layer cards */}
        <div className="search-layout">
          <div className="layer-card">
            <div className="layer-card__head">
              <span className="name">Source · Fetch from suppliers</span>
              <StatusPill status="running" />
              <span className="meta" style={{ marginLeft: 'auto' }}>3/5 done</span>
            </div>
            {sourceSuppliers.map(s => <SupplierRow key={s.code} {...s} />)}
          </div>
          <div className="layer-card">
            <div className="layer-card__head">
              <span className="name">Bronze · Parse & validate</span>
              <StatusPill status="pending" />
              <span className="meta" style={{ marginLeft: 'auto' }}>2/5 done · 1 skipped</span>
            </div>
            {bronzeSuppliers.map(s => <SupplierRow key={s.code} {...s} />)}
          </div>
        </div>

        {/* Recent runs */}
        <window.Card>
          <window.CardHeader>
            <window.CardTitle>Recent cycles</window.CardTitle>
            <window.CardDesc>Hourly orchestrator runs · most recent first</window.CardDesc>
          </window.CardHeader>
          <window.CardBody style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr><th>Cycle</th><th>Started</th><th>Duration</th><th>Suppliers</th><th>Pushed</th><th>Status</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono">hourly-cycle-14:00</td>
                  <td className="mono muted">kl. 14:00:02</td>
                  <td className="tabular muted">running…</td>
                  <td className="tabular">3/5</td>
                  <td className="tabular muted">—</td>
                  <td><StatusPill status="running" /></td>
                </tr>
                <tr>
                  <td className="mono">hourly-cycle-13:00</td>
                  <td className="mono muted">kl. 13:00:01</td>
                  <td className="tabular">9m 41s</td>
                  <td className="tabular">5/5</td>
                  <td className="tabular">6/6</td>
                  <td><StatusPill status="success" /></td>
                </tr>
                <tr>
                  <td className="mono">hourly-cycle-12:00</td>
                  <td className="mono muted">kl. 12:00:02</td>
                  <td className="tabular">10m 02s</td>
                  <td className="tabular">5/5</td>
                  <td className="tabular">6/6</td>
                  <td><StatusPill status="success" /></td>
                </tr>
                <tr>
                  <td className="mono">hourly-cycle-11:00</td>
                  <td className="mono muted">kl. 11:00:01</td>
                  <td className="tabular">8m 17s</td>
                  <td className="tabular">4/5 · 1 skipped (egenta)</td>
                  <td className="tabular">6/6</td>
                  <td><StatusPill status="skipped" /></td>
                </tr>
              </tbody>
            </table>
          </window.CardBody>
        </window.Card>
      </div>
    </>
  );
}

Object.assign(window, { AdminPipelineScreen });
