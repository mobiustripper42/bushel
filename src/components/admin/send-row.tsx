"use client";

import { useState, useTransition, type MouseEvent } from "react";

import { recordSend } from "@/actions/record-send";
import { buildSmsUrl } from "@/lib/notifications/sms-deep-link";
import type { SendMode } from "@/lib/admin/send-queue-queries";

type SendRowProps = {
  customerId: string;
  customerName: string;
  phone: string | null;
  body: string;
  weekOf: string;
  mode: SendMode;
  initialSentAt: string | null;
};

const MESSAGES_WEB_URL = "https://messages.google.com/web/conversations";

// Phase 6.7: when the operator is on desktop, `sms:` deep links either no-op
// or open iMessage on macOS — neither is what Annabel wants when working from
// her laptop. Detect desktop via the pointer-precision media query (touch-
// primary devices report "coarse"; trackpad/mouse report "fine") and fall back
// to copy-body-to-clipboard + open messages.google.com in a new tab.
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

export function SendRow({
  customerId,
  customerName,
  phone,
  body,
  weekOf,
  mode,
  initialSentAt,
}: SendRowProps) {
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
    startTransition(async () => {
      const result = await recordSend(customerId, weekOf, mode);
      if (result.error) {
        setSentAt(initialSentAt);
        setError(result.error);
      }
    });
  }

  async function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!phone) return;

    if (isDesktopOperator()) {
      // Desktop path. Notify the optional Bushel SMS Helper extension via
      // same-window postMessage — its bridge content script (on this origin)
      // picks it up and stashes the payload in chrome.storage.session for the
      // MWS content script to consume on tab load. Falls back silently to the
      // clipboard path if no extension is installed (no bridge means no one
      // listens to this postMessage, no harm done).
      e.preventDefault();
      window.postMessage(
        { type: "bushel-sms-helper:fill", phone, body },
        window.location.origin,
      );
      // Named target "bushel-mws" so successive Sends reuse the same MWS tab
      // instead of stacking new ones. Synchronous open inside the click
      // handler to dodge popup blockers. If the named tab exists, this
      // focuses it; the service worker's reload (triggered by the bridge
      // deposit) forces the content script to re-run with the new payload.
      // No noopener/noreferrer — name-target reuse requires the opener
      // relationship, and the extension's content-script gate is the
      // equivalent guard.
      window.open(MESSAGES_WEB_URL, "bushel-mws");

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
    <li className="send-row" data-customer-id={customerId} data-sent={isSent ? "true" : "false"}>
      <div className="send-row-name">
        <div className="send-row-customer">{customerName}</div>
        <div className="send-row-phone">{phone ?? "no phone on file"}</div>
      </div>
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
    </li>
  );
}
