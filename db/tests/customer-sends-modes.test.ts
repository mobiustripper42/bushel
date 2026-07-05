/**
 * customer_sends.mode CHECK constraint (#193) — ported from
 * supabase/tests/customer_sends_modes.sql. delivery_reminder + pickup_reminder
 * accepted; an unknown mode rejected with 23514 (check_violation).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { canConnect, closePool, migrateTestDb, resetData } from "./helpers";

const d = (await canConnect()) ? describe : describe.skip;

d("customer_sends mode CHECK", () => {
  beforeAll(migrateTestDb);
  afterAll(closePool);
  beforeEach(async () => {
    await resetData();
    await query(
      `insert into customers (name, token) values ('Mode Test Farm', 'modetest-token-0001')`,
    );
  });

  async function insertSend(mode: string) {
    return query(
      `insert into customer_sends (customer_id, week_of, mode)
         select id, '2026-06-01', $1 from customers where token = 'modetest-token-0001'`,
      [mode],
    );
  }

  it("accepts mode = delivery_reminder", async () => {
    await expect(insertSend("delivery_reminder")).resolves.toBeDefined();
  });

  it("accepts mode = pickup_reminder", async () => {
    await expect(insertSend("pickup_reminder")).resolves.toBeDefined();
  });

  it("rejects an unknown mode (23514)", async () => {
    await expect(insertSend("carrier_pigeon")).rejects.toMatchObject({ code: "23514" });
  });
});
