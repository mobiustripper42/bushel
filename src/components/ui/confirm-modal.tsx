"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  confirmDanger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  title,
  body,
  confirmLabel,
  confirmDanger = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <>
      <div className="modal-scrim" onClick={onCancel} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
        <div className="modal-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z" />
          </svg>
        </div>
        <h3 id="confirm-modal-title" className="modal-title">{title}</h3>
        <div className="modal-body">{body}</div>
        <div className="modal-actions">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            variant={confirmDanger ? "destructive-solid" : "primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working..." : confirmLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
