/**
 * Shared harness for pg-integration tests (DEC-051). These exercise the plpgsql
 * functions + constraints + triggers through the app's own pg driver (src/lib/db),
 * against docker Postgres — the non-pgTAP replacement for the retired
 * `supabase test db` suite.
 *
 * Skips cleanly when no test DB is reachable, so `npm run test:unit` still runs
 * the pure unit tests docker-free; the integration tests light up once
 * `docker compose up -d` is running and DATABASE_URL points at bushel_test.
 * (Importing @/lib/db is safe when the DB is down — the pool connects lazily on
 * first query, which a skipped suite never issues.)
 */
import pg from "pg";
import { migrate } from "../migrate";
import { query, pool } from "@/lib/db";

const TEST_URL =
  process.env.DATABASE_URL ?? "postgres://bushel:bushel@localhost:5433/bushel_test";

/** Short-timeout probe so a down DB skips fast instead of hanging the suite. */
export async function canConnect(): Promise<boolean> {
  const client = new pg.Client({
    connectionString: TEST_URL,
    connectionTimeoutMillis: 2000,
  });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

/** Apply all migrations to the test DB once (idempotent). */
export async function migrateTestDb(): Promise<void> {
  await migrate(TEST_URL);
}

// Mutable data tables, truncated between tests so each seeds its own fixtures
// (the isolation pgTAP got from begin/rollback). Parents with `cascade` cover
// their children; `codes` / `ordering_schedule` / `fulfillment_link` / `admins`
// are migration seed + singletons and are left intact.
const RESET_TABLES = [
  "order_items",
  "orders",
  "customer_sends",
  "product_units",
  "products",
  "customers",
  "login_codes",
  "push_tokens",
];

export async function resetData(): Promise<void> {
  await query(`truncate ${RESET_TABLES.join(", ")} restart identity cascade`);
}

/** Close the shared app pool — call in afterAll so vitest exits cleanly. */
export async function closePool(): Promise<void> {
  await pool.end();
}
