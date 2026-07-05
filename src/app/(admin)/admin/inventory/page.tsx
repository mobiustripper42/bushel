import { query } from "@/lib/db";
import type { ProductRow } from "@/lib/db-types";
import { InventoryEditor, type ScheduleSummary, type CustomerStats } from "@/components/admin/inventory-editor";
import type { InventoryRowState } from "@/components/admin/inventory-row";
import type { ProductUnitState } from "@/components/admin/units-drawer";
import { weekOfLabel, weekOfMondayNY } from "@/lib/week";

type UnitRow = {
  id: string;
  product_id: string;
  label: string;
  conversion_to_base: number;
  unit_price_cents: number;
  is_active: boolean;
  sort_order: number | null;
  sku: string | null;
};

type ScheduleRow = {
  is_open: boolean;
  weekly_open_day: number | null;
  weekly_open_time: string | null;
  weekly_close_day: number | null;
  weekly_close_time: string | null;
};

export default async function InventoryPage() {
  const weekOf = weekOfMondayNY();

  // Every query is load-bearing for the pills / table — failing silently on
  // schedule or counts would render a plausible-but-wrong "Closed · 0 active"
  // state. The try/catch surfaces any failure loudly instead.
  let products: ProductRow[];
  let units: UnitRow[];
  let scheduleRows: ScheduleRow[];
  let subscribedCount: number;
  let weekOrdersCount: number;
  let weekItems: Array<{ product_id: string; qty: number; conversion_to_base: number | null }>;
  try {
    [products, units, scheduleRows, subscribedCount, weekOrdersCount, weekItems] =
      await Promise.all([
        query<ProductRow>(
          `select * from products order by sort_order asc nulls last, name asc`,
        ),
        query<UnitRow>(
          `select id, product_id, label, conversion_to_base, unit_price_cents,
                  is_active, sort_order, sku
             from product_units
            order by sort_order asc nulls last, id asc`,
        ),
        query<ScheduleRow>(
          `select is_open, weekly_open_day, weekly_open_time, weekly_close_day,
                  weekly_close_time
             from ordering_schedule
            where is_singleton = true`,
        ),
        query<{ count: number }>(
          `select count(*)::int as count from customers
            where is_active and send_weekly_link`,
        ).then((r) => r[0].count),
        query<{ count: number }>(
          `select count(*)::int as count from orders where week_of = $1`,
          [weekOf],
        ).then((r) => r[0].count),
        // Sold-this-week per product (base units), aggregated below. Falls
        // back to conv=1 when the unit row is absent — pre-6.5a data had no
        // unit attached; the safety-net trigger now fills it on insert, but
        // historical rows remain. No `orders.status` filter today — there's
        // no cancellation flow in V1. If one lands (DEC-012 reconciliation
        // could grow one), add the filter here so cancelled items don't
        // count as sold.
        query<{ product_id: string; qty: number; conversion_to_base: number | null }>(
          `select oi.product_id, oi.qty, pu.conversion_to_base
             from order_items oi
             join orders o on o.id = oi.order_id
             left join product_units pu on pu.id = oi.product_unit_id
            where o.week_of = $1`,
          [weekOf],
        ),
      ]);
    if (scheduleRows.length !== 1) {
      throw new Error("ordering_schedule singleton row missing");
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return (
      <main style={{ padding: "28px 32px", maxWidth: 1200 }}>
        <h1 className="page-title">Inventory</h1>
        <p style={{ color: "var(--rose-600)", marginTop: 16 }}>{message}</p>
      </main>
    );
  }

  const scheduleRow = scheduleRows[0];
  const schedule: ScheduleSummary = {
    isOpen: scheduleRow.is_open,
    openDay: scheduleRow.weekly_open_day,
    openTime: scheduleRow.weekly_open_time,
    closeDay: scheduleRow.weekly_close_day,
    closeTime: scheduleRow.weekly_close_time,
  };

  const customerStats: CustomerStats = {
    subscribed: subscribedCount,
    orderedThisWeek: weekOrdersCount,
  };

  const unitsByProductId: Record<string, ProductUnitState[]> = {};
  for (const u of units) {
    (unitsByProductId[u.product_id] ??= []).push({
      id: u.id,
      label: u.label,
      conversion_to_base: Number(u.conversion_to_base),
      unit_price_cents: u.unit_price_cents,
      is_active: u.is_active,
      sort_order: u.sort_order,
      sku: u.sku,
    });
  }

  // Sold this week per product, in base units (qty * conversion_to_base).
  const soldByProductId: Record<string, number> = {};
  for (const row of weekItems) {
    const conv = Number(row.conversion_to_base ?? 1);
    soldByProductId[row.product_id] = (soldByProductId[row.product_id] ?? 0) + row.qty * conv;
  }

  // DEC-037: products no longer carry unit/price columns — the inline editor's
  // Unit/Price cells are the base product_units row (conversion_to_base = 1.0),
  // picked from the units already loaded above. A missing base row violates the
  // saveInventory invariant; fall back to empty/0 so the broken row is loudly
  // uneditable (save rejects blank unit / zero price) instead of silently wrong.
  const initialRows: InventoryRowState[] = products.map((p) => {
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
