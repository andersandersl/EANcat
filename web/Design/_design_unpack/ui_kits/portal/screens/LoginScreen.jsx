/* LoginScreen — split-screen with the EANrunner mark as the hero.
   Left:  dark cobalt stage. Big inline 3-bar mark (the logo) animates in
          stagger across the centre. Wordmark up top, pitch beneath the mark,
          live pipeline pulse anchored to the bottom.
   Right: sign-in form with status badge + version corner.
*/

function LoginScreen({ onLogin }) {
  const I = window.Icons;
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState(null);

  const submit = (e) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError("Enter your email and password."); return; }
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); onLogin(email); }, 600);
  };
  const demo = () => {
    // One-click demo: skip the form and sign in directly.
    setEmail("operator@ip-agency.dk");
    setPassword("demo");
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); onLogin("operator@ip-agency.dk"); }, 400);
  };

  // Cycle clock — updates every second so the pulse widget feels alive.
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return (
    <div className="login-screen">
      {/* ── Left stage ─────────────────────────────────────────────── */}
      <div className="login-stage">
        <div className="login-stage__brand">
          <img src="../../assets/eanrunner-logo-white.png" alt="EANrunner" />
        </div>

        {/* Hero mark — the exact icon SVG, scaled up, with each bar
            animating independently. */}
        <div className="bigmark" aria-hidden="true">
          <svg viewBox="0 0 196.08 121.22" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="barGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#7AA8FF" stopOpacity="0.85" />
                <stop offset="50%"  stopColor="#C8D9FF" stopOpacity="1" />
                <stop offset="100%" stopColor="#7AA8FF" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            <path className="bar b1" d="M196.08,0l-7.29,27.76-121.07.45c-11.32-2.62-5.38-28.22,4.69-28.22h123.67Z" />
            <path className="bar b3" d="M183.92,47.03l-7.29,27.76-170.49.45c-11.32-2.62-5.38-28.22,4.69-28.22h173.09Z" />
            <path className="bar b2" d="M172.17,93l-7.29,27.76-98.86.45c-11.32-2.62-5.38-28.22,4.69-28.22h101.46Z" />
          </svg>
        </div>

        <div className="login-stage__pitch">
          <span className="eyebrow">Product Feed Operations</span>
          <h1>One feed.<br />Five suppliers.<br /><em>Cheapest wins, every hour.</em></h1>
          <p>
            494,000 Nordic products. Consolidated, enriched, translated,
            pushed to your webshop — on the hour, every hour.
          </p>
        </div>

        <div className="pulse">
          <div className="pulse__head">
            <span className="label">Pipeline pulse</span>
            <span className="cycle">hourly-cycle-{hh}:00 · live</span>
          </div>
          <div className="pulse__rows">
            <div className="pulse__row">
              <span className="name"><span className="dot ok" /><span className="label-text">cenor</span></span>
              <span className="val">3,271 rk</span>
            </div>
            <div className="pulse__row">
              <span className="name"><span className="dot ok" /><span className="label-text">difox</span></span>
              <span className="val">40,949 rk</span>
            </div>
            <div className="pulse__row">
              <span className="name"><span className="dot run" /><span className="label-text">dcs</span></span>
              <span className="val">running…</span>
            </div>
            <div className="pulse__row">
              <span className="name"><span className="dot ok" /><span className="label-text">dremote</span></span>
              <span className="val">227.8k rk</span>
            </div>
            <div className="pulse__row">
              <span className="name"><span className="dot warn" /><span className="label-text">egenta</span></span>
              <span className="val">skipped</span>
            </div>
            <div className="pulse__row">
              <span className="name"><span className="dot ok" /><span className="label-text">pricerunner</span></span>
              <span className="val">{hh}:{mm}:{ss}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right pane ─────────────────────────────────────────────── */}
      <div className="login-pane">
        <span className="login-pane__corner">v1.4.2</span>
        <div className="login-card">
          <div className="login-card__hero">
            <span className="badge">All systems operational</span>
            <h2>Sign in to the portal</h2>
            <p>Use the credentials provided by your account manager.</p>
          </div>
          <form className="stack-4" onSubmit={submit}>
            <div className="stack-2">
              <window.Label htmlFor="email">Email</window.Label>
              <window.Input id="email" type="email" autoComplete="username"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@reseller.dk" />
            </div>
            <div className="stack-2">
              <window.Label htmlFor="password">Password</window.Label>
              <window.Input id="password" type="password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" />
            </div>
            {error && (
              <p style={{ font: '400 13px Inter', color: 'hsl(var(--destructive))', margin: 0 }}>{error}</p>
            )}
            <window.Button variant="primary" type="submit" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? <I.Loader2 size={14} /> : null}
              Sign in
            </window.Button>
          </form>

          <div className="login-card__divider">or</div>
          <window.Button variant="outline" onClick={demo} style={{ width: '100%' }}>
            Use demo account
          </window.Button>

          <div className="login-card__support">
            <span>Need help? <a href="#">Contact support</a></span>
            <span className="mono" style={{ fontSize: 11 }}>EANrunner · 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen });
