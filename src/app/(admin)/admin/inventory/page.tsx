import { createClient } from "@/lib/supabase/server";
import { InventoryEditor, type ScheduleSummary, type CustomerStats } from "@/components/admin/inventory-editor";
import type { InventoryRowState } from "@/components/admin/inventory-row";
import type { ProductUnitState } from "@/components/admin/units-drawer";
import { weekOfLabel, weekOfMondayNY } from "@/lib/week";

export default async function InventoryPage() {
  const supabase = await createClient();
  const weekOf = weekOfMondayNY();
  const [productsRes, unitsRes, scheduleRes, activeCustomersRes, weekOrdersRes] = await Promise.all([
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
      .eq("is_active", true),
    supabase
      .from("orders")
      .select("customer_id", { count: "exact", head: true })
      .eq("week_of", weekOf),
  ]);

  // Every query is load-bearing for the pills / table — failing silently on
  // schedule or counts would render a plausible-but-wrong "Closed · 0 active"
  // state. Short-circuit on any error so Annabel sees a loud failure instead.
  const firstError =
    productsRes.error ??
    unitsRes.error ??
    scheduleRes.error ??
    activeCustomersRes.error ??
    weekOrdersRes.error;
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
    active: activeCustomersRes.count ?? 0,
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

  const initialRows: InventoryRowState[] = (productsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    unit: p.unit,
    price_cents: p.price_cents,
    qty_available: p.qty_available,
    is_available: p.is_available,
    sort_order: p.sort_order,
  }));

  return (
    <main style={{ padding: "28px 32px 60px", maxWidth: 1200, width: "100%" }}>
      <InventoryEditor
        initialRows={initialRows}
        initialUnits={unitsByProductId}
        weekLabel={weekOfLabel()}
        schedule={schedule}
        customerStats={customerStats}
      />
    </main>
  );
}
