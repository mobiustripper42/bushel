"use client";

import { usePathname } from "next/navigation";

const PAGE_LABELS: Record<string, string> = {
  "/admin/inventory": "Inventory",
  "/admin/customers": "Customers",
  "/admin/orders": "Orders",
  "/admin/send": "Send Update",
  "/admin/settings": "Settings",
};

function resolveLabel(pathname: string): string {
  // Exact match first, then longest-prefix match (so /admin/inventory/abc
  // still resolves to "Inventory" once detail routes exist).
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];
  for (const prefix of Object.keys(PAGE_LABELS)) {
    if (pathname.startsWith(prefix + "/")) return PAGE_LABELS[prefix];
  }
  return "Admin";
}

export function AdminBreadcrumb() {
  const pathname = usePathname();
  const label = resolveLabel(pathname);
  return (
    <div className="admin-crumb">
      <span>Admin</span>
      <span className="admin-crumb-sep" aria-hidden="true">/</span>
      <span className="admin-crumb-active">{label}</span>
    </div>
  );
}
