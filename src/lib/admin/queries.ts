// Admin-side reads used to populate the shell chrome (nav badges, footer
// status). Full-privilege pg reads — these cross every boundary the shell
// shows. Server-only.
import { query, queryOne } from "@/lib/db";
import { weekOfMondayNY } from "@/lib/week";

export async function getInventoryCount(): Promise<number> {
  const rows = await query<{ count: number }>(
    `select count(*)::int as count from products
      where is_active and is_available`,
  );
  return rows[0].count;
}

export async function getNewOrdersCount(): Promise<number> {
  const rows = await query<{ count: number }>(
    `select count(*)::int as count from orders
      where status = 'new' and week_of = $1`,
    [weekOfMondayNY()],
  );
  return rows[0].count;
}

// ordering_schedule is a singleton (DEC-030 seeds one row; an is_singleton
// unique-check constraint enforces it). queryOne is intentional — if the
// row ever goes missing, the admin shell 500s loudly, which is the right
// signal vs silently defaulting to "open."
export async function getOrderingOpen(): Promise<boolean> {
  const row = await queryOne<{ is_open: boolean }>(
    "getOrderingOpen",
    `select is_open from ordering_schedule`,
  );
  return row.is_open;
}
