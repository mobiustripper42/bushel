import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export const CUSTOMER_TOKEN_COOKIE = "bbf_customer_token";

// 1 year. Token rotation (admin Regenerate) invalidates server-side on next lookup.
export const CUSTOMER_TOKEN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Customer = Database["public"]["Tables"]["customers"]["Row"];

export async function lookupCustomerByToken(
  token: string | undefined,
): Promise<Customer | null> {
  if (!token) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}
