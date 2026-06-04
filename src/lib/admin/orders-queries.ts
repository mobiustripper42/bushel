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
  // Legacy single-unit base label from products.unit. Kept for callers that
  // need the product-level unit (export, etc.); display surfaces should use
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

  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, customer_id, created_at, week_of, fulfillment_type,
       delivery_address, delivery_preference, pickup_note, notes,
       status, needs_reconciliation,
       customers(id, name),
       order_items(product_id, qty, unit_price_cents,
         products(name, description, unit, qty_available),
         product_units(label, conversion_to_base))`,
    )
    .eq("week_of", weekOf)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listOrders: ${error.message}`);

  return (data ?? [])
    .filter((o) => o.customers !== null)
    .map((o) => {
      const c = o.customers as { id: string; name: string };
      const items: OrderItem[] = ((o.order_items ?? []) as Array<{
        product_id: string;
        qty: number;
        unit_price_cents: number;
        products: {
          name: string;
          description: string | null;
          unit: string;
          qty_available: number;
        } | null;
        product_units: {
          label: string;
          conversion_to_base: number;
        } | null;
      }>)
        .filter((i) => i.products !== null)
        .map((i) => ({
          productId: i.product_id,
          name: i.products!.name,
          description: i.products!.description,
          unit: i.products!.unit,
          // 6.5f: per-line unit label from product_units. The legacy
          // safety-net is the products.unit string — only kicks in if the
          // join misses, which 6.5a's invariant (every product has ≥1 unit
          // row) prevents in practice.
          unitLabel: i.product_units?.label ?? i.products!.unit,
          conversionToBase: Number(i.product_units?.conversion_to_base ?? 1),
          qty: i.qty,
          unitPriceCents: i.unit_price_cents,
          qtyAvailable: i.products!.qty_available,
        }));
      const totalCents = items.reduce(
        (s, i) => s + i.qty * i.unitPriceCents,
        0,
      );
      return {
        id: o.id,
        customerId: c.id,
        customerName: c.name,
        placedAt: o.created_at,
        weekOf: o.week_of,
        fulfillmentType: narrowFulfillment(o.fulfillment_type),
        deliveryAddress: o.delivery_address,
        deliveryPreference: o.delivery_preference,
        pickupNote: o.pickup_note,
        notes: o.notes,
        status: narrowStatus(o.status),
        needsReconciliation: o.needs_reconciliation,
        items,
        totalCents,
      };
    });
}
