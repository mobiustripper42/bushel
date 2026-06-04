/* Admin login + shell */

const { useState } = React;

/* ── Brand mark ─────────────────────────────────────── */
function BrandMark({ size = "lg" }) {
  const dims = size === "lg"
    ? { leaf: 28, font: "1.65rem" }
    : { leaf: 18, font: "1.05rem" };
  return (
    <div className="brand-mark" style={{ gap: size === "lg" ? 12 : 8 }}>
      <span className="brand-leaf" style={{ width: dims.leaf, height: dims.leaf }} aria-hidden="true">
        <svg viewBox="0 0 24 24" width={dims.leaf} height={dims.leaf} fill="currentColor">
          <path d="M21.5 2.5c0 8-4.5 14.5-12 14.5-1.4 0-2.8-.2-4-.7l1.4-1.4c.8.2 1.7.4 2.6.4 6 0 9.5-5.3 10-12.3-2 .6-7.4 2.6-10.4 7.4-1 1.6-1.5 3.4-1.7 5.4l-1.5 1.5c0-3.3.7-6.3 2.4-8.7C11.4 4 18.4 2.6 21.5 2.5z"/>
        </svg>
      </span>
      <span className="brand-name" style={{ fontFamily: "var(--serif)", fontSize: dims.font, fontWeight: 600, letterSpacing: "-0.005em" }}>
        Bay Branch Farm
      </span>
    </div>
  );
}

/* ── Login ───────────────────────────────────────────── */
function AdminLogin() {
  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-mark"><BrandMark size="lg"/></div>
        <div className="login-eyebrow">admin · bushel</div>
        <h1 className="login-title">Welcome back, Annabel.</h1>
        <p className="login-lede">
          Sign in to manage this week's harvest, customers, and orders.
        </p>

        <button type="button" className="btn-google">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.94v2.32A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.03l3.03-2.32z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .94 4.97l3.03 2.32C4.68 5.16 6.66 3.58 9 3.58z"/>
          </svg>
          <span>Sign in with Google</span>
        </button>

        <div className="login-foot">
          Admin only. Customers don't need an account — they receive a private
          link by text.
        </div>
      </div>
      <div className="login-meta">
        <span>Bay Branch Farm · Cleveland, OH</span>
        <span>v0.1 · internal</span>
      </div>
    </div>
  );
}

/* ── Admin shell with placeholder content ───────────── */
function AdminShell({ initialPage }) {
  const [page, setPage] = useState(initialPage || "inventory");

  const nav = [
    { id: "inventory", label: "Inventory", icon: <IconLeaf/>,    badge: "12 listed" },
    { id: "customers", label: "Customers", icon: <IconUsers/>,   badge: null },
    { id: "broadcast", label: "Send Texts", icon: <IconSend/>,   badge: null },
    { id: "orders",    label: "Orders",    icon: <IconBag/>,     badge: "4 new" },
    { id: "settings",  label: "Settings",  icon: <IconCog/>,     badge: null },
  ];

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-side-mark"><BrandMark size="sm"/></div>
        <div className="admin-side-eyebrow">admin · bushel</div>
        <nav className="admin-nav">
          {nav.map(item => (
            <button
              key={item.id}
              type="button"
              className={"admin-nav-item" + (page === item.id ? " is-active" : "")}
              onClick={() => setPage(item.id)}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              <span className="admin-nav-label">{item.label}</span>
              {item.badge && <span className="admin-nav-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="admin-side-foot">
          <div className="admin-side-foot-row">
            <div className="admin-side-foot-key">This week</div>
            <div className="admin-side-foot-val">May 3 – May 9</div>
          </div>
          <div className="admin-side-foot-row">
            <div className="admin-side-foot-key">Status</div>
            <div className="admin-side-foot-val">
              <span className="status-dot is-open"></span> Open for orders
            </div>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-top">
          <div className="admin-crumb">
            <span>Admin</span>
            <span className="admin-crumb-sep">/</span>
            <span className="admin-crumb-active">{nav.find(n => n.id === page).label}</span>
          </div>
          <div className="admin-top-right">
            <div className="admin-week">
              <div className="admin-week-key">Week of</div>
              <div className="admin-week-val">Sun, May 3</div>
            </div>
            <button type="button" className="admin-signout">
              <IconSignOut/>
              <span>Sign out</span>
            </button>
          </div>
        </header>

        <main className="admin-content">
          <PagePlaceholder name={nav.find(n => n.id === page).label}/>
        </main>
      </div>
    </div>
  );
}

function PagePlaceholder({ name }) {
  return (
    <div className="admin-placeholder">
      <div className="admin-page-head">
        <div>
          <div className="eyebrow" style={{marginBottom: 6}}>section</div>
          <h1 className="admin-page-title">{name}</h1>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="btn btn-secondary">Export</button>
          <button type="button" className="btn btn-primary">+ New</button>
        </div>
      </div>
      <div className="admin-empty">
        <svg viewBox="0 0 80 80" width="56" height="56" aria-hidden="true">
          <rect x="14" y="20" width="52" height="44" rx="4" fill="#EDF5E5" stroke="#3B6D11" strokeOpacity="0.4"/>
          <line x1="22" y1="32" x2="58" y2="32" stroke="#3B6D11" strokeOpacity="0.3" strokeWidth="1.5"/>
          <line x1="22" y1="42" x2="58" y2="42" stroke="#3B6D11" strokeOpacity="0.3" strokeWidth="1.5"/>
          <line x1="22" y1="52" x2="48" y2="52" stroke="#3B6D11" strokeOpacity="0.3" strokeWidth="1.5"/>
        </svg>
        <div className="admin-empty-title">{name} content goes here.</div>
        <div className="admin-empty-sub">
          We'll wire this section in the next pass — shell + nav are scaffolded
          so we can drop tables, forms, and detail panes in cleanly.
        </div>
      </div>
    </div>
  );
}

/* ── Icons (24px stroke) ────────────────────────────── */
function IconLeaf() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 4c0 8-4.5 14-12 14-1 0-2-.1-3-.4"/>
      <path d="M5 19c0-6 4-12 14-15"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5"/>
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
      <circle cx="17" cy="9" r="2.5"/>
      <path d="M15 14.5c1-.3 2-.5 2.5-.5 2.5 0 4.5 2 4.5 4.5"/>
    </svg>
  );
}
function IconBag() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8h14l-1 12H6z"/>
      <path d="M9 8V6a3 3 0 0 1 6 0v2"/>
    </svg>
  );
}
function IconSend() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 4 3 11l7 2 2 7z"/>
      <path d="m10 13 5-5"/>
    </svg>
  );
}
function IconCog() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
    </svg>
  );
}
function IconSignOut() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <path d="m16 17 5-5-5-5"/>
      <path d="M21 12H9"/>
    </svg>
  );
}

window.AdminLogin = AdminLogin;
window.AdminShell = AdminShell;
