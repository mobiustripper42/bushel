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
const MESSAGES_WEB_ORIGIN = "https://messages.google.com";

// Optional sideloaded Chromium extension (extensions/messages-for-web/) listens
// on the Messages-for-Web tab. If installed, it replies with bushel-sms-ok
// within EXTENSION_REPLY_TIMEOUT_MS and we show "Filled in Messages" instead
// of "Copied — paste in Messages." If absent or it errors, the clipboard
// fallback covers — clipboard write happens either way as a safety net.
//
// 20s is sized for Messages-for-Web cold loads, which routinely take 10s+
// before the content script reaches `document_idle` on a fresh tab.
const EXTENSION_REPLY_TIMEOUT_MS = 20000;

// Phase 6.7: when the operator is on desktop, `sms:` deep links either no-op
// or open iMessage on macOS — neither is what Annabel wants when working from
// her laptop. Detect desktop via the pointer-precision media query (touch-
// primary devices report "coarse"; trackpad/mouse report "fine") and fall back
// to copy-body-to-clipboard + open messages.google.com in a new tab.
function isDesktopOperator(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: fine)").matches;
}

type ExtensionMessage =
  | { type: "bushel-sms-ready" }
  | { type: "bushel-sms-ok" }
  | { type: "bushel-sms-error"; reason: string };

type ExtensionReply = Exclude<ExtensionMessage, { type: "bushel-sms-ready" }>;

function postToExtension(
  tab: Window,
  phone: string,
  body: string,
): Promise<ExtensionReply | null> {
  return new Promise((resolve) => {
    let settled = false;
    const handler = (event: MessageEvent) => {
      if (event.origin !== MESSAGES_WEB_ORIGIN) return;
      const data = event.data as ExtensionMessage | undefined;
      if (!data) return;
      if (data.type === "bushel-sms-ready") {
        // Content script just announced it's bound on the MWS tab. Send the
        // request now — this is the reliable trigger; the eager send below
        // is just belt-and-suspenders for the (unlikely) case where the
        // script loaded before our listener attached.
        send();
        return;
      }
      if (data.type !== "bushel-sms-ok" && data.type !== "bushel-sms-error") return;
      settle(data);
    };
    const timeout = window.setTimeout(() => settle(null), EXTENSION_REPLY_TIMEOUT_MS);
    function settle(reply: ExtensionReply | null) {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", handler);
      window.clearTimeout(timeout);
      resolve(reply);
    }
    window.addEventListener("message", handler);
    const send = () => {
      if (settled) return;
      try {
        tab.postMessage({ type: "bushel-sms", phone, body }, MESSAGES_WEB_ORIGIN);
      } catch {
        // Tab closed or cross-origin guard tripped — let the timeout resolve.
      }
    };
    // Eager send for the race where the content script bound before we did.
    // The primary trigger is the bushel-sms-ready handshake above.
    send();
  });
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
  const [filled, setFilled] = useState(false);

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
      // Desktop path: intercept the sms: nav, open Messages for Web in a new
      // tab, attempt extension auto-fill, fall back to clipboard. Clipboard
      // write happens either way as a safety net — if the extension fills the
      // compose box but Annabel wants to edit and the page reloads, the body
      // is still in clipboard.
      e.preventDefault();
      // Open the tab synchronously inside the click handler; Safari and
      // some Chromium variants pop-up-block window.open if it runs after
      // an await. We DON'T pass `noopener` or `noreferrer`: `noopener` nulls
      // the returned window reference (kills postMessage to the extension),
      // and `noreferrer` *implies* `noopener` per spec — passing either
      // silently breaks the extension path. The explicit origin allowlist
      // on the content-script side is the equivalent guard against hostile
      // pages, and Referer-to-messages.google.com isn't sensitive.
      const tab = window.open(MESSAGES_WEB_URL, "_blank");

      let clipboardOk = true;
      try {
        await navigator.clipboard.writeText(body);
      } catch {
        clipboardOk = false;
      }

      // Record the send now — the tab is open, the operator is on the path
      // to sending. Waiting for the extension reply (up to 4s) to record
      // would push the Sent pill flip past click in the no-extension case.
      recordOptimistic();

      if (clipboardOk) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2400);
      }

      if (!tab) {
        if (!clipboardOk) {
          setError("Clipboard blocked. Copy the message manually, then click Send again.");
        }
        return;
      }

      const reply = await postToExtension(tab, phone, body);
      if (reply?.type === "bushel-sms-ok") {
        setCopied(false);
        setFilled(true);
        setTimeout(() => setFilled(false), 2400);
      } else if (!clipboardOk) {
        setError("Clipboard blocked. Copy the message manually, then click Send again.");
      }
      return;
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
        {filled && (
          <span className="send-row-copied" role="status">
            Filled in Messages — review and Send
          </span>
        )}
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
