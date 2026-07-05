/**
 * order_status codes (DEC-035 / #190) — ported from supabase/tests/order_status_codes.sql.
 * Confirms `confirmed` sits at ordinal 2 and the rest renumber 3/4/5.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { query, queryOne } from "@/lib/db";
import { canConnect, closePool, migrateTestDb } from "./helpers";

const d = (await canConnect()) ? describe : describe.skip;

d("order_status codes", () => {
  beforeAll(migrateTestDb);
  afterAll(closePool);

  it("new, confirmed, ready, picked_up, delivered at ordinals 1..5", async () => {
    const rows = await query(
      `select code, sort_order from codes where type = 'order_status' order by sort_order`,
    );
    expect(rows).toEqual([
      { code: "new", sort_order: 1 },
      { code: "confirmed", sort_order: 2 },
      { code: "ready", sort_order: 3 },
      { code: "picked_up", sort_order: 4 },
      { code: "delivered", sort_order: 5 },
    ]);
  });

  it("confirmed has label 'Confirmed'", async () => {
    const row = await queryOne<{ label: string }>(
      "confirmed label",
      `select label from codes where type = 'order_status' and code = 'confirmed'`,
    );
    expect(row.label).toBe("Confirmed");
  });
});
