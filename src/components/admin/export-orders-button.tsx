"use client";

import { useEffect, useRef, useState } from "react";

import { csvFilename, toCsv, toTsv } from "@/lib/admin/export-orders";
import type { OrderRow } from "@/lib/admin/order-status";

type Props = {
  orders: OrderRow[];
  // Goes into the download filename verbatim (e.g. "active-2026-06-29") —
  // a label, not a date. DEC-045's views span weeks, so no single week_of
  // describes an export's contents.
  filenameLabel: string;
};

export function ExportOrdersButton({ orders, filenameLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const disabled = orders.length === 0;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!feedback) return;
    const id = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(id);
  }, [feedback]);

  function downloadCsv() {
    const blob = new Blob([toCsv(orders)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename(filenameLabel);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setOpen(false);
    setFeedback("CSV downloaded");
  }

  async function copyTsv() {
    try {
      await navigator.clipboard.writeText(toTsv(orders));
      setFeedback("Copied to clipboard");
    } catch (err) {
      console.warn("copyTsv: clipboard write failed", err);
      setFeedback("Clipboard blocked — try CSV");
    }
    setOpen(false);
  }

  return (
    <div className="split-btn-wrap" ref={wrapRef} data-testid="export-orders">
      <button
        type="button"
        className="split-btn-main"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>Export to Wave</span>
        <span className="split-btn-divider" aria-hidden="true"></span>
        <span className="split-btn-chev" aria-hidden="true">▾</span>
      </button>
      {open && (
        <>
          <div
            className="split-scrim"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          ></div>
          {/* Plain popover with two buttons — not a true ARIA menu
              (no arrow-key nav, no focus trap, no roving tabindex). Avoid
              role="menu" so assistive tech doesn't promise behavior we
              don't implement. */}
          <div className="split-menu">
            <button
              type="button"
              className="split-item"
              onClick={downloadCsv}
            >
              <div>
                <div className="split-item-title">Download CSV</div>
                <div className="split-item-sub">Open in Wave&rsquo;s import flow.</div>
              </div>
            </button>
            <button
              type="button"
              className="split-item"
              onClick={copyTsv}
            >
              <div>
                <div className="split-item-title">Copy as TSV</div>
                <div className="split-item-sub">Paste into a spreadsheet directly.</div>
              </div>
            </button>
          </div>
        </>
      )}
      {feedback && (
        <span className="export-feedback" role="status" aria-live="polite">
          {feedback}
        </span>
      )}
    </div>
  );
}
