"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

export function NavLink({ href, label, icon, badge }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={"admin-nav-item" + (isActive ? " is-active" : "")}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="admin-nav-icon" aria-hidden="true">{icon}</span>
      <span className="admin-nav-label">{label}</span>
      {badge ? <span className="admin-nav-badge">{badge}</span> : null}
    </Link>
  );
}
