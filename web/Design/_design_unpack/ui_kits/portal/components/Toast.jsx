/* Toast — bottom-right notification stack. Auto-dismisses after 4s. */

function useToasts() {
  const [toasts, setToasts] = React.useState([]);
  const idRef = React.useRef(0);
  const push = React.useCallback((t) => {
    const id = ++idRef.current;
    setToasts((cur) => [...cur, { id, ...t }]);
    setTimeout(() => {
      setToasts((cur) => cur.filter(x => x.id !== id));
    }, 4000);
  }, []);
  return { toasts, push };
}

function ToastStack({ toasts }) {
  const I = window.Icons;
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.variant ?? 'success'}`}>
          {t.variant === 'error'
            ? <I.AlertCircle className="toast__icon" />
            : <I.Check className="toast__icon" />}
          <div>
            <div className="toast__title">{t.title}</div>
            {t.desc && <div className="toast__desc">{t.desc}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { useToasts, ToastStack });
