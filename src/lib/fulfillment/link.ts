// Public harvest-sheet link token (#195). The token lives in the
// fulfillment_link singleton; the service layer resolves it (DEC-048) — the
// same pattern as customer token lookup.
import { query, queryOne } from "@/lib/db";

// The current public report token. Used server-side to build the link Annabel
// opens / copies from /admin/orders.
export async function getFulfillmentToken(): Promise<string> {
  const row = await queryOne<{ token: string }>(
    "getFulfillmentToken",
    `select token from fulfillment_link`,
  );
  return row.token;
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
  const rows = await query<{ token: string }>(
    `select token from fulfillment_link where token = $1`,
    [token],
  );
  return rows.length > 0;
}
