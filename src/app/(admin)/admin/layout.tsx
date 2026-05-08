import { NavLink } from "@/components/admin/nav-link";
import { signOut } from "@/actions/sign-out";

const NAV_ITEMS = [
  {
    href: "/admin/inventory",
    label: "Inventory",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 4c0 8-4.5 14-12 14-1 0-2-.1-3-.4"/>
        <path d="M5 19c0-6 4-12 14-15"/>
      </svg>
    ),
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="8" r="3.5"/>
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
        <circle cx="17" cy="9" r="2.5"/>
        <path d="M15 14.5c1-.3 2-.5 2.5-.5 2.5 0 4.5 2 4.5 4.5"/>
      </svg>
    ),
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 8h14l-1 12H6z"/>
        <path d="M9 8V6a3 3 0 0 1 6 0v2"/>
      </svg>
    ),
  },
  {
    href: "/admin/send",
    label: "Send Update",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 4 3 11l7 2 2 7z"/>
        <path d="m10 13 5-5"/>
      </svg>
    ),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1-.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
      </svg>
    ),
  },
];

export default function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        background: "var(--cream)",
        fontFamily: "var(--font-sans)",
        color: "var(--ink-900)",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          background: "var(--ink-900)",
          color: "var(--paper)",
          padding: "22px 18px 18px",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* Brand mark */}
        <div style={{ padding: "0 6px", marginBottom: 4 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--leaf-100)" aria-hidden="true">
              <path d="M21.5 2.5c0 8-4.5 14.5-12 14.5-1.4 0-2.8-.2-4-.7l1.4-1.4c.8.2 1.7.4 2.6.4 6 0 9.5-5.3 10-12.3-2 .6-7.4 2.6-10.4 7.4-1 1.6-1.5 3.4-1.7 5.4l-1.5 1.5c0-3.3.7-6.3 2.4-8.7C11.4 4 18.4 2.6 21.5 2.5z"/>
            </svg>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 600, color: "var(--paper)", letterSpacing: "-0.005em", whiteSpace: "nowrap" }}>
              Bay Branch Farm
            </span>
          </div>
        </div>

        {/* Eyebrow */}
        <div
          style={{
            fontSize: "0.66rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "rgba(251,250,245,0.5)",
            padding: "0 6px",
            marginBottom: 24,
          }}
        >
          admin · bushel
        </div>

        {/* Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }} aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
          ))}
        </nav>

        {/* Sign out */}
        <div style={{ borderTop: "1px solid rgba(251,250,245,0.08)", paddingTop: 14, marginTop: 14 }}>
          <form action={signOut}>
            <button
              type="submit"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                border: "none",
                color: "rgba(251,250,245,0.55)",
                fontSize: "0.82rem",
                cursor: "pointer",
                padding: "6px 12px",
                borderRadius: "var(--r-sm)",
                width: "100%",
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <path d="m16 17 5-5-5-5"/>
                <path d="M21 12H9"/>
              </svg>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", overflow: "auto" }}>
        {children}
      </div>
    </div>
  );
}
