"use client";

import { useTransition } from "react";
import { toggleCustomerActive } from "@/actions/customers";

export function CustomerActiveToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await toggleCustomerActive(id, !isActive);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={isActive ? "Deactivate customer" : "Activate customer"}
      style={{
        padding: "4px 10px",
        fontSize: "0.78rem",
        fontWeight: 600,
        background: isActive ? "var(--paper)" : "var(--leaf-600)",
        color: isActive ? "var(--ink-700)" : "var(--paper)",
        border: `1px solid ${isActive ? "var(--ink-200)" : "var(--leaf-600)"}`,
        borderRadius: "var(--r-sm)",
        cursor: pending ? "default" : "pointer",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? "…" : isActive ? "Deactivate" : "Activate"}
    </button>
  );
}
