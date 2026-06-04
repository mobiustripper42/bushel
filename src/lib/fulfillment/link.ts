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

// The token is a UUID. Shape-check before any DB call so scanner traffic
// (/f/.env, /f/wp-admin) is rejected for free — parity with the /c/[token]
// middleware guard in proxy.ts.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// True when the supplied token matches the current link. Drives the 404 on
// the public /f/[token] route. Throws on a real DB error rather than reporting
// the link invalid — a transient failure shouldn't read as "link expired" and
// send Annabel off to regenerate a link that was never broken.
export async function isValidFulfillmentToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token || !UUID_RE.test(token)) return false;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("fulfillment_link")
    .select("token")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(`isValidFulfillmentToken: ${error.message}`);
  return data !== null;
}
