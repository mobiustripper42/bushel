/**
 * product_units schema + trigger integration — ported from
 * supabase/tests/product_units.sql. Covers the multi-unit schema shape, the
 * DEC-037 dropped-columns/dropped-functions shape, the order_items
 * default-unit BEFORE-INSERT trigger (incl. its is_active filter), fractional
 * qty_available, FK/CHECK enforcement, and product→product_units cascade.
 *
 * DROPPED per DEC-048 (RLS deleted): 6 RLS-era assertions did not port —
 * the "RLS — anon" section's 5 policy checks (anon reads active / anon can't
 * read inactive / anon can't insert / authenticated reads all / authenticated
 * can insert) plus the "RLS enabled on product_units" (relrowsecurity = true)
 * check. There are no row-level policies anymore; access is app-enforced.
 * The active-only-visibility intent that RLS carried is preserved at the DB
 * level by the trigger's `is_active = true` filter, tested below.
 *
 * Also not ported: the original "backfill produced one product_units row per
 * existing product" assertion — it verified a one-time data backfill in the
 * incremental Supabase migration. The consolidated 0001_init.sql ships an
 * empty schema (no data migration), so there is nothing to assert.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { canConnect, closePool, migrateTestDb, resetData } from "./helpers";

const d = (await canConnect()) ? describe : describe.skip;

// Fixed fixture ids carried over from the pgTAP source.
const PRODUCT = "eeeeeeee-0000-0000-0000-000000000001";
const CUSTOMER = "ffffffff-0000-0000-0000-000000000001";
const ORDER = "eeeeeeee-1111-0000-0000-000000000001";

d("product_units schema + trigger", () => {
  beforeAll(migrateTestDb);
  afterAll(closePool);

  // ── Schema shape ────────────────────────────────────────────────────────
  // Pure catalog reads; no fixture data required.
  describe("schema shape", () => {
    async function productUnitsColumns(): Promise<string[]> {
      const rows = await query<{ column_name: string }>(
        `select column_name from information_schema.columns
          where table_schema = 'public' and table_name = 'product_units'`,
      );
      return rows.map((r) => r.column_name);
    }

    it("product_units table exists", async () => {
      const rows = await query(
        `select to_regclass('public.product_units') as reg`,
      );
      expect(rows[0].reg).toBe("product_units");
    });

    it("product_units has the expected columns", async () => {
      const cols = await productUnitsColumns();
      for (const c of [
        "product_id",
        "label",
        "conversion_to_base",
        "unit_price_cents",
        "is_active",
        "slug",
      ]) {
        expect(cols).toContain(c);
      }
    });

    it("order_items.product_unit_id exists and is NOT NULL (DEC-032)", async () => {
      const rows = await query<{ is_nullable: string }>(
        `select is_nullable from information_schema.columns
          where table_schema = 'public' and table_name = 'order_items'
            and column_name = 'product_unit_id'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].is_nullable).toBe("NO");
    });

    it("products.qty_available is numeric(10,2)", async () => {
      const rows = await query<{
        data_type: string;
        numeric_precision: number;
        numeric_scale: number;
      }>(
        `select data_type, numeric_precision, numeric_scale
           from information_schema.columns
          where table_schema = 'public' and table_name = 'products'
            and column_name = 'qty_available'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        data_type: "numeric",
        numeric_precision: 10,
        numeric_scale: 2,
      });
    });

    it("products.unit and products.price_cents are dropped (DEC-037)", async () => {
      const rows = await query<{ column_name: string }>(
        `select column_name from information_schema.columns
          where table_schema = 'public' and table_name = 'products'`,
      );
      const cols = rows.map((r) => r.column_name);
      expect(cols).not.toContain("unit");
      expect(cols).not.toContain("price_cents");
    });

    it("mirror/spawn functions are dropped, order_items_default_unit survives (DEC-037)", async () => {
      const rows = await query<{ proname: string }>(
        `select proname from pg_proc
          where pronamespace = 'public'::regnamespace
            and proname in (
              'mirror_product_to_base_unit',
              'mirror_base_unit_to_product',
              'products_spawn_default_unit',
              'order_items_default_unit'
            )`,
      );
      const fns = rows.map((r) => r.proname);
      expect(fns).not.toContain("mirror_product_to_base_unit");
      expect(fns).not.toContain("mirror_base_unit_to_product");
      expect(fns).not.toContain("products_spawn_default_unit");
      expect(fns).toContain("order_items_default_unit");
    });
  });

  // ── FK + CHECK enforcement ──────────────────────────────────────────────
  describe("constraints", () => {
    beforeEach(async () => {
      await resetData();
      await query(
        `insert into products (id, name, qty_available, is_available)
         values ($1, 'Constraint Product', 5, true)`,
        [PRODUCT],
      );
      await query(
        `insert into customers (id, name, token)
         values ($1, 'FK Customer', 'token-fk')`,
        [CUSTOMER],
      );
      await query(
        `insert into orders (id, customer_id, week_of, fulfillment_type, status)
         values ($1, $2, '2026-05-11', 'delivery', 'new')`,
        [ORDER, CUSTOMER],
      );
    });

    it("order_items.product_unit_id FK rejects an unknown unit id (23503)", async () => {
      await expect(
        query(
          `insert into order_items (order_id, product_id, qty, unit_price_cents, product_unit_id)
           values ($1, $2, 1, 100, '99999999-9999-9999-9999-999999999999')`,
          [ORDER, PRODUCT],
        ),
      ).rejects.toMatchObject({ code: "23503" });
    });

    it("product_units.conversion_to_base must be > 0 (23514)", async () => {
      await expect(
        query(
          `insert into product_units (product_id, label, conversion_to_base, unit_price_cents, slug)
           values ($1, 'bad', 0, 100, 'bad-zero')`,
          [PRODUCT],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    });
  });

  // ── order_items_default_unit trigger ────────────────────────────────────
  describe("default-unit trigger", () => {
    beforeEach(async () => {
      await resetData();
      await query(
        `insert into products (id, name, qty_available, is_available)
         values ($1, 'Test Multi Unit Item', 7, true)`,
        [PRODUCT],
      );
      await query(
        `insert into customers (id, name, token)
         values ($1, 'Multi Unit Customer', 'token-mu')`,
        [CUSTOMER],
      );
      await query(
        `insert into orders (id, customer_id, week_of, fulfillment_type, status)
         values ($1, $2, '2026-05-11', 'delivery', 'new')`,
        [ORDER, CUSTOMER],
      );
    });

    it("auto-fills product_unit_id from the product's default unit", async () => {
      await query(
        `insert into product_units (product_id, label, conversion_to_base, unit_price_cents, is_active, slug)
         values ($1, 'each', 1.0, 250, true, 'test-multi-unit-item-eeeeeeee')`,
        [PRODUCT],
      );
      // Insert WITHOUT product_unit_id; the trigger should inherit it.
      await query(
        `insert into order_items (order_id, product_id, qty, unit_price_cents)
         values ($1, $2, 2, 250)`,
        [ORDER, PRODUCT],
      );

      const rows = await query<{
        product_unit_id: string | null;
        unit_product_id: string;
      }>(
        `select oi.product_unit_id, pu.product_id as unit_product_id
           from order_items oi
           join product_units pu on pu.id = oi.product_unit_id
          where oi.order_id = $1`,
        [ORDER],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].product_unit_id).not.toBeNull();
      // The auto-filled unit belongs to the right product.
      expect(rows[0].unit_product_id).toBe(PRODUCT);
    });

    it("skips inactive units — only an is_active unit is inherited", async () => {
      // Inactive unit sorts FIRST; without the is_active filter it would win.
      await query(
        `insert into product_units (product_id, label, conversion_to_base, unit_price_cents, is_active, sort_order, slug)
         values ($1, 'inactive-unit', 0.5, 500, false, 1, 'test-multi-unit-item-inactive')`,
        [PRODUCT],
      );
      await query(
        `insert into product_units (product_id, label, conversion_to_base, unit_price_cents, is_active, sort_order, slug)
         values ($1, 'each', 1.0, 250, true, 5, 'test-multi-unit-item-each')`,
        [PRODUCT],
      );
      await query(
        `insert into order_items (order_id, product_id, qty, unit_price_cents)
         values ($1, $2, 2, 250)`,
        [ORDER, PRODUCT],
      );

      const rows = await query<{ label: string; is_active: boolean }>(
        `select pu.label, pu.is_active
           from order_items oi
           join product_units pu on pu.id = oi.product_unit_id
          where oi.order_id = $1`,
        [ORDER],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].is_active).toBe(true);
      expect(rows[0].label).toBe("each");
    });
  });

  // ── Fractional qty_available ────────────────────────────────────────────
  describe("qty_available", () => {
    beforeEach(async () => {
      await resetData();
      await query(
        `insert into products (id, name, qty_available, is_available)
         values ($1, 'Fractional Item', 7, true)`,
        [PRODUCT],
      );
    });

    it("stores fractional values (3.5)", async () => {
      await query(`update products set qty_available = 3.5 where id = $1`, [
        PRODUCT,
      ]);
      const rows = await query<{ qty_available: number }>(
        `select qty_available from products where id = $1`,
        [PRODUCT],
      );
      // NUMERIC → JS number via the pg parser in src/lib/db.
      expect(rows[0].qty_available).toBe(3.5);
    });
  });

  // ── Cascade delete ──────────────────────────────────────────────────────
  describe("cascade delete", () => {
    beforeEach(async () => {
      await resetData();
      await query(
        `insert into products (id, name, qty_available, is_available)
         values ($1, 'Cascade Item', 7, true)`,
        [PRODUCT],
      );
      await query(
        `insert into product_units (product_id, label, conversion_to_base, unit_price_cents, is_active, slug)
         values ($1, 'each', 1.0, 250, true, 'cascade-item-each')`,
        [PRODUCT],
      );
    });

    it("deleting a product cascades to its product_units rows", async () => {
      await query(`delete from products where id = $1`, [PRODUCT]);
      const rows = await query<{ n: number }>(
        `select count(*)::int as n from product_units where product_id = $1`,
        [PRODUCT],
      );
      expect(rows[0].n).toBe(0);
    });
  });
});
