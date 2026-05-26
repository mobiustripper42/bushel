"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { prepopulateFromLastWeek } from "@/actions/prepopulate-from-last-week";

function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 8v5l3 2" />
    </svg>
  );
}

export function PrepopulateButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  function handleClick() {
    if (
      !window.confirm(
        "Reset every product's qty to last week's ordered total (or 0 if not ordered last week)? Current qty values will be replaced. Unit prices are NOT changed.",
      )
    )
      return;
    setMessage(null);
    startTransition(async () => {
      const result = await prepopulateFromLastWeek();
      if (result.error) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      // Pull the restored values back into the inline editor's local state.
      // revalidatePath alone refreshes the server cache but doesn't re-mount
      // the client useState — router.refresh + the editor's initialRows
      // useEffect close the loop.
      router.refresh();
      if (result.restoredCount === 0) {
        setMessage({ kind: "success", text: "No prior-week orders to restore from." });
      } else {
        setMessage({
          kind: "success",
          text: `Restored qty on ${result.restoredCount} product${result.restoredCount === 1 ? "" : "s"}.`,
        });
      }
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={handleClick} disabled={pending}>
        <IconHistory />
        <span>{pending ? "Restoring…" : "Pre-populate from last week"}</span>
      </Button>
      {message && (
        <span
          role="status"
          style={{
            fontSize: "0.82rem",
            color: message.kind === "error" ? "var(--rose-600)" : "var(--leaf-700)",
            alignSelf: "center",
          }}
        >
          {message.text}
        </span>
      )}
    </>
  );
}
