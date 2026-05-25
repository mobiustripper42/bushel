// Pure-function composer for the operator-side order-arrival alert
// (Phase 4.3, DEC-033 — Telegram bot). Plain text only: Telegram renders
// URLs as tappable links automatically, no Markdown/HTML needed.

export type AdminOrderAlertInput = {
  customerName: string;
  weekOf: string;
  itemCount: number;
  totalCents: number;
  adminOrdersUrl: string;
};

function formatDollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const c = abs % 100;
  const dollarsStr = dollars.toLocaleString("en-US");
  return `${sign}$${dollarsStr}.${c.toString().padStart(2, "0")}`;
}

export function adminOrderAlertText({
  customerName,
  weekOf,
  itemCount,
  totalCents,
  adminOrdersUrl,
}: AdminOrderAlertInput): string {
  const total = formatDollars(totalCents);
  const itemsLabel = itemCount === 1 ? "1 item" : `${itemCount} items`;
  return [
    `New order — ${customerName}, ${total}`,
    "",
    `Customer: ${customerName}`,
    `Week of: ${weekOf}`,
    `Items: ${itemsLabel}`,
    `Total: ${total}`,
    "",
    adminOrdersUrl,
  ].join("\n");
}
