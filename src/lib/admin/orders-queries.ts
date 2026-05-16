// Admin order-list reads (Phase 5.1). Service-role client — admin only.
import { createAdminClient } from "@/lib/supabase/admin";
import { weekOfMondayNY } from "@/lib/week";

export type OrderStatus = "new" | "ready" | "picked-up" | "delivered";

export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "ready",
  "picked-up",
  "delivered",
];

export type OrderItem = {
  productId: string;
  name: string;
  unit: string;
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

// Shifts a YYYY-MM-DD Monday by N weeks. Used by week-filter chips.
export function shiftWeek(weekOf: string, weeks: number): string {
  const [y, m, d] = weekOf.split("-").map((n) => parseInt(n, 10));
  const anchor = new Date(Date.UTC(y, m - 1, d));
  anchor.setUTCDate(anchor.getUTCDate() + weeks * 7);
  return anchor.toISOString().slice(0, 10);
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
         products(name, unit, qty_available))`,
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
        products: { name: string; unit: string; qty_available: number } | null;
      }>)
        .filter((i) => i.products !== null)
        .map((i) => ({
          productId: i.product_id,
          name: i.products!.name,
          unit: i.products!.unit,
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
