import { NavLink } from "@/components/admin/nav-link";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { AdminMobileNavDrawer, type MobileNavItem } from "@/components/admin/admin-mobile-nav-drawer";
import { signOut } from "@/actions/sign-out";
import {
  getInventoryCount,
  getNewOrdersCount,
  getOrderingOpen,
} from "@/lib/admin/queries";
import { getWeeklyUpdateUnsentCount } from "@/lib/admin/send-queue-queries";
import { shellWeekStringsNY } from "@/lib/week";

const NAV_ITEMS = [
  {
    href: "/admin/inventory",
    label: "Inventory",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 4c0 8-4.5 14-12 14-1 0-2-.1-3-.4"/>
        <path d="M5 19c0-6 4-12 14-15"/>
      </svg>
    ),
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8h14l-1 12H6z"/>
        <path d="M9 8V6a3 3 0 0 1 6 0v2"/>
      </svg>
    ),
  },
  {
    href: "/admin/send",
    label: "Send Update",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 4 3 11l7 2 2 7z"/>
        <path d="m10 13 5-5"/>
      </svg>
    ),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1-.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
      </svg>
    ),
  },
];

export default async function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [inventoryCount, newOrdersCount, isOpen, weeklyUnsentCount] = await Promise.all([
    getInventoryCount(),
    getNewOrdersCount(),
    getOrderingOpen(),
    getWeeklyUpdateUnsentCount(),
  ]);

  const week = shellWeekStringsNY();

  const badgeFor = (href: string): string | undefined => {
    if (href === "/admin/inventory" && inventoryCount > 0) return `${inventoryCount} listed`;
    if (href === "/admin/orders" && newOrdersCount > 0) return `${newOrdersCount} new`;
    if (href === "/admin/send" && weeklyUnsentCount > 0) return `${weeklyUnsentCount} to send`;
    return undefined;
  };

  const mobileItems: MobileNavItem[] = NAV_ITEMS.map(({ href, label }) => ({
    href,
    label,
    badge: badgeFor(href),
  }));

  return (
    <div className="admin-shell">
      <AdminMobileNavDrawer
        items={mobileItems}
        weekRange={week.range}
        weekTopbar={week.topbar}
        isOrderingOpen={isOpen}
      />
      <aside className="admin-side">
        <div className="admin-side-mark">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M21.5 2.5c0 8-4.5 14.5-12 14.5-1.4 0-2.8-.2-4-.7l1.4-1.4c.8.2 1.7.4 2.6.4 6 0 9.5-5.3 10-12.3-2 .6-7.4 2.6-10.4 7.4-1 1.6-1.5 3.4-1.7 5.4l-1.5 1.5c0-3.3.7-6.3 2.4-8.7C11.4 4 18.4 2.6 21.5 2.5z"/>
          </svg>
          <span className="admin-side-brand">Bay Branch Farm</span>
        </div>
        <div className="admin-side-eyebrow">admin · bushel</div>

        <nav className="admin-nav" aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              badge={badgeFor(item.href)}
            />
          ))}
        </nav>

        <div className="admin-side-foot">
          <div className="admin-side-foot-row">
            <div className="admin-side-foot-key">This week</div>
            <div className="admin-side-foot-val">{week.range}</div>
          </div>
          <div className="admin-side-foot-row">
            <div className="admin-side-foot-key">Status</div>
            <div className="admin-side-foot-val">
              <span
                className={"status-dot" + (isOpen ? " is-open" : "")}
                aria-hidden="true"
              />
              {isOpen ? "Open for orders" : "Closed"}
            </div>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-top">
          <AdminBreadcrumb />
          <div className="admin-top-right">
            <div className="admin-week">
              <div className="admin-week-key">Week of</div>
              <div className="admin-week-val">{week.topbar}</div>
            </div>
            <form action={signOut}>
              <button type="submit" className="admin-signout">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <path d="m16 17 5-5-5-5"/>
                  <path d="M21 12H9"/>
                </svg>
                <span>Sign out</span>
              </button>
            </form>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
