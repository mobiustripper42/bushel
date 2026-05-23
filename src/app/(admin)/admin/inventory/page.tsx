import { createClient } from "@/lib/supabase/server";
import { InventoryEditor } from "@/components/admin/inventory-editor";
import type { InventoryRowState } from "@/components/admin/inventory-row";
import type { ProductUnitState } from "@/components/admin/units-drawer";
import { weekOfLabel } from "@/lib/week";

export default async function InventoryPage() {
  const supabase = await createClient();
  const [productsRes, unitsRes] = await Promise.all([
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
  ]);

  if (productsRes.error || unitsRes.error) {
    return (
      <main style={{ padding: "28px 32px", maxWidth: 1200 }}>
        <h1 className="page-title">Inventory</h1>
        <p style={{ color: "var(--rose-600)", marginTop: 16 }}>
          {productsRes.error?.message ?? unitsRes.error?.message}
        </p>
      </main>
    );
  }

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
      />
    </main>
  );
}
