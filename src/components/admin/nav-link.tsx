"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export function NavLink({ href, label, icon }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: "var(--r-sm)",
        color: isActive ? "var(--paper)" : "rgba(251,250,245,0.78)",
        background: isActive ? "rgba(251,250,245,0.10)" : "transparent",
        fontSize: "0.93rem",
        fontWeight: 500,
        textDecoration: "none",
        transition: "background 0.12s, color 0.12s",
      }}
      aria-current={isActive ? "page" : undefined}
    >
      {isActive && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -18,
            top: "50%",
            transform: "translateY(-50%)",
            width: 3,
            height: 22,
            background: "var(--leaf-100)",
            borderRadius: "0 3px 3px 0",
          }}
        />
      )}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          color: isActive ? "var(--leaf-100)" : "rgba(251,250,245,0.6)",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
    </Link>
  );
}
