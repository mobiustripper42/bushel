// Admin-side reads used to populate the shell chrome (nav badges, footer
// status). Service-role client — these reads cross every tenant boundary
// the shell shows. Never expose any of these to the client.
import { createAdminClient } from "@/lib/supabase/admin";
import { weekOfMondayNY } from "@/lib/week";

export async function getInventoryCount(): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_available", true);
  if (error) throw new Error(`getInventoryCount: ${error.message}`);
  return count ?? 0;
}

export async function getNewOrdersCount(): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "new")
    .eq("week_of", weekOfMondayNY());
  if (error) throw new Error(`getNewOrdersCount: ${error.message}`);
  return count ?? 0;
}

// ordering_schedule is a singleton (DEC-030 seeds one row; an is_singleton
// unique-check constraint enforces it). .single() is intentional — if the
// row ever goes missing, the admin shell 500s loudly, which is the right
// signal vs silently defaulting to "open."
export async function getOrderingOpen(): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ordering_schedule")
    .select("is_open")
    .single();
  if (error) throw new Error(`getOrderingOpen: ${error.message}`);
  return data.is_open;
}
