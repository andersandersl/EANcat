/* Navigation rail — labelled 220px (expanded) ↔ icon-only 60px with
   left-edge indicator bar (collapsed). State persists to localStorage.
   Admin items render in amber and only appear when isAdmin is true. */

function NavItem({ label, Icon, isActive, isAdmin, count, onClick }) {
  const cls = [
    "nav-item",
    isAdmin && "is-admin",
    isActive && "is-active",
  ].filter(Boolean).join(" ");
  return (
    <button className={cls} onClick={onClick} title={label}>
      <Icon />
      <span className="nav-item__label">{label}</span>
      {count != null && <span className="nav-item__count">{count}</span>}
    </button>
  );
}

function Navigation({ route, setRoute, isAdmin, setAdmin, onSignOut, customerId = "ip_agency", userEmail = "operator@ip-agency.dk", feedCount = 0, collapsed, setCollapsed }) {
  const I = window.Icons;
  const items = [
    { to: "/",         label: "Search Products",  Icon: I.Search,   match: (p) => p === "/" || p.startsWith("/product/"), count: null },
    { to: "/feed",     label: "Feed",             Icon: I.Tags,     match: (p) => p.startsWith("/feed"),                  count: feedCount > 0 ? feedCount : null },
  ];
  const adminItems = [
    { to: "/admin",            label: "Pipeline status",     Icon: I.Activity, match: (p) => p === "/admin" },
    { to: "/admin/suppliers",  label: "Customer suppliers",  Icon: I.Truck,    match: () => false },
    { to: "/admin/onboarding", label: "Onboarding",          Icon: I.UserPlus, match: () => false },
    { to: "/admin/users",      label: "User management",     Icon: I.Users,    match: () => false },
  ];
  const [userOpen, setUserOpen] = React.useState(false);
  const initials = userEmail.slice(0, 2).toUpperCase();

  return (
    <aside className={`rail ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="rail__brand">
        <img src="../../assets/logo-icon-blue.png" alt="" />
        <span className="wm">EAN<span className="r">runner</span></span>
        <button className="rail__toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand' : 'Collapse'}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      </div>

      <div className="rail__group-label">Workspace</div>
      <div className="rail__items">
        {items.map((it) => (
          <NavItem key={it.to} {...it} isActive={it.match(route)} onClick={() => setRoute(it.to)} />
        ))}
      </div>

      {isAdmin && (
        <>
          <div className="rail__group-label is-admin">Admin</div>
          <div className="rail__sep" />
          <div className="rail__items--admin">
            {adminItems.map((it) => (
              <NavItem key={it.to} {...it} isAdmin isActive={it.match(route)} onClick={() => setRoute(it.to)} />
            ))}
          </div>
        </>
      )}

      <div className="rail__bottom" style={{ position: 'relative' }}>
        <button className="user-tile" onClick={() => setUserOpen(v => !v)} title={userEmail}>
          <span className="avatar">{initials}</span>
          <span className="who">
            <span className="e">{userEmail}</span>
            <span className="t">{customerId}</span>
          </span>
        </button>
        {userOpen && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 6px)',
            left: collapsed ? 32 : 4, right: collapsed ? 'auto' : 4,
            minWidth: collapsed ? 220 : 'auto',
            zIndex: 30,
            background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-pop)',
            padding: 4,
          }}>
            <button onClick={() => { setAdmin(!isAdmin); setUserOpen(false); }}
              style={{
                width: '100%', textAlign: 'left',
                background: 'transparent', border: 0, cursor: 'pointer',
                padding: '8px 10px', borderRadius: 6,
                display: 'flex', alignItems: 'center', gap: 8,
                font: '400 13px Inter',
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'hsl(var(--accent) / 0.4)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <I.ShieldAlert size={14} style={{ color: 'hsl(var(--admin))' }} />
              {isAdmin ? 'Stop viewing as admin' : 'View as admin'}
            </button>
            <button onClick={() => { setUserOpen(false); onSignOut?.(); }}
              style={{
                width: '100%', textAlign: 'left',
                background: 'transparent', border: 0, cursor: 'pointer',
                padding: '8px 10px', borderRadius: 6,
                display: 'flex', alignItems: 'center', gap: 8,
                font: '400 13px Inter',
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'hsl(var(--accent) / 0.4)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <I.LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function TopStrip({ title, subtitle }) {
  return (
    <div className="topstrip">
      <div className="topstrip__title">{title}</div>
      {subtitle && <div className="topstrip__sub">{subtitle}</div>}
    </div>
  );
}

Object.assign(window, { Navigation, TopStrip });
