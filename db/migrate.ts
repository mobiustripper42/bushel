/**
 * Migration runner (DEC-046, ported from muster). Applies db/migrations/*.sql
 * in filename order, each in a transaction, tracked in a `_migrations` table
 * so re-runs are no-ops. Plain Postgres — no migration framework, so the DDL
 * stays portable to any host.
 *
 * Used two ways: the `db:migrate` CLI (against DATABASE_URL or an explicit
 * connection-string arg — prod migrations are ALWAYS the explicit-arg form,
 * DEC-049) and test setup (which calls `migrate(TEST_DATABASE_URL)`).
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

/** Default local-dev connection (the compose service). Overridden by env/arg. */
export const DEFAULT_DATABASE_URL =
  "postgres://bushel:bushel@localhost:5433/bushel_dev";

/** Apply all pending migrations to `connectionString`. Returns the files applied. */
export async function migrate(
  connectionString: string = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
): Promise<string[]> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query(
      `create table if not exists _migrations (
         filename text primary key,
         applied_at timestamptz not null default now()
       )`,
    );
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const done = new Set(
      (
        await client.query<{ filename: string }>(
          "select filename from _migrations",
        )
      ).rows.map((r) => r.filename),
    );
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into _migrations(filename) values ($1)", [
          file,
        ]);
        await client.query("commit");
        applied.push(file);
      } catch (e) {
        await client.query("rollback");
        throw e;
      }
    }
  } finally {
    await client.end();
  }
  return applied;
}

// CLI entry: `tsx db/migrate.ts [connectionString]`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.argv[2] ?? process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  migrate(url)
    .then((a) =>
      console.log(a.length ? `Applied: ${a.join(", ")}` : "Up to date."),
    )
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
