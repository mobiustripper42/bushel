import { createClient } from "@/lib/supabase/server";
import { InventoryEditor } from "@/components/admin/inventory-editor";
import type { InventoryRowState } from "@/components/admin/inventory-row";
import { weekOfLabel } from "@/lib/week";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name");

  if (error) {
    return (
      <main style={{ padding: "28px 32px", maxWidth: 1200 }}>
        <h1 className="page-title">Inventory</h1>
        <p style={{ color: "var(--rose-600)", marginTop: 16 }}>{error.message}</p>
      </main>
    );
  }

  const initialRows: InventoryRowState[] = (products ?? []).map((p) => ({
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
      <InventoryEditor initialRows={initialRows} weekLabel={weekOfLabel()} />
    </main>
  );
}
