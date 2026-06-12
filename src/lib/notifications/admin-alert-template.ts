// Pure-function composer for the operator-side order-arrival alert
// (Phase 4.3, DEC-033 — Telegram bot). Plain text only: Telegram renders
// URLs as tappable links automatically, no Markdown/HTML needed.

export type AdminOrderAlertInput = {
  customerName: string;
  weekOf: string;
  itemCount: number;
  totalCents: number;
  adminOrdersUrl: string;
  // DEC-039: true when the submission appended items to the week's existing
  // order rather than creating it. Switches the headline so Annabel can tell
  // a brand-new order from a top-up. itemCount/totalCents then describe the
  // ADDED items only, not the merged order.
  appended?: boolean;
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
  appended = false,
}: AdminOrderAlertInput): string {
  const total = formatDollars(totalCents);
  const itemsLabel = itemCount === 1 ? "1 item" : `${itemCount} items`;
  const headline = appended
    ? `Order updated — ${customerName} added ${itemsLabel}, ${total}`
    : `New order — ${customerName}, ${total}`;
  return [
    headline,
    "",
    `Customer: ${customerName}`,
    `Week of: ${weekOf}`,
    `${appended ? "Added" : "Items"}: ${itemsLabel}`,
    `${appended ? "Added total" : "Total"}: ${total}`,
    "",
    adminOrdersUrl,
  ].join("\n");
}
