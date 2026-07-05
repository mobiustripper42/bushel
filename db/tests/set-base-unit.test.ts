/**
 * set_base_unit rebase RPC (#208 / DEC-038) — ported from
 * supabase/tests/set_base_unit.sql.
 *
 * Re-basing divides every unit's conversion_to_base AND the product's
 * qty_available (stored in base units) by the new base's old conversion,
 * atomically, then renumbers sort_order so the new base sorts first. Verifies:
 *   - the rescale lands the new base at exactly 1.0 and rescales the rest
 *     (including inactive units) by the same factor
 *   - qty_available rescales identically → historical order math is unchanged
 *   - prices are untouched (per-unit truths don't depend on the base)
 *   - the new base gets the smallest sort_order (customer default = units[0])
 *   - raises on cross-product / inactive / missing units + the scale guard;
 *     no-op on the current base
 *
 * The pgTAP ran as one begin/rollback transaction with progressive state, so
 * these assertions run in order against a single seed (beforeAll), NOT a
 * per-test reset — later checks depend on the rebase performed earlier.
 *
 * 17 assertions converted, all preserved. 0 RLS/policy/anon assertions dropped
 * (this suite had none — DEC-048 N/A here).
 *
 * throws_like message-pattern checks map to `.rejects.toThrow(/pattern/)`
 * since the source guards on the raised message, not a sqlstate.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { canConnect, closePool, migrateTestDb, resetData } from "./helpers";

const d = (await canConnect()) ? describe : describe.skip;

const BASIL = "ee080000-0000-0000-0000-aaaa00000001";
const MINT = "ee080000-0000-0000-0000-aaaa00000002";
const BULK = "ee080000-0000-0000-0000-aaaa00000003";

const BASIL_BUNCH = "ee080000-0000-0000-0000-bbbb00000001"; // conv 1 (base)
const BASIL_LB = "ee080000-0000-0000-0000-bbbb00000002"; // conv 0.5
const BASIL_CASE = "ee080000-0000-0000-0000-bbbb00000003"; // conv 4, inactive
const MINT_BUNCH = "ee080000-0000-0000-0000-cccc00000001";
const BULK_CRATE = "ee080000-0000-0000-0000-eeee00000003"; // conv 3
const ORDER = "ee080000-0000-0000-0000-dddd00000001";

const setBaseUnit = (productId: string, unitId: string) =>
  query(`select public.set_base_unit($1::uuid, $2::uuid)`, [productId, unitId]);

const convOf = async (unitId: string) =>
  (
    await query<{ conversion_to_base: number }>(
      `select conversion_to_base from public.product_units where id = $1::uuid`,
      [unitId],
    )
  )[0].conversion_to_base;

const qtyOf = async (productId: string) =>
  (
    await query<{ qty_available: number }>(
      `select qty_available from public.products where id = $1::uuid`,
      [productId],
    )
  )[0].qty_available;

d("set_base_unit rebase (#208)", () => {
  beforeAll(async () => {
    await migrateTestDb();
    await resetData();

    // Fixture: Basil with base "bunch" (conv 1.0) + "lb" (conv 0.5) + an
    // INACTIVE "case" (conv 4). 10 bunches in stock.
    await query(
      `insert into public.products (id, name, qty_available, sort_order, category)
       values ($1::uuid, 'Basil', 10.00, 1, 'Herbs')`,
      [BASIL],
    );
    await query(
      `insert into public.product_units
         (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
       values
         ($1::uuid, $4::uuid, 'bunch', 1,   350,  true,  'basil-bunch-ee080000', 0),
         ($2::uuid, $4::uuid, 'lb',    0.5, 600,  true,  'basil-lb-ee080000',    1),
         ($3::uuid, $4::uuid, 'case',  4,   2000, false, 'basil-case-ee080000',  2)`,
      [BASIL_BUNCH, BASIL_LB, BASIL_CASE, BASIL],
    );

    // Second product whose unit must not be promotable onto Basil.
    await query(
      `insert into public.products (id, name, qty_available, sort_order, category)
       values ($1::uuid, 'Mint', 5.00, 2, 'Herbs')`,
      [MINT],
    );
    await query(
      `insert into public.product_units
         (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
       values ($1::uuid, $2::uuid, 'bunch', 1, 250, true, 'mint-bunch-ee080000', 0)`,
      [MINT_BUNCH, MINT],
    );

    // Existing order line on the lb unit: 3 lb = 1.5 base against stock of 10.
    // Footprint ratio (qty * conv) / qty_available = 0.15 must survive the rebase.
    const CUSTOMER = "ee080000-0000-0000-0000-000000000001";
    await query(
      `insert into public.customers (id, name, token)
       values ($1::uuid, 'Rebase Customer', 'token-rebase-208')`,
      [CUSTOMER],
    );
    await query(
      `insert into public.orders (id, customer_id, week_of, fulfillment_type, status)
       values ($1::uuid, $2::uuid, '2026-06-01', 'pickup', 'new')`,
      [ORDER, CUSTOMER],
    );
    await query(
      `insert into public.order_items (order_id, product_id, product_unit_id, qty, unit_price_cents)
       values ($1::uuid, $2::uuid, $3::uuid, 3, 600)`,
      [ORDER, BASIL, BASIL_LB],
    );

    // Third product for the scale guard: a tiny "mg" unit (conv 0.0001) beside a
    // big "crate" (conv 3). Promoting crate rounds mg to 0.0000, tripping the
    // conversion_to_base > 0 CHECK — set_base_unit must reject it up front.
    await query(
      `insert into public.products (id, name, qty_available, sort_order, category)
       values ($1::uuid, 'Bulk', 9.00, 3, 'Other')`,
      [BULK],
    );
    await query(
      `insert into public.product_units
         (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
       values
         ('ee080000-0000-0000-0000-eeee00000001'::uuid, $1::uuid, 'kg',    1,      500,  true, 'bulk-kg-ee080000',    0),
         ('ee080000-0000-0000-0000-eeee00000002'::uuid, $1::uuid, 'mg',    0.0001, 1,    true, 'bulk-mg-ee080000',    1),
         ($2::uuid,                                      $1::uuid, 'crate', 3,      9000, true, 'bulk-crate-ee080000', 2)`,
      [BULK, BULK_CRATE],
    );
  });
  afterAll(closePool);

  // 1. Guard rails: cross-product, missing, inactive, and scale-guard raise.
  it("rejects a unit belonging to another product", async () => {
    await expect(setBaseUnit(BASIL, MINT_BUNCH)).rejects.toThrow(
      /does not belong to product/,
    );
  });

  it("rejects a nonexistent unit id", async () => {
    await expect(
      setBaseUnit(BASIL, "ee080000-0000-0000-0000-feed00000099"),
    ).rejects.toThrow(/does not belong to product/);
  });

  it("rejects an inactive unit as the base", async () => {
    await expect(setBaseUnit(BASIL, BASIL_CASE)).rejects.toThrow(/is inactive/);
  });

  it("rejects a rebase that would round a conversion to zero", async () => {
    await expect(setBaseUnit(BULK, BULK_CRATE)).rejects.toThrow(
      /too far apart in scale/,
    );
  });

  // 2. No-op when the unit is already the base: nothing rescales.
  it("is a no-op when promoting the current base", async () => {
    await expect(setBaseUnit(BASIL, BASIL_BUNCH)).resolves.toBeDefined();
  });

  it("no-op left the lb conversion untouched", async () => {
    expect(await convOf(BASIL_LB)).toBe(0.5);
  });

  it("no-op left qty_available untouched", async () => {
    expect(await qtyOf(BASIL)).toBe(10);
  });

  // 3. The rebase: lb (conv 0.5) becomes the base. Every conversion and
  //    qty_available divides by 0.5.
  it("succeeds on an active non-base unit", async () => {
    await expect(setBaseUnit(BASIL, BASIL_LB)).resolves.toBeDefined();
  });

  it("new base lands at exactly 1.0", async () => {
    expect(await convOf(BASIL_LB)).toBe(1);
  });

  it("old base rescales: one bunch is now 2 lb-units (1 / 0.5)", async () => {
    expect(await convOf(BASIL_BUNCH)).toBe(2);
  });

  it("inactive unit rescales too (4 / 0.5 = 8)", async () => {
    expect(await convOf(BASIL_CASE)).toBe(8);
  });

  it("exactly one base unit after the rebase", async () => {
    const rows = await query<{ n: number }>(
      `select count(*)::int as n from public.product_units
        where product_id = $1::uuid and conversion_to_base = 1`,
      [BASIL],
    );
    expect(rows[0].n).toBe(1);
  });

  it("qty_available rescales by the same factor (10 / 0.5 = 20)", async () => {
    expect(await qtyOf(BASIL)).toBe(20);
  });

  // 4. New base sorts first; the rest keep their display order.
  it("sort_order renumbered: new base first, others in prior order", async () => {
    const rows = await query<{ labels: string[] }>(
      `select array_agg(label order by sort_order, created_at) as labels
         from public.product_units where product_id = $1::uuid`,
      [BASIL],
    );
    expect(rows[0].labels).toEqual(["lb", "bunch", "case"]);
  });

  // 5. Prices are per-unit and must NOT change.
  it("unit prices untouched by the rebase", async () => {
    const rows = await query<{ prices: number[] }>(
      `select array_agg(unit_price_cents order by label) as prices
         from public.product_units where product_id = $1::uuid`,
      [BASIL],
    );
    expect(rows[0].prices).toEqual([350, 2000, 600]); // bunch, case, lb
  });

  // 6. Order-math invariance: footprint ratio unchanged (3 * 1.0 / 20 = 0.15).
  it("order line footprint ratio (qty * live conv / qty) is unchanged", async () => {
    const rows = await query<{ ratio: number }>(
      `select (oi.qty * pu.conversion_to_base) / p.qty_available as ratio
         from public.order_items oi
         join public.product_units pu on pu.id = oi.product_unit_id
         join public.products p on p.id = oi.product_id
        where oi.order_id = $1::uuid`,
      [ORDER],
    );
    expect(rows[0].ratio).toBe(0.15);
  });

  it("order line qty + snapshotted price untouched by the rebase", async () => {
    const rows = await query<{ qty: number; unit_price_cents: number }>(
      `select qty, unit_price_cents from public.order_items where order_id = $1::uuid`,
      [ORDER],
    );
    expect(rows[0]).toEqual({ qty: 3, unit_price_cents: 600 });
  });
});
