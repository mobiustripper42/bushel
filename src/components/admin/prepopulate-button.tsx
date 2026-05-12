"use client";

import { useState, useTransition } from "react";
import { prepopulateFromLastWeek } from "@/actions/prepopulate-from-last-week";

export function PrepopulateButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  function handleClick() {
    if (!window.confirm("Restore last week's starting inventory? This adds last week's ordered quantities back to current values.")) return;
    setMessage(null);
    startTransition(async () => {
      const result = await prepopulateFromLastWeek();
      if (result.error) {
        setMessage({ kind: "error", text: result.error });
      } else if (result.restoredCount === 0) {
        setMessage({ kind: "success", text: "No prior-week orders to restore from." });
      } else {
        setMessage({ kind: "success", text: `Restored qty on ${result.restoredCount} product${result.restoredCount === 1 ? "" : "s"}.` });
      }
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        style={{
          padding: "8px 16px",
          fontSize: "0.85rem",
          fontWeight: 600,
          background: "var(--paper)",
          color: "var(--ink-900)",
          border: "1px solid var(--ink-200)",
          borderRadius: "var(--r-sm)",
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? "Restoring…" : "Pre-populate from last week"}
      </button>
      {message && (
        <span
          style={{
            fontSize: "0.82rem",
            color: message.kind === "error" ? "var(--destructive)" : "var(--leaf-700)",
          }}
        >
          {message.text}
        </span>
      )}
    </div>
  );
}
