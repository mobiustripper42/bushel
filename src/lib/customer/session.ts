import { query } from "@/lib/db";
import type { CustomerRow } from "@/lib/db-types";

export const CUSTOMER_TOKEN_COOKIE = "bbf_customer_token";

// 1 year. Token rotation (admin Regenerate) invalidates server-side on next lookup.
export const CUSTOMER_TOKEN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Customer = CustomerRow;

// Returns the matching customer row regardless of is_active or
// send_weekly_link state. Callers branch on those flags themselves —
// e.g. the /c/[token] page (#130) renders a paused/closed shell instead
// of the order form; place-order.ts errors with a paused message. A
// previous version of this filtered on is_active=true server-side,
// which made deactivated customers indistinguishable from invalid
// tokens (both 404) — Annabel couldn't tell from the user's screenshot
// whether the link was bad or the account closed.
export async function lookupCustomerByToken(
  token: string | undefined,
): Promise<Customer | null> {
  if (!token) return null;
  const rows = await query<Customer>(
    `select * from customers where token = $1`,
    [token],
  );
  return rows[0] ?? null;
}
