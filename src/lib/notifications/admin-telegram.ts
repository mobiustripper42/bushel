// Operator-side order-arrival alert via Telegram Bot API (Phase 4.3,
// DEC-033 — supersedes DEC-027's email-first decision). Single recipient
// (Annabel's Telegram chat_id). Best-effort: any failure is logged and
// swallowed so order placement never blocks on a notification miss.

import { adminOrderAlertText, type AdminOrderAlertInput } from "./admin-alert-template";

const TELEGRAM_API = "https://api.telegram.org";

function isEnabled(): boolean {
  if (process.env.NOTIFICATIONS_ENABLED === "false") return false;
  if (!process.env.TELEGRAM_BOT_TOKEN) return false;
  if (!process.env.TELEGRAM_ADMIN_CHAT_ID) return false;
  return true;
}

export async function sendAdminOrderAlert(input: AdminOrderAlertInput): Promise<void> {
  if (!isEnabled()) {
    // console.debug so dev/preview/test envs (where env vars are unset)
    // don't spam Vercel logs on every order. Real misconfiguration on a
    // configured env surfaces via the .ok check below.
    console.debug(
      `[admin-alert] skipped (not configured) — ${input.customerName}, ${input.itemCount} items`,
    );
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID!;
  const text = adminOrderAlertText(input);

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "(no body)");
      console.error(`[admin-alert] telegram ${res.status}: ${detail}`);
    }
  } catch (err) {
    console.error(`[admin-alert] telegram fetch failed: ${(err as Error).message}`);
  }
}
