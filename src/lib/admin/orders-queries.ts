// Admin order-list reads (Phase 5.1). Service-role client — admin only.
import { createAdminClient } from "@/lib/supabase/admin";
import { weekOfMondayNY } from "@/lib/week";

// DEC-035 (amends DEC-010): new → [confirmed] → ready → (picked-up | delivered).
// Confirmed is optional. Ordering matches codes.sort_order.
export type OrderStatus =
  | "new"
  | "confirmed"
  | "ready"
  | "picked-up"
  | "delivered";

export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "ready",
  "picked-up",
  "delivered",
];

// The no-regress auto-advance rule for confirm-sends (DEC-035): sending the
// confirmation text moves a new order to confirmed, but must never regress a
// ready/terminal order. Wired to the confirm-send action in the Orders-page
// action stack (#192); lives here as a pure, testable helper.
export function statusAfterConfirmSend(current: OrderStatus): OrderStatus {
  return current === "new" ? "confirmed" : current;
}

// DEC-035 (amends DEC-010): new → [confirmed] → ready → (picked-up | delivered).
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
  if (from === "ready" && to === "picked-up") return fulfillmentType === "pickup";
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
  const supabase = createAdminClient();

  // Orders + the week's customer_sends (for per-order Send state, #192) in
  // parallel. customer_sends is keyed (customer_id, week_of, mode); since
  // there's one order per customer per week, customer_id maps 1:1 to an order.
  const [{ data, error }, sendsResult] = await Promise.all([
    supabase
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
      .eq("week_of", weekOf)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_sends")
      .select("customer_id, mode, sent_at")
      .eq("week_of", weekOf),
  ]);

  if (error) throw new Error(`listOrders: ${error.message}`);
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
  const sentByCustomer = new Map<string, SentEntry>();
  for (const s of sendsResult.data ?? []) {
    const entry = sentByCustomer.get(s.customer_id) ?? {
      confirm: null,
      pickupReminder: null,
      deliveryReminder: null,
    };
    if (s.mode === "order_confirmation") entry.confirm = s.sent_at;
    else if (s.mode === "pickup_reminder") entry.pickupReminder = s.sent_at;
    else if (s.mode === "delivery_reminder") entry.deliveryReminder = s.sent_at;
    sentByCustomer.set(s.customer_id, entry);
  }

  return (data ?? [])
    .filter((o) => o.customers !== null)
    .map((o) => {
      const c = o.customers as { id: string; name: string; phone: string | null };
      const sent = sentByCustomer.get(c.id) ?? {
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
