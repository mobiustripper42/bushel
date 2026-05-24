// Customer-side reads use the service-role admin client intentionally. The
// token in the bbf_customer_token cookie is the authentication boundary;
// once it resolves to a customer row, the rest of the customer-facing
// queries bypass RLS by design. Don't "fix" these to the anon client —
// the customer-side RLS policies key off `current_setting('app.customer_id')`
// which we don't set, so anon reads return empty.
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export type ProductUnitRow = Database["public"]["Tables"]["product_units"]["Row"];
export type ProductRow = Database["public"]["Tables"]["products"]["Row"] & {
  // Active units only, sorted by (sort_order nulls last, created_at). The base
  // unit (conversion_to_base = 1) is the implicit default for the customer
  // picker. 6.5a guarantees every product has at least one active unit.
  units: ProductUnitRow[];
};

export async function getAvailableProducts(): Promise<ProductRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_units(*)")
    .eq("is_available", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`getAvailableProducts: ${error.message}`);
  if (!data) return [];
  return data.map((row) => {
    const allUnits = (row.product_units ?? []) as ProductUnitRow[];
    const units = allUnits
      .filter((u) => u.is_active)
      .sort((a, b) => {
        const ao = a.sort_order;
        const bo = b.sort_order;
        if (ao === null && bo === null) return a.created_at.localeCompare(b.created_at);
        if (ao === null) return 1;
        if (bo === null) return -1;
        return ao - bo;
      });
    // Strip the raw join field so the returned row matches ProductRow exactly.
    const { product_units: _product_units, ...rest } = row as typeof row & {
      product_units: ProductUnitRow[];
    };
    void _product_units;
    return { ...rest, units };
  });
}

// Reads the ordering_schedule singleton. Customer page uses this to decide
// between the open form, the manual-closed shell, and the all-sold-out shell
// (DEC-031). DEC-030 guarantees a single row exists — .single() lets a
// missing row surface as a real error rather than silently defaulting.
export async function getOrderingScheduleStatus(): Promise<{ is_open: boolean }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ordering_schedule")
    .select("is_open")
    .single();
  if (error) throw new Error(`getOrderingScheduleStatus: ${error.message}`);
  return { is_open: data.is_open };
}

export async function getLatestDeliveryPreference(
  customerId: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("delivery_preference")
    .eq("customer_id", customerId)
    .eq("fulfillment_type", "delivery")
    .not("delivery_preference", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestDeliveryPreference: ${error.message}`);
  return data?.delivery_preference ?? null;
}

// Pulls the customer's order for a specific week (typically the current NY-time
// week), joined with its line items + product names/units. Returns null if no
// order exists for that week. Used by /confirmed.
export async function getCurrentWeekOrder(customerId: string, weekOf: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      week_of,
      fulfillment_type,
      delivery_address,
      delivery_preference,
      pickup_note,
      notes,
      created_at,
      order_items (
        id,
        qty,
        unit_price_cents,
        products ( name, unit ),
        product_units ( label )
      )
    `,
    )
    .eq("customer_id", customerId)
    .eq("week_of", weekOf)
    .maybeSingle();
  if (error) throw new Error(`getCurrentWeekOrder: ${error.message}`);
  return data ?? null;
}
