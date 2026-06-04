// Public harvest-sheet link token (#195). The token lives in the admin-only
// fulfillment_link singleton; both reads here go through the service-role
// client, which bypasses RLS — the same pattern as customer token lookup.
import { createAdminClient } from "@/lib/supabase/admin";

// The current public report token. Used server-side to build the link Annabel
// opens / copies from /admin/orders.
export async function getFulfillmentToken(): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("fulfillment_link")
    .select("token")
    .single();
  if (error) throw new Error(`getFulfillmentToken: ${error.message}`);
  return data.token;
}

// True when the supplied token matches the current link. Drives the 404 on
// the public /f/[token] route.
export async function isValidFulfillmentToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("fulfillment_link")
    .select("token")
    .eq("token", token)
    .maybeSingle();
  return data !== null;
}
