"use client";

import { useState, useTransition, type MouseEvent } from "react";

import { recordSend } from "@/actions/record-send";
import { buildSmsUrl } from "@/lib/notifications/sms-deep-link";
import type { SendMode } from "@/lib/admin/send-queue-queries";

type SendActionProps = {
  customerId: string;
  phone: string | null;
  body: string;
  weekOf: string;
  mode: SendMode;
  initialSentAt: string | null;
  // revalidatePath target after a send is recorded. Send page → /admin/send;
  // Orders-page action stack (#192) → /admin/orders.
  revalidate: string;
  // Lets a layout wrapper (e.g. SendRow's <li data-sent>) mirror sent-state
  // without owning the send logic.
  onSentChange?: (sent: boolean) => void;
};

// Phase 6.7: when the operator is on desktop, `sms:` deep links either no-op
// or open iMessage on macOS — neither is what Annabel wants when working from
// her laptop. Detect desktop via the pointer-precision media query (touch-
// primary devices report "coarse"; trackpad/mouse report "fine") and fall back
// to copy-body-to-clipboard + the MWS extension bridge.
function isDesktopOperator(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: fine)").matches;
}

function formatSentAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Shared send mechanics + sent-state display (#191). Extracted from SendRow so
// the Orders-page action stack (#192) reuses the deep-link / clipboard / MWS
// bridge and recordSend wiring rather than forking it.
export function SendAction({
  customerId,
  phone,
  body,
  weekOf,
  mode,
  initialSentAt,
  revalidate,
  onSentChange,
}: SendActionProps) {
  const [sentAt, setSentAt] = useState<string | null>(initialSentAt);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const smsHref = phone ? buildSmsUrl({ phone, body }) : null;
  const isSent = sentAt !== null;

  function recordOptimistic() {
    setError(null);
    const optimisticTimestamp = new Date().toISOString();
    setSentAt(optimisticTimestamp);
    onSentChange?.(true);
    startTransition(async () => {
      const result = await recordSend(customerId, weekOf, mode, revalidate);
      if (result.error) {
        setSentAt(initialSentAt);
        onSentChange?.(initialSentAt !== null);
        setError(result.error);
      }
    });
  }

  async function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!phone) return;

    if (isDesktopOperator()) {
      // Desktop path. The Bushel SMS Helper extension (if installed) handles
      // opening + focusing the MWS tab via chrome.tabs from its service
      // worker — admin can't manage the tab itself because COOP on
      // messages.google.com blocks named-target reuse and severs cross-tab
      // postMessage. We just notify the extension via same-window postMessage
      // (which the bridge content script picks up) and provide a clipboard
      // safety net so an operator without the extension can still paste
      // manually after opening MWS themselves.
      e.preventDefault();
      window.postMessage(
        { type: "bushel-sms-helper:fill", phone, body },
        window.location.origin,
      );

      try {
        await navigator.clipboard.writeText(body);
      } catch {
        setError("Clipboard blocked. Copy the message manually, then click Send again.");
        return;
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
    // Mobile path falls through: the <a href="sms:..."> navigation proceeds
    // naturally (no preventDefault), and recordOptimistic() runs below.
    recordOptimistic();
  }

  return (
    <>
      <div className="send-row-status">
        <span className={"send-status" + (isSent ? " is-sent" : "")}>
          {isSent ? `Sent · ${formatSentAt(sentAt!)}` : "Unsent"}
        </span>
        {copied && (
          <span className="send-row-copied" role="status">
            Copied — paste in Messages
          </span>
        )}
        {error && (
          <span className="send-row-error" role="alert">
            {error}
          </span>
        )}
      </div>
      <div className="send-row-action">
        {smsHref ? (
          <a
            href={smsHref}
            className={"btn" + (isSent ? " btn-secondary" : " btn-primary")}
            onClick={handleClick}
            aria-disabled={pending}
          >
            {isSent ? "Re-send" : "Send"}
          </a>
        ) : (
          <span className="send-row-disabled">No phone</span>
        )}
      </div>
    </>
  );
}
