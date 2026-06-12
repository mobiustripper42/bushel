import { createClient } from "@/lib/supabase/server";
import { InventoryEditor, type ScheduleSummary, type CustomerStats } from "@/components/admin/inventory-editor";
import type { InventoryRowState } from "@/components/admin/inventory-row";
import type { ProductUnitState } from "@/components/admin/units-drawer";
import { weekOfLabel, weekOfMondayNY } from "@/lib/week";

export default async function InventoryPage() {
  const supabase = await createClient();
  const weekOf = weekOfMondayNY();
  const [productsRes, unitsRes, scheduleRes, subscribedCustomersRes, weekOrdersRes, weekItemsRes] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name"),
    supabase
      .from("product_units")
      .select("id, product_id, label, conversion_to_base, unit_price_cents, is_active, sort_order")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("id"),
    supabase
      .from("ordering_schedule")
      .select("is_open, weekly_open_day, weekly_open_time, weekly_close_day, weekly_close_time")
      .eq("is_singleton", true)
      .single(),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("send_weekly_link", true),
    supabase
      .from("orders")
      .select("customer_id", { count: "exact", head: true })
      .eq("week_of", weekOf),
    // Sold-this-week per product (base units). Aggregated client-side rather
    // than via PostgREST RPC because the multi-unit join (qty * conversion)
    // pushes us past what `.select(..., count: "exact")` can express. Volume
    // is small — single-digit customers × handful of items per order.
    // No `orders.status` filter today — there's no cancellation flow in V1.
    // If one lands (DEC-012 reconciliation could grow one), add the filter
    // here so cancelled items don't count as sold.
    supabase
      .from("order_items")
      .select("product_id, qty, product_units(conversion_to_base), orders!inner(week_of)")
      .eq("orders.week_of", weekOf),
  ]);

  // Every query is load-bearing for the pills / table — failing silently on
  // schedule or counts would render a plausible-but-wrong "Closed · 0 active"
  // state. Short-circuit on any error so Annabel sees a loud failure instead.
  const firstError =
    productsRes.error ??
    unitsRes.error ??
    scheduleRes.error ??
    subscribedCustomersRes.error ??
    weekOrdersRes.error ??
    weekItemsRes.error;
  if (firstError || !scheduleRes.data) {
    return (
      <main style={{ padding: "28px 32px", maxWidth: 1200 }}>
        <h1 className="page-title">Inventory</h1>
        <p style={{ color: "var(--rose-600)", marginTop: 16 }}>
          {firstError?.message ?? "ordering_schedule singleton row missing"}
        </p>
      </main>
    );
  }

  const scheduleRow = scheduleRes.data;
  const schedule: ScheduleSummary = {
    isOpen: scheduleRow.is_open,
    openDay: scheduleRow.weekly_open_day,
    openTime: scheduleRow.weekly_open_time,
    closeDay: scheduleRow.weekly_close_day,
    closeTime: scheduleRow.weekly_close_time,
  };

  const customerStats: CustomerStats = {
    subscribed: subscribedCustomersRes.count ?? 0,
    orderedThisWeek: weekOrdersRes.count ?? 0,
  };

  const unitsByProductId: Record<string, ProductUnitState[]> = {};
  for (const u of unitsRes.data ?? []) {
    (unitsByProductId[u.product_id] ??= []).push({
      id: u.id,
      label: u.label,
      conversion_to_base: Number(u.conversion_to_base),
      unit_price_cents: u.unit_price_cents,
      is_active: u.is_active,
      sort_order: u.sort_order,
    });
  }

  // Sold this week per product, in base units (qty * conversion_to_base).
  // Falls back to conv=1 when product_units join is absent — pre-6.5a data
  // had no unit row attached; the 6.5a safety-net trigger now fills it on
  // insert, but historical rows remain.
  const soldByProductId: Record<string, number> = {};
  for (const row of (weekItemsRes.data ?? []) as Array<{
    product_id: string;
    qty: number;
    product_units: { conversion_to_base: number } | null;
  }>) {
    const conv = Number(row.product_units?.conversion_to_base ?? 1);
    soldByProductId[row.product_id] = (soldByProductId[row.product_id] ?? 0) + row.qty * conv;
  }

  // DEC-037: products no longer carry unit/price columns — the inline editor's
  // Unit/Price cells are the base product_units row (conversion_to_base = 1.0),
  // picked from the units already loaded above. A missing base row violates the
  // saveInventory invariant; fall back to empty/0 so the broken row is loudly
  // uneditable (save rejects blank unit / zero price) instead of silently wrong.
  const initialRows: InventoryRowState[] = (productsRes.data ?? []).map((p) => {
    const base = (unitsByProductId[p.id] ?? []).find(
      (u) => u.conversion_to_base === 1,
    );
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      unit: base?.label ?? "",
      price_cents: base?.unit_price_cents ?? 0,
      qty_available: p.qty_available,
      is_available: p.is_available,
      is_active: p.is_active,
      sort_order: p.sort_order,
    };
  });

  return (
    <main style={{ padding: "28px 32px 60px", maxWidth: 1200, width: "100%" }}>
      <InventoryEditor
        initialRows={initialRows}
        initialUnits={unitsByProductId}
        soldByProductId={soldByProductId}
        weekLabel={weekOfLabel()}
        schedule={schedule}
        customerStats={customerStats}
      />
    </main>
  );
}
