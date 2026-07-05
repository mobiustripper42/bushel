/**
 * place_order additive open-order behavior (#211 / DEC-039 + #226 / DEC-041) —
 * ported from supabase/tests/place_order_additive.sql (~32 assertions).
 *
 * Verifies the post-DEC-041 contract:
 *   - first submission creates the customer's OPEN order (appended = false);
 *     later submissions APPEND to it (appended = true) — at most one open
 *     orders row per customer (partial unique index).
 *   - a replayed submission_id is a no-op (same order_id, no new items, no
 *     double decrement), including a replay whose order has gone terminal.
 *   - appending to a confirmed/ready order resets status to 'new'.
 *   - a terminal order (picked_up/delivered) drops out of the identity; the
 *     next submission CREATES a fresh open order and leaves the fulfilled one
 *     untouched.
 *   - DEC-036 soldout reject + multi-line atomicity hold on the append path.
 *
 * The pgTAP original ran inside one begin/rollback with assertions that
 * progressively mutate accumulating state; that ordering is load-bearing, so
 * fixtures are seeded once in beforeAll and the it() blocks run in sequence
 * WITHOUT resetting between them.
 *
 * RLS assertions dropped: 0 (this file tested none).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { canConnect, closePool, migrateTestDb, resetData } from "./helpers";

const d = (await canConnect()) ? describe : describe.skip;

const CUST_A = "ee390000-0000-0000-0000-000000000001";
const CUST_B = "ee390000-0000-0000-0000-000000000002";
const PROD_BASIL = "ee390000-0000-0000-0000-aaaa00000001";
const UNIT_BASIL = "ee390000-0000-0000-0000-bbbb00000001";
const PROD_SCOPE = "ee390000-0000-0000-0000-aaaa00000003";
const UNIT_SCOPE = "ee390000-0000-0000-0000-bbbb00000003";
const PROD_ZERO = "ee390000-0000-0000-0000-aaaa00000002";
const UNIT_ZERO = "ee390000-0000-0000-0000-bbbb00000002";
const SUB = (n: number) =>
  `ee39aaaa-0000-0000-0000-00000000000${n}`;

type Line = {
  product_id: string;
  product_unit_id: string;
  qty: number;
  unit_price_cents: number;
};

type PlaceResult = { order_id: string; appended: boolean };

async function placeOrder(opts: {
  customer: string;
  week: string;
  fulfillment?: string;
  deliveryAddress?: string;
  deliveryPreference?: string;
  pickupNote?: string;
  notes?: string;
  items: Line[];
  submission: string;
}): Promise<PlaceResult[]> {
  return query<PlaceResult>(
    `select order_id, appended from public.place_order($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
    [
      opts.customer,
      opts.week,
      opts.fulfillment ?? "delivery",
      opts.deliveryAddress ?? "123 Additive St",
      opts.deliveryPreference ?? "",
      opts.pickupNote ?? "",
      opts.notes ?? "",
      JSON.stringify(opts.items),
      opts.submission,
    ],
  );
}

const basil = (qty: number): Line => ({
  product_id: PROD_BASIL,
  product_unit_id: UNIT_BASIL,
  qty,
  unit_price_cents: 500,
});

async function qtyAvailable(productId: string): Promise<number> {
  const rows = await query<{ qty_available: number }>(
    `select qty_available from public.products where id = $1`,
    [productId],
  );
  return rows[0].qty_available;
}

async function orderCount(customerId: string): Promise<number> {
  const rows = await query<{ n: number }>(
    `select count(*)::int as n from public.orders where customer_id = $1`,
    [customerId],
  );
  return rows[0].n;
}

async function itemCount(customerId: string): Promise<number> {
  const rows = await query<{ n: number }>(
    `select count(*)::int as n
       from public.order_items oi
       join public.orders o on o.id = oi.order_id
      where o.customer_id = $1`,
    [customerId],
  );
  return rows[0].n;
}

async function orderIdForSubmission(submission: string): Promise<string> {
  const rows = await query<{ order_id: string }>(
    `select oi.order_id from public.order_items oi
      where oi.submission_id = $1 limit 1`,
    [submission],
  );
  return rows[0].order_id;
}

async function itemsForSubmission(submission: string): Promise<number> {
  const rows = await query<{ n: number }>(
    `select count(*)::int as n from public.order_items where submission_id = $1`,
    [submission],
  );
  return rows[0].n;
}

async function setStatus(customerId: string, status: string, whereStatus?: string) {
  if (whereStatus) {
    await query(
      `update public.orders set status = $1 where customer_id = $2 and status = $3`,
      [status, customerId, whereStatus],
    );
  } else {
    await query(`update public.orders set status = $1 where customer_id = $2`, [
      status,
      customerId,
    ]);
  }
}

d("place_order additive open-order behavior", () => {
  beforeAll(async () => {
    await migrateTestDb();
    await resetData();

    // Two customers (B exercises foreign-submission_id scoping).
    await query(
      `insert into public.customers (id, name, token) values
         ($1, 'Additive Customer', 'token-additive-039'),
         ($2, 'Other Customer', 'token-additive-039-b')`,
      [CUST_A, CUST_B],
    );

    // Products + explicit unit rows (DEC-037: nothing spawns units).
    await query(
      `insert into public.products (id, name, qty_available, sort_order, category) values
         ($1, 'Add Basil', 20.00, 1, 'Herbs'),
         ($2, 'Add Scope', 5.00, 3, 'Herbs'),
         ($3, 'Add Zero Stock', 0.00, 2, 'Herbs')`,
      [PROD_BASIL, PROD_SCOPE, PROD_ZERO],
    );
    await query(
      `insert into public.product_units
         (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order) values
         ($1, $2, 'bunch', 1, 500, true, 'add-basil-ee390000', 0),
         ($3, $4, 'bunch', 1, 400, true, 'add-scope-ee390000', 0),
         ($5, $6, 'bunch', 1, 300, true, 'add-zero-stock-ee390000', 0)`,
      [
        UNIT_BASIL, PROD_BASIL,
        UNIT_SCOPE, PROD_SCOPE,
        UNIT_ZERO, PROD_ZERO,
      ],
    );
  });

  afterAll(closePool);

  // 1–3. First submission creates the open order.
  it("first submission creates the order (appended=false), one row, inventory 20-2=18", async () => {
    const [r] = await placeOrder({
      customer: CUST_A,
      week: "2026-06-01",
      notes: "first note",
      items: [basil(2)],
      submission: SUB(1),
    });
    expect(r.appended).toBe(false);
    expect(await orderCount(CUST_A)).toBe(1);
    expect(await qtyAvailable(PROD_BASIL)).toBe(18);
  });

  // 4–7. Second submission appends.
  it("second submission appends (appended=true), still one order, 2 items, inventory 18-3=15", async () => {
    const [r] = await placeOrder({
      customer: CUST_A,
      week: "2026-06-01",
      items: [basil(3)],
      submission: SUB(2),
    });
    expect(r.appended).toBe(true);
    expect(await orderCount(CUST_A)).toBe(1);
    expect(await itemCount(CUST_A)).toBe(2);
    expect(await qtyAvailable(PROD_BASIL)).toBe(15);
  });

  // 8–10. Replaying the same submission_id is a no-op.
  it("replayed submission_id returns existing order, no new items, no double decrement", async () => {
    const [r] = await placeOrder({
      customer: CUST_A,
      week: "2026-06-01",
      items: [basil(3)],
      submission: SUB(2),
    });
    expect(r.order_id).toBe(await orderIdForSubmission(SUB(2)));
    expect(await itemCount(CUST_A)).toBe(2);
    expect(await qtyAvailable(PROD_BASIL)).toBe(15);
  });

  // 11–14. Appending to a confirmed/ready order resets status to 'new'.
  it("append to a confirmed order is accepted and resets confirmed -> new", async () => {
    await setStatus(CUST_A, "confirmed");
    await expect(
      placeOrder({
        customer: CUST_A,
        week: "2026-06-01",
        items: [basil(1)],
        submission: SUB(3),
      }),
    ).resolves.toBeDefined();
    const rows = await query<{ status: string }>(
      `select status from public.orders where customer_id = $1`,
      [CUST_A],
    );
    expect(rows[0].status).toBe("new");
  });

  it("append to a ready order is accepted and resets ready -> new", async () => {
    await setStatus(CUST_A, "ready");
    await expect(
      placeOrder({
        customer: CUST_A,
        week: "2026-06-01",
        items: [basil(1)],
        submission: SUB(4),
      }),
    ).resolves.toBeDefined();
    const rows = await query<{ status: string }>(
      `select status from public.orders where customer_id = $1`,
      [CUST_A],
    );
    expect(rows[0].status).toBe("new");
  });

  // 15–19. A terminal (picked_up) order frees a new open order.
  it("submission against a picked_up order CREATES a new open order, leaving the fulfilled one untouched", async () => {
    await setStatus(CUST_A, "picked_up");
    const [r] = await placeOrder({
      customer: CUST_A,
      week: "2026-06-08",
      items: [basil(1)],
      submission: SUB(5),
    });
    expect(r.appended).toBe(false);
    // different row than the fulfilled one (which carries SUB1's item)
    expect(r.order_id).not.toBe(await orderIdForSubmission(SUB(1)));
    expect(await orderCount(CUST_A)).toBe(2);

    const fulfilledItems = await query<{ n: number }>(
      `select count(*)::int as n from public.order_items oi
        where oi.order_id = (select o.id from public.orders o
                             where o.customer_id = $1 and o.status = 'picked_up')`,
      [CUST_A],
    );
    expect(fulfilledItems[0].n).toBe(4);
    expect(await qtyAvailable(PROD_BASIL)).toBe(12);
  });

  // 20–21. Partial unique index enforcement.
  it("partial unique index refuses a second open order per customer (23505)", async () => {
    await expect(
      query(
        `insert into public.orders (customer_id, week_of, fulfillment_type, status)
           values ($1, '2026-06-08', 'delivery', 'new')`,
        [CUST_A],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("a terminal row is outside the index predicate — inserting one is allowed", async () => {
    const probeId = "ee390000-0000-0000-0000-dddd00000001";
    await expect(
      query(
        `insert into public.orders (id, customer_id, week_of, fulfillment_type, status)
           values ($1, $2, '2026-05-25', 'delivery', 'delivered')`,
        [probeId, CUST_A],
      ),
    ).resolves.toBeDefined();
    // Remove the probe row so later counts stay legible.
    await query(`delete from public.orders where id = $1`, [probeId]);
  });

  // 22–23. Delivered also frees a new order.
  it("a delivered order also frees a new one (appended=false), three orders now", async () => {
    await setStatus(CUST_A, "delivered", "new");
    const [r] = await placeOrder({
      customer: CUST_A,
      week: "2026-06-08",
      items: [basil(1)],
      submission: SUB(6),
    });
    expect(r.appended).toBe(false);
    expect(await orderCount(CUST_A)).toBe(3);
  });

  // 24–27. DEC-036 on the append path.
  it("append of a sold-out product is rejected", async () => {
    await expect(
      placeOrder({
        customer: CUST_A,
        week: "2026-06-08",
        items: [
          { product_id: PROD_ZERO, product_unit_id: UNIT_ZERO, qty: 1, unit_price_cents: 300 },
        ],
        submission: SUB(7),
      }),
    ).rejects.toThrow(/is sold out/);
  });

  it("multi-line append with one sold-out line is rejected as a whole (in-stock line rolls back)", async () => {
    await expect(
      placeOrder({
        customer: CUST_A,
        week: "2026-06-08",
        items: [
          basil(1),
          { product_id: PROD_ZERO, product_unit_id: UNIT_ZERO, qty: 1, unit_price_cents: 300 },
        ],
        submission: SUB(8),
      }),
    ).rejects.toThrow(/is sold out/);
    // in-stock line NOT decremented (still 11 after the 12 -> failed appends)
    expect(await qtyAvailable(PROD_BASIL)).toBe(11);
    expect(await itemsForSubmission(SUB(8))).toBe(0);
  });

  // 28–29. Reconciliation recomputes across the whole order on append.
  it("oversold append (11 left, 20 ordered) is accepted and flips needs_reconciliation", async () => {
    await expect(
      placeOrder({
        customer: CUST_A,
        week: "2026-06-08",
        items: [basil(20)],
        submission: SUB(9),
      }),
    ).resolves.toBeDefined();
    const rows = await query<{ needs_reconciliation: boolean }>(
      `select needs_reconciliation from public.orders
        where customer_id = $1 and status = 'new'`,
      [CUST_A],
    );
    expect(rows[0].needs_reconciliation).toBe(true);
  });

  // 30–31. Replay against a now-terminal order.
  it("replaying a submission whose order went terminal returns that order and appended=true", async () => {
    const [r] = await placeOrder({
      customer: CUST_A,
      week: "2026-06-01",
      notes: "first note",
      items: [basil(2)],
      submission: SUB(1),
    });
    expect(r.order_id).toBe(await orderIdForSubmission(SUB(1)));
    expect(r.appended).toBe(true);
  });

  // 32. Foreign-submission_id scoping.
  it("replaying another customer's submission_id returns B's own order, not A's", async () => {
    const [r] = await placeOrder({
      customer: CUST_B,
      week: "2026-06-08",
      fulfillment: "pickup",
      deliveryAddress: "",
      pickupNote: "B pickup",
      items: [
        { product_id: PROD_SCOPE, product_unit_id: UNIT_SCOPE, qty: 1, unit_price_cents: 400 },
      ],
      submission: SUB(1), // A's submission_id
    });
    expect(r.order_id).not.toBe(await orderIdForSubmission(SUB(1)));
  });
});
