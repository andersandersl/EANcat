/* App shell — router + auth + feed state. Wires Navigation + screens. */

function App() {
  // Auth — null = anonymous, else the email string
  const [auth, setAuth] = React.useState(null);
  const [isAdmin, setAdmin] = React.useState(false);
  const [route, setRoute] = React.useState("/");
  const [collapsed, setCollapsed] = React.useState(() => {
    try { return localStorage.getItem("eanrunner.railCollapsed") === "1"; } catch { return false; }
  });
  React.useEffect(() => {
    try { localStorage.setItem("eanrunner.railCollapsed", collapsed ? "1" : ""); } catch {}
  }, [collapsed]);

  // Feed state — Set of selected EANs + Set of dismissed EANs
  const [feedSelected, setFeedSelected] = React.useState(() => new Set());
  const [feedDismissed, setFeedDismissed] = React.useState(() => new Set());
  // Mirror dismissed on the Set for convenience access from .has(...)
  React.useEffect(() => { feedSelected.dismissed = feedDismissed; }, [feedSelected, feedDismissed]);

  const addToFeed = (ean) => {
    setFeedSelected((cur) => {
      const next = new Set(cur);
      next.add(ean);
      return next;
    });
    setFeedDismissed((cur) => {
      if (!cur.has(ean)) return cur;
      const next = new Set(cur); next.delete(ean); return next;
    });
  };
  const dismissFromFeed = (ean) => {
    setFeedSelected((cur) => {
      if (!cur.has(ean)) return cur;
      const next = new Set(cur); next.delete(ean); return next;
    });
    setFeedDismissed((cur) => {
      const next = new Set(cur); next.add(ean); return next;
    });
  };
  const restoreToFeed = (ean) => addToFeed(ean);

  const { toasts, push: pushToast } = window.useToasts();

  if (!auth) {
    return (
      <>
        <window.LoginScreen onLogin={(email) => { setAuth(email); setRoute("/"); }} />
        <window.ToastStack toasts={toasts} />
      </>
    );
  }

  let screen;
  if (route.startsWith("/product/")) {
    const ean = route.split("/product/")[1];
    screen = <window.ProductDetailScreen ean={ean} setRoute={setRoute}
      feed={feedSelected} addToFeed={addToFeed} dismissFromFeed={dismissFromFeed} pushToast={pushToast} />;
  } else if (route.startsWith("/feed")) {
    screen = <window.PricePilotScreen feed={feedSelected} dismissFromFeed={dismissFromFeed}
      setRoute={setRoute} pushToast={pushToast} />;
  } else if (route.startsWith("/admin")) {
    screen = <window.AdminPipelineScreen />;
  } else {
    // mirror dismissed onto the feedSelected Set for ProductRow's lookup
    const feed = feedSelected;
    feed.dismissed = feedDismissed;
    screen = <window.SearchScreen feed={feed} addToFeed={addToFeed} dismissFromFeed={dismissFromFeed}
      restoreToFeed={restoreToFeed} setRoute={setRoute} pushToast={pushToast} />;
  }

  return (
    <div className={`app ${collapsed ? 'is-collapsed' : ''}`}>
      <window.Navigation
        route={route} setRoute={setRoute}
        isAdmin={isAdmin} setAdmin={setAdmin}
        onSignOut={() => { setAuth(null); setRoute("/"); }}
        customerId={isAdmin ? "admin" : "ip_agency"}
        userEmail={auth}
        feedCount={feedSelected.size}
        collapsed={collapsed} setCollapsed={setCollapsed}
      />
      <main style={{ minWidth: 0 }}>{screen}</main>
      <window.ToastStack toasts={toasts} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
