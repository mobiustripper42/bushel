/**
 * place_order RPC under multi-unit (DEC-032) — ported from
 * supabase/tests/place_order_units.sql. Verifies the unit-conversion math:
 *   - place_order accepts product_unit_id per line item.
 *   - order_items.unit_price_cents is snapshotted from product_units at order
 *     time (not trusted from the payload, not retroactively updated).
 *   - products.qty_available decrements by qty * conversion_to_base.
 *   - Oversell (DEC-012) flips orders.needs_reconciliation; qty=0 (DEC-036)
 *     rejects the whole order; multi-item orders are atomic.
 *   - Missing product_unit_id falls through to the 6.5a safety-net trigger.
 *
 * All 19 pgTAP assertions ported. 0 RLS/policy/anon assertions in the source
 * (DEC-048 deleted RLS), so none dropped.
 *
 * State accumulates across sections exactly as the pgTAP begin/rollback did
 * (e.g. Chives is seeded in section 6 and reused in section 7), so fixtures are
 * seeded once in beforeAll + inline per section, and the `it` blocks run in
 * file order without a reset between them.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { canConnect, closePool, migrateTestDb, resetData } from "./helpers";

const d = (await canConnect()) ? describe : describe.skip;

// UUIDs mirrored from the pgTAP fixture so intent stays traceable.
const CUST_1 = "dddd0000-0000-0000-0000-000000000001";
const CUST_2 = "dddd0000-0000-0000-0000-000000000002";
const CUST_3 = "dddd0000-0000-0000-0000-000000000003";
const CUST_4 = "dddd0000-0000-0000-0000-000000000004";
const CUST_5 = "dddd0000-0000-0000-0000-000000000005";
const CUST_6 = "dddd0000-0000-0000-0000-000000000006";
const CUST_7 = "dddd0000-0000-0000-0000-000000000007";

const P_BASIL = "dddd0000-0000-0000-0000-aaaa00000001";
const P_MINT = "dddd0000-0000-0000-0000-aaaa00000002";
const P_CHIVES = "dddd0000-0000-0000-0000-aaaa00000003";
const P_PHANTOM = "dddd0000-0000-0000-0000-aaaa00000004";
const P_ZERO = "dddd0000-0000-0000-0000-aaaa00000005";
const P_INSTOCK = "dddd0000-0000-0000-0000-aaaa00000006";

const U_BASIL_BUNCH = "dddd0000-0000-0000-0000-bbbb00000001";
const U_BASIL_LB = "dddd0000-0000-0000-0000-bbbb00000002";
const U_MINT_LB = "dddd0000-0000-0000-0000-cccc00000002";
const U_CHIVES_BUNCH = "dddd0000-0000-0000-0000-eeee00000001";
const U_ZERO_BUNCH = "dddd0000-0000-0000-0000-ffff00000001";
const U_INSTOCK_BUNCH = "dddd0000-0000-0000-0000-ffff00000002";

const WEEK = "2026-06-01";

/**
 * Call place_order with a single line item. The RETURNS TABLE shape means a
 * successful call resolves to a row array — used both to place orders and as
 * the lives_ok assertion.
 */
function placeOrder(
  customerId: string,
  address: string,
  items: Array<Record<string, unknown>>,
) {
  return query(
    `select * from public.place_order(
       $1::uuid, $2::date, 'delivery', $3, '', '', '', $4::jsonb
     )`,
    [customerId, WEEK, address, JSON.stringify(items)],
  );
}

async function qtyAvailable(productId: string): Promise<number> {
  const rows = await query<{ qty_available: number }>(
    `select qty_available from public.products where id = $1::uuid`,
    [productId],
  );
  return rows[0].qty_available;
}

d("place_order unit-conversion math (DEC-032)", () => {
  beforeAll(async () => {
    await migrateTestDb();
    await resetData();

    // Section 1 fixture: Basil (10 units) with bunch (base, conv=1) + lb (conv=2).
    await query(
      `insert into public.customers (id, name, token)
       values ($1::uuid, 'PlaceOrder Customer', 'token-place-order-65d')`,
      [CUST_1],
    );
    await query(
      `insert into public.products (id, name, qty_available, sort_order, category)
       values ($1::uuid, 'Basil', 10.00, 1, 'Herbs')`,
      [P_BASIL],
    );
    await query(
      `insert into public.product_units
         (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
       values
         ($1::uuid, $2::uuid, 'bunch', 1, 350, true, 'basil-bunch-dddd0000', 0),
         ($3::uuid, $2::uuid, 'lb',    2, 600, true, 'basil-lb-dddd0000',    1)`,
      [U_BASIL_BUNCH, P_BASIL, U_BASIL_LB],
    );
  });
  afterAll(closePool);

  // === 1. Fractional decrement: qty=2 of the lb unit (conv=2) drops stock by 4.
  it("place_order accepts product_unit_id in p_items", async () => {
    await expect(
      placeOrder(CUST_1, "123 Test St", [
        {
          product_id: P_BASIL,
          product_unit_id: U_BASIL_LB,
          qty: 2,
          unit_price_cents: 999,
        },
      ]),
    ).resolves.toBeDefined();
  });

  it("qty_available decremented by qty * conversion_to_base (10 - 2*2 = 6)", async () => {
    expect(await qtyAvailable(P_BASIL)).toBe(6);
  });

  // === 2. unit_price_cents snapshotted from product_units, not the payload (999).
  it("order_items.unit_price_cents pulled from product_units, ignoring payload value", async () => {
    const rows = await query<{ unit_price_cents: number }>(
      `select unit_price_cents from public.order_items
       where product_id = $1::uuid limit 1`,
      [P_BASIL],
    );
    expect(rows[0].unit_price_cents).toBe(600);
  });

  // === 3. product_unit_id persists from the payload (not the trigger fallback).
  it("order_items.product_unit_id matches the payload (lb unit, not base)", async () => {
    const rows = await query<{ product_unit_id: string }>(
      `select product_unit_id from public.order_items
       where product_id = $1::uuid limit 1`,
      [P_BASIL],
    );
    expect(rows[0].product_unit_id).toBe(U_BASIL_LB);
  });

  // === 4. Price snapshot survives a later unit-price edit.
  it("order_items.unit_price_cents stays at snapshot value after unit price edit", async () => {
    await query(
      `update public.product_units set unit_price_cents = 99999 where id = $1::uuid`,
      [U_BASIL_LB],
    );
    const rows = await query<{ unit_price_cents: number }>(
      `select unit_price_cents from public.order_items
       where product_id = $1::uuid limit 1`,
      [P_BASIL],
    );
    expect(rows[0].unit_price_cents).toBe(600);
  });

  // === 5. Oversell-by-unit reconciliation on a fresh (customer, product).
  it("oversold order is accepted (DEC-012)", async () => {
    await query(
      `insert into public.customers (id, name, token)
       values ($1::uuid, 'Oversell Customer', 'token-oversell-65d')`,
      [CUST_2],
    );
    await query(
      `insert into public.products (id, name, qty_available, sort_order, category)
       values ($1::uuid, 'Mint', 3.00, 2, 'Herbs')`,
      [P_MINT],
    );
    await query(
      `insert into public.product_units
         (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
       values
         ('dddd0000-0000-0000-0000-cccc00000001'::uuid, $2::uuid, 'bunch', 1, 250, true, 'mint-bunch-dddd0000', 0),
         ($1::uuid, $2::uuid, 'lb', 4, 800, true, 'mint-lb-dddd0000', 1)`,
      [U_MINT_LB, P_MINT],
    );
    // 2 lb of mint = 8 base units, only 3 in stock → oversold by 5.
    await expect(
      placeOrder(CUST_2, "456 Oversell Ln", [
        {
          product_id: P_MINT,
          product_unit_id: U_MINT_LB,
          qty: 2,
          unit_price_cents: 800,
        },
      ]),
    ).resolves.toBeDefined();
  });

  it("oversold inventory goes negative (3 - 2*4 = -5)", async () => {
    expect(await qtyAvailable(P_MINT)).toBe(-5);
  });

  it("orders.needs_reconciliation flipped true on oversold place_order", async () => {
    const rows = await query<{ needs_reconciliation: boolean }>(
      `select needs_reconciliation from public.orders
       where customer_id = $1::uuid and week_of = $2`,
      [CUST_2, WEEK],
    );
    expect(rows[0].needs_reconciliation).toBe(true);
  });

  // === 6. Single-unit regression: one base unit still decrements qty * 1.
  it("single-unit order accepted", async () => {
    await query(
      `insert into public.customers (id, name, token)
       values ($1::uuid, 'Single-Unit Customer', 'token-single-unit-65d')`,
      [CUST_3],
    );
    await query(
      `insert into public.products (id, name, qty_available, sort_order, category)
       values ($1::uuid, 'Chives', 20.00, 3, 'Herbs')`,
      [P_CHIVES],
    );
    await query(
      `insert into public.product_units
         (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
       values ($1::uuid, $2::uuid, 'bunch', 1, 200, true, 'chives-bunch-dddd0000', 0)`,
      [U_CHIVES_BUNCH, P_CHIVES],
    );
    await expect(
      placeOrder(CUST_3, "789 Single St", [
        {
          product_id: P_CHIVES,
          product_unit_id: U_CHIVES_BUNCH,
          qty: 5,
          unit_price_cents: 200,
        },
      ]),
    ).resolves.toBeDefined();
  });

  it("single-unit decrement is qty * 1 (20 - 5 = 15)", async () => {
    expect(await qtyAvailable(P_CHIVES)).toBe(15);
  });

  // === 7. Missing product_unit_id falls through to the 6.5a safety-net trigger.
  it("payload without product_unit_id falls through to safety-net trigger", async () => {
    await query(
      `insert into public.customers (id, name, token)
       values ($1::uuid, 'Trigger Fallback Customer', 'token-fallback-65d')`,
      [CUST_4],
    );
    await expect(
      placeOrder(CUST_4, "999 Fallback Rd", [
        { product_id: P_CHIVES, qty: 2, unit_price_cents: 200 },
      ]),
    ).resolves.toBeDefined();
  });

  it("trigger filled in product_unit_id from the first active unit", async () => {
    const rows = await query<{ product_unit_id: string }>(
      `select product_unit_id from public.order_items
       where product_id = $1::uuid
         and order_id in (
           select id from public.orders
           where customer_id = $2::uuid and week_of = $3
         )`,
      [P_CHIVES, CUST_4, WEEK],
    );
    expect(rows[0].product_unit_id).toBe(U_CHIVES_BUNCH);
  });

  // === 8. Product with no active units + missing product_unit_id → targeted error.
  it("product with zero active units raises a targeted error (not the unit-mismatch message)", async () => {
    await query(
      `insert into public.customers (id, name, token)
       values ($1::uuid, 'No Units Customer', 'token-no-units-65d')`,
      [CUST_5],
    );
    await query(
      `insert into public.products (id, name, qty_available, sort_order, category)
       values ($1::uuid, 'Phantom', 5.00, 4, 'Herbs')`,
      [P_PHANTOM],
    );
    await expect(
      placeOrder(CUST_5, "111 No Units Way", [
        { product_id: P_PHANTOM, qty: 1, unit_price_cents: 100 },
      ]),
    ).rejects.toThrow(/has no active units/);
  });

  // === 9. qty=0 product rejects the whole order (DEC-036 / #132).
  it("place_order against a qty=0 product raises sold-out (DEC-036)", async () => {
    await query(
      `insert into public.customers (id, name, token)
       values ($1::uuid, 'Sold Out Customer', 'token-soldout-036')`,
      [CUST_6],
    );
    await query(
      `insert into public.products (id, name, qty_available, sort_order, category)
       values ($1::uuid, 'Zero Stock', 0.00, 5, 'Herbs')`,
      [P_ZERO],
    );
    await query(
      `insert into public.product_units
         (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
       values ($1::uuid, $2::uuid, 'bunch', 1, 300, true, 'zero-stock-dddd0000', 0)`,
      [U_ZERO_BUNCH, P_ZERO],
    );
    await expect(
      placeOrder(CUST_6, "222 Soldout St", [
        { product_id: P_ZERO, qty: 1, unit_price_cents: 300 },
      ]),
    ).rejects.toThrow(/is sold out/);
  });

  it("sold-out product stays at 0 — not driven negative (rejection rolled back the decrement)", async () => {
    expect(await qtyAvailable(P_ZERO)).toBe(0);
  });

  it("no order row created — the whole transaction rolled back", async () => {
    const rows = await query<{ count: number }>(
      `select count(*)::int as count from public.orders
       where customer_id = $1::uuid and week_of = $2`,
      [CUST_6, WEEK],
    );
    expect(rows[0].count).toBe(0);
  });

  // === 10. Multi-item atomicity (DEC-036): in-stock line listed first, then a
  //         sold-out line — the whole order rolls back, including the first write.
  it("multi-item order with one sold-out line is rejected as a whole", async () => {
    await query(
      `insert into public.customers (id, name, token)
       values ($1::uuid, 'Multi Item Customer', 'token-multi-036')`,
      [CUST_7],
    );
    await query(
      `insert into public.products (id, name, qty_available, sort_order, category)
       values ($1::uuid, 'In Stock Item', 9.00, 6, 'Herbs')`,
      [P_INSTOCK],
    );
    await query(
      `insert into public.product_units
         (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
       values ($1::uuid, $2::uuid, 'bunch', 1, 400, true, 'in-stock-item-dddd0000', 0)`,
      [U_INSTOCK_BUNCH, P_INSTOCK],
    );
    await expect(
      placeOrder(CUST_7, "333 Multi St", [
        { product_id: P_INSTOCK, qty: 1, unit_price_cents: 400 },
        { product_id: P_ZERO, qty: 1, unit_price_cents: 300 },
      ]),
    ).rejects.toThrow(/is sold out/);
  });

  it("in-stock item in a rejected multi-item order is NOT decremented (its write rolled back)", async () => {
    expect(await qtyAvailable(P_INSTOCK)).toBe(9);
  });

  it("no order row from the rejected multi-item order", async () => {
    const rows = await query<{ count: number }>(
      `select count(*)::int as count from public.orders
       where customer_id = $1::uuid`,
      [CUST_7],
    );
    expect(rows[0].count).toBe(0);
  });
});
