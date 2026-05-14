import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export async function getAvailableProducts(): Promise<ProductRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_available", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`getAvailableProducts: ${error.message}`);
  return data ?? [];
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
        products ( name, unit )
      )
    `,
    )
    .eq("customer_id", customerId)
    .eq("week_of", weekOf)
    .maybeSingle();
  if (error) throw new Error(`getCurrentWeekOrder: ${error.message}`);
  return data ?? null;
}
