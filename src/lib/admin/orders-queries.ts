// Admin order-list reads (Phase 5.1). Service-role client — admin only.
import { createAdminClient } from "@/lib/supabase/admin";
import { weekOfMondayNY } from "@/lib/week";

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
// terminal order (picked_up/delivered) drops out and frees a new one. Keep
// this list identical to the index predicate in the DEC-041 migration.
export const OPEN_ORDER_STATUSES: OrderStatus[] = ["new", "confirmed", "ready"];

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
  return status === "picked_up" || status === "delivered";
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
  // products.description doubles as the Wave-export "Item Number" slug per the
  // 5.2 mapping (e.g. "KALE-BUNCH"). Null when unset — Wave just gets a blank
  // Item Number cell, which Annabel fills before posting the invoice.
  description: string | null;
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

function narrowStatus(s: string): OrderStatus {
  return (ORDER_STATUSES as string[]).includes(s) ? (s as OrderStatus) : "new";
}

function narrowFulfillment(s: string): "pickup" | "delivery" {
  return s === "delivery" ? "delivery" : "pickup";
}

export function currentWeekOf(): string {
  return weekOfMondayNY();
}

// Lists orders for a given week, joined with customer + items + products.
// Sorted at the DB by created_at desc; reconciliation pinning is applied
// in the UI so it survives column-sort changes.
export async function listOrders(weekOf: string): Promise<OrderRow[]> {
  return queryOrders({ weekOf });
}

// DEC-041/DEC-042 (#227): every open (non-terminal) order regardless of week.
// The fulfillment sheet reads this — an order that stays open across a week
// boundary must keep printing until it's out the door. The admin orders list
// moves onto this in 9.8 (DEC-045).
export async function listActiveOrders(): Promise<OrderRow[]> {
  return queryOrders({ activeOnly: true });
}

async function queryOrders(filter: {
  weekOf?: string;
  activeOnly?: boolean;
}): Promise<OrderRow[]> {
  const supabase = createAdminClient();

  let ordersQuery = supabase
    .from("orders")
    .select(
      `id, customer_id, created_at, week_of, fulfillment_type,
       delivery_address, delivery_preference, pickup_note, notes,
       status, needs_reconciliation,
       customers(id, name, phone),
       order_items(product_id, qty, unit_price_cents,
         products(name, description, qty_available,
           product_units(label, conversion_to_base)),
         product_units(label, conversion_to_base))`,
    )
    .order("created_at", { ascending: false });
  if (filter.weekOf) ordersQuery = ordersQuery.eq("week_of", filter.weekOf);
  if (filter.activeOnly)
    ordersQuery = ordersQuery.in("status", OPEN_ORDER_STATUSES);

  const { data, error } = await ordersQuery;
  if (error) throw new Error(`listOrders: ${error.message}`);

  // customer_sends stays week-keyed (DEC-042), so the Send state for each
  // order is the send row of the order's OWN week_of stamp. Fetched after the
  // orders because the active view can span weeks — the sends lookup needs
  // the set of weeks actually present.
  const weeks = [...new Set((data ?? []).map((o) => o.week_of))];
  const sendsResult =
    weeks.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("customer_sends")
          .select("customer_id, week_of, mode, sent_at")
          .in("week_of", weeks);
  if (sendsResult.error)
    throw new Error(`listOrders(sends): ${sendsResult.error.message}`);

  // Reminder mode is per-fulfillment (#193): pickup orders use pickup_reminder,
  // delivery orders use delivery_reminder — tracked separately, resolved per
  // order below.
  type SentEntry = {
    confirm: string | null;
    pickupReminder: string | null;
    deliveryReminder: string | null;
  };
  // Keyed (customer_id, week_of): with the active view spanning weeks, one
  // customer can appear with sends in more than one week — the old per-
  // customer key silently merged them.
  const sentByCustomerWeek = new Map<string, SentEntry>();
  for (const s of sendsResult.data ?? []) {
    const key = `${s.customer_id}:${s.week_of}`;
    const entry = sentByCustomerWeek.get(key) ?? {
      confirm: null,
      pickupReminder: null,
      deliveryReminder: null,
    };
    if (s.mode === "order_confirmation") entry.confirm = s.sent_at;
    else if (s.mode === "pickup_reminder") entry.pickupReminder = s.sent_at;
    else if (s.mode === "delivery_reminder") entry.deliveryReminder = s.sent_at;
    sentByCustomerWeek.set(key, entry);
  }

  return (data ?? [])
    .filter((o) => o.customers !== null)
    .map((o) => {
      const c = o.customers as { id: string; name: string; phone: string | null };
      const sent = sentByCustomerWeek.get(`${c.id}:${o.week_of}`) ?? {
        confirm: null,
        pickupReminder: null,
        deliveryReminder: null,
      };
      const fulfillmentType = narrowFulfillment(o.fulfillment_type);
      const items: OrderItem[] = ((o.order_items ?? []) as Array<{
        product_id: string;
        qty: number;
        unit_price_cents: number;
        products: {
          name: string;
          description: string | null;
          qty_available: number;
          // The product's full unit set (reverse join). Only the base row
          // (conversion_to_base = 1.0) is read here, for OrderItem.unit.
          product_units: Array<{
            label: string;
            conversion_to_base: number;
          }>;
        } | null;
        product_units: {
          label: string;
          conversion_to_base: number;
        } | null;
      }>)
        .filter((i) => i.products !== null)
        .map((i) => {
          // DEC-037: the product-level unit is the base product_units row.
          const baseLabel = (i.products!.product_units ?? []).find(
            (u) => Number(u.conversion_to_base) === 1,
          )?.label;
          // Per-line unit label from the order line's product_units join
          // (6.5f). The base label is the fallback; both missing means the
          // unit row was deleted out from under the order — render blank
          // rather than invent a unit.
          const unitLabel = i.product_units?.label ?? baseLabel ?? "";
          return {
            productId: i.product_id,
            name: i.products!.name,
            description: i.products!.description,
            unit: baseLabel ?? unitLabel,
            unitLabel,
            conversionToBase: Number(i.product_units?.conversion_to_base ?? 1),
            qty: i.qty,
            unitPriceCents: i.unit_price_cents,
            qtyAvailable: i.products!.qty_available,
          };
        });
      const totalCents = items.reduce(
        (s, i) => s + i.qty * i.unitPriceCents,
        0,
      );
      return {
        id: o.id,
        customerId: c.id,
        customerName: c.name,
        phone: c.phone,
        placedAt: o.created_at,
        weekOf: o.week_of,
        fulfillmentType,
        deliveryAddress: o.delivery_address,
        deliveryPreference: o.delivery_preference,
        pickupNote: o.pickup_note,
        notes: o.notes,
        status: narrowStatus(o.status),
        needsReconciliation: o.needs_reconciliation,
        items,
        totalCents,
        confirmSentAt: sent.confirm,
        reminderSentAt:
          fulfillmentType === "pickup"
            ? sent.pickupReminder
            : sent.deliveryReminder,
      };
    });
}
