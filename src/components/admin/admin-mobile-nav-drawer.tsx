"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/actions/sign-out";
import { VersionTag } from "@/components/VersionTag";

export type MobileNavItem = {
  href: string;
  label: string;
  badge?: string;
};

type AdminMobileNavDrawerProps = {
  items: MobileNavItem[];
  weekRange: string;
  weekTopbar: string;
  isOrderingOpen: boolean;
};

export function AdminMobileNavDrawer({
  items,
  weekRange,
  weekTopbar,
  isOrderingOpen,
}: AdminMobileNavDrawerProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div className="admin-mobile-bar">
        <Link href="/admin" className="admin-mobile-brand">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M21.5 2.5c0 8-4.5 14.5-12 14.5-1.4 0-2.8-.2-4-.7l1.4-1.4c.8.2 1.7.4 2.6.4 6 0 9.5-5.3 10-12.3-2 .6-7.4 2.6-10.4 7.4-1 1.6-1.5 3.4-1.7 5.4l-1.5 1.5c0-3.3.7-6.3 2.4-8.7C11.4 4 18.4 2.6 21.5 2.5z"/>
          </svg>
          <span>Bay Branch Farm</span>
        </Link>
        <div className="admin-mobile-week">{weekTopbar}</div>
        <button
          type="button"
          className="admin-mobile-hamburger"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls="admin-mobile-drawer"
        >
          <svg viewBox="0 0 20 20" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <line x1="2" y1="5" x2="18" y2="5" />
            <line x1="2" y1="10" x2="18" y2="10" />
            <line x1="2" y1="15" x2="18" y2="15" />
          </svg>
        </button>
      </div>

      {open && (
        <div
          className="admin-mobile-scrim"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="admin-mobile-drawer"
        className={"admin-mobile-drawer" + (open ? " is-open" : "")}
        aria-label="Admin navigation"
        aria-hidden={!open}
      >
        <div className="admin-mobile-drawer-head">
          <div>
            <div className="admin-mobile-drawer-brand">Bay Branch Farm</div>
            <div className="admin-mobile-drawer-eyebrow">admin · bushel</div>
          </div>
          <button
            type="button"
            className="admin-mobile-drawer-close"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <line x1="2" y1="2" x2="14" y2="14" />
              <line x1="14" y1="2" x2="2" y2="14" />
            </svg>
          </button>
        </div>

        <nav className="admin-mobile-nav">
          {items.map(({ href, label, badge }) => {
            const active =
              pathname === href ||
              (href !== "/admin" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={"admin-mobile-nav-link" + (active ? " is-active" : "")}
                aria-current={active ? "page" : undefined}
              >
                <span>{label}</span>
                {badge && <span className="admin-mobile-nav-badge">{badge}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="admin-mobile-drawer-foot">
          <div className="admin-mobile-foot-row">
            <div className="admin-mobile-foot-key">This week</div>
            <div className="admin-mobile-foot-val">{weekRange}</div>
          </div>
          <div className="admin-mobile-foot-row">
            <div className="admin-mobile-foot-key">Status</div>
            <div className="admin-mobile-foot-val">
              <span
                className={"status-dot" + (isOrderingOpen ? " is-open" : "")}
                aria-hidden="true"
              />
              {isOrderingOpen ? "Open for orders" : "Closed"}
            </div>
          </div>
          <VersionTag className="admin-mobile-version" />
          <form action={signOut} className="admin-mobile-signout-form">
            <button type="submit" className="admin-mobile-signout">
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
