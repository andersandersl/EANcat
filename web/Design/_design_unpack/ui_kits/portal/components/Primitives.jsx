/* Primitive components — Card, Button, Input, Label, Select, Switch, Toggle.
   Cosmetic recreations of shadcn-ui primitives. Variants live as CSS
   classes (see styles.css); we just pick the right class names here. */

function Button({ variant = "primary", size = "md", as = "button", icon, iconOnly, children, className = "", ...rest }) {
  const cls = [
    "btn",
    `btn--${variant}`,
    size === "sm" && "btn--sm",
    size === "xs" && "btn--xs",
    iconOnly && "btn--icon",
    className,
  ].filter(Boolean).join(" ");
  const C = as;
  return <C className={cls} {...rest}>{icon}{children}</C>;
}

function Card({ className = "", children, ...rest }) {
  return <div className={`card ${className}`} {...rest}>{children}</div>;
}
function CardHeader({ children, className = "" }) { return <div className={`card__header ${className}`}>{children}</div>; }
function CardTitle({ children }) { return <div className="card__title">{children}</div>; }
function CardDesc({ children })  { return <div className="card__desc">{children}</div>; }
function CardBody({ children, className = "" })   { return <div className={`card__body ${className}`}>{children}</div>; }

function Input({ size = "md", className = "", ...rest }) {
  return <input className={`input ${size === "sm" ? "input--sm" : ""} ${className}`} {...rest} />;
}
function Label({ htmlFor, children }) {
  return <label className="label" htmlFor={htmlFor}>{children}</label>;
}

function Switch({ checked, onChange, id }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      id={id}
      className={`switch ${checked ? "is-on" : ""}`}
      onClick={() => onChange?.(!checked)}
    />
  );
}

function ToggleGroup({ options, value, onChange, ariaLabel }) {
  return (
    <div className="toggle-group" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={value === opt ? "is-on" : ""}
          onClick={() => onChange(opt)}
        >{opt}</button>
      ))}
    </div>
  );
}

function Select({ value, onChange, options, id, className = "" }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`input ${className}`}
      style={{ paddingRight: 30, appearance: 'auto', cursor: 'pointer' }}
    >
      {options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  );
}

Object.assign(window, { Button, Card, CardHeader, CardTitle, CardDesc, CardBody, Input, Label, Switch, ToggleGroup, Select });
