// Pure order-status domain: types, status sets, and transition rules. No DB
// import — safe for client components (the pg-backed queries live in
// orders-queries.ts, which re-exports everything here for server callers).

// DEC-035 (amends DEC-010): new → [confirmed] → ready → (picked_up | delivered).
// Confirmed is optional. Ordering matches codes.sort_order.
// DEC-044: snake_case picked_up is canonical — matches the codes table row.
export type OrderStatus =
  | "new"
  | "confirmed"
  | "ready"
  | "picked_up"
  | "delivered";

export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "ready",
  "picked_up",
  "delivered",
];

// DEC-041: the open-order identity set. A customer has at most one order in
// these statuses (partial unique index orders_one_open_per_customer); a
// terminal order drops out and frees a new one. Keep this list identical to
// the index predicate in the DEC-041 migration.
export const OPEN_ORDER_STATUSES: OrderStatus[] = ["new", "confirmed", "ready"];

// The complement — every status is in exactly one of these two sets, so an
// order can never fall out of both admin views (DEC-045). isTerminalStatus
// and the Fulfilled-view filter both derive from this single list.
export const TERMINAL_ORDER_STATUSES: OrderStatus[] = ["picked_up", "delivered"];

// The no-regress auto-advance rule for confirm-sends (DEC-035): sending the
// confirmation text moves a new order to confirmed, but must never regress a
// ready/terminal order. Wired to the confirm-send action in the Orders-page
// action stack (#192); lives here as a pure, testable helper.
export function statusAfterConfirmSend(current: OrderStatus): OrderStatus {
  return current === "new" ? "confirmed" : current;
}

// DEC-041: terminal = the box has been handed over. A terminal order drops
// out of the open-order identity — /confirmed renders it read-only and the
// next submission creates a fresh order. Takes raw text because orders.status
// is app-enforced text in the DB (DEC-010) — customer-side reads arrive untyped.
export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_ORDER_STATUSES as string[]).includes(status);
}

// DEC-035 (amends DEC-010): new → [confirmed] → ready → (picked_up | delivered).
// Confirmed is optional — new → ready stays valid (Annabel may pack before
// texting). Fulfillment type pins which terminal state is valid. Pure +
// exported so advance-order-status.ts (a "use server" module, which can only
// export async actions) can import it and tests can exercise the table.
export function isValidTransition(
  from: OrderStatus,
  to: OrderStatus,
  fulfillmentType: "pickup" | "delivery",
): boolean {
  if (from === "new" && to === "confirmed") return true;
  if (from === "new" && to === "ready") return true;
  if (from === "confirmed" && to === "ready") return true;
  if (from === "ready" && to === "picked_up") return fulfillmentType === "pickup";
  if (from === "ready" && to === "delivered") return fulfillmentType === "delivery";
  return false;
}

export type OrderItem = {
  productId: string;
  name: string;
  // DEC-043: Wave "Item Number" inputs for this line's unit. sku is
  // Annabel-edited (matches her Wave catalog); slug is the generated
  // fallback. The export resolves sku → slug → blank. products.description
  // left this shape entirely — it's the customer-facing long description,
  // nothing more.
  sku: string | null;
  slug: string | null;
  // Product-level base unit label (the product_units row with
  // conversion_to_base = 1.0, per DEC-037). Used where a per-product unit is
  // needed (fulfillment report "total N <base>"); display surfaces should use
  // unitLabel for per-line accuracy under multi-unit.
  unit: string;
  // 6.5f: per-line unit label resolved from product_units.label via
  // order_items.product_unit_id. For single-unit products this matches `unit`;
  // for multi-unit lines this is the unit the customer actually selected.
  unitLabel: string;
  // 6.5f: conversion factor for the line's unit. Used for unit-aware oversold
  // math (qty * conversionToBase vs base qty_available).
  conversionToBase: number;
  qty: number;
  unitPriceCents: number;
  qtyAvailable: number;
};

export type OrderRow = {
  id: string;
  customerId: string;
  customerName: string;
  // Drives the per-order Send actions (#192). Null → "No phone" disabled state.
  phone: string | null;
  placedAt: string;
  weekOf: string;
  fulfillmentType: "pickup" | "delivery";
  deliveryAddress: string | null;
  deliveryPreference: string | null;
  pickupNote: string | null;
  notes: string | null;
  status: OrderStatus;
  needsReconciliation: boolean;
  items: OrderItem[];
  totalCents: number;
  // Per-mode sent timestamps for this customer's current-week sends (#192).
  // Null = not yet sent. Drives the Send/Re-send state in the action stack.
  confirmSentAt: string | null;
  reminderSentAt: string | null;
};
