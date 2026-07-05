// pg Pool (DEC-046). One pool per server process, connection string from
// DATABASE_URL: Neon pooled endpoint in hosted envs (per-scope in Vercel,
// DEC-049 — Preview entries must apply to ALL preview branches, or previews
// silently fall back to the localhost default below and 500 on every query;
// a malformed pasted value surfaces as ENOTFOUND on a nonsense hostname),
// the docker compose service locally/CI. Never a prod default — prod writes
// are explicit-arg only (db/migrate.ts).
import pg from "pg";

// Match the JSON shapes supabase-js returned so downstream code is unchanged:
// - numeric → number (qty_available / conversion_to_base arithmetic)
// - timestamptz → ISO string (created_at sorts lexicographically in the UI)
// - date → 'YYYY-MM-DD' string (week_of is used as a map key)
// Values nested inside json_agg/json_build_object come back through JSON and
// already have these shapes; the parsers cover top-level columns.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, parseFloat);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) =>
  new Date(v).toISOString(),
);
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

const globalForDb = globalThis as unknown as { pgPool?: pg.Pool };

// next dev hot-reloads modules; reuse the pool across reloads or local dev
// leaks connections until Neon's cap.
export const pool =
  globalForDb.pgPool ??
  new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgres://bushel:bushel@localhost:5433/bushel_dev",
    max: 5,
  });
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

// Thin helper for the common case — rows only.
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query<T>(text, params as never[]);
  return res.rows;
}

// Exactly-one-row reads (singletons, counts). Throws with the caller's label
// when the row is missing — same loud-failure discipline as .single() had.
export async function queryOne<T extends pg.QueryResultRow>(
  label: string,
  text: string,
  params?: unknown[],
): Promise<T> {
  const rows = await query<T>(text, params);
  if (rows.length !== 1) {
    throw new Error(`${label}: expected 1 row, got ${rows.length}`);
  }
  return rows[0];
}
