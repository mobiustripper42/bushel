import { query } from "@/lib/db";
import { weekOfMondayNY } from "@/lib/week";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

export const ADMIN_STORAGE_STATE = "playwright/.auth/admin.json";

export function customerOrderUrl(token: string): string {
  return `${BASE_URL}/c/${token}`;
}

// Admin session is pre-loaded via storageState from global-setup.ts.
// Use `test.use({ storageState: ADMIN_STORAGE_STATE })` in authenticated test blocks.

export const TEST_CUSTOMERS = {
  farmStand: {
    name: "Test Farm Stand",
    token: "testtoken-farmstand-0001",
  },
  restaurant: {
    name: "Test Restaurant",
    token: "testtoken-restaurant-0001",
  },
} as const;

// `unit` / `price_cents` describe each product's seeded BASE product_units row
// (conversion_to_base = 1) — DEC-037 dropped the products-table columns.
export const TEST_PRODUCTS = {
  kale:  { id: "cccccccc-0000-0000-0000-000000000001", name: "Kale",  unit: "bunch", price_cents: 300,  qty_available: 10 },
  eggs:  { id: "cccccccc-0000-0000-0000-000000000002", name: "Eggs",  unit: "dozen", price_cents: 600,  qty_available: 5  },
  honey: { id: "cccccccc-0000-0000-0000-000000000003", name: "Honey", unit: "jar",   price_cents: 1200, qty_available: 8  },
} as const;

// Test DB access goes through the same pg pool as the app (src/lib/db.ts) —
// DATABASE_URL must point both at the same database (docker compose service
// locally, the postgres service container in CI).

// Resolves the two seeded test customers' UUIDs by token. Used by every spec
// that needs to query orders/sends/etc. scoped to the test fixtures.
export async function customerIds(): Promise<{ farmStand: string; restaurant: string }> {
  const rows = await query<{ id: string; token: string }>(
    `select id, token from customers where token = any($1)`,
    [[TEST_CUSTOMERS.farmStand.token, TEST_CUSTOMERS.restaurant.token]],
  );
  const map = new Map(rows.map((r) => [r.token, r.id]));
  const farmStand = map.get(TEST_CUSTOMERS.farmStand.token);
  const restaurant = map.get(TEST_CUSTOMERS.restaurant.token);
  if (!farmStand || !restaurant) throw new Error("customerIds: seeded customers missing");
  return { farmStand, restaurant };
}

// Deletes orders for the two seeded test customers in a given NY-week-Monday.
// Caller passes the week explicitly (use `weekOfMondayNY()` from @/lib/week
// for the current week).
export async function clearOrdersForWeek(weekOf: string): Promise<void> {
  const ids = await customerIds();
  await query(
    `delete from orders where customer_id = any($1) and week_of = $2`,
    [[ids.farmStand, ids.restaurant], weekOf],
  );
}

// Inserts an order + its line items for a seeded test customer. Union of the
// shapes used across admin-orders, admin-orders-export, and orders-flow specs
// (status, needsReconciliation are optional so any caller can omit them).
export type SeedOrderInput = {
  customerId: string;
  weekOf: string;
  fulfillmentType: "pickup" | "delivery";
  status?: "new" | "confirmed" | "ready" | "picked_up" | "delivered";
  needsReconciliation?: boolean;
  // Opt-in for delivery orders. Defaults to null — matches admin-orders-export
  // and orders-flow specs' pre-refactor behavior. admin-orders.spec passes
  // "Front door" explicitly where it needs the field populated.
  deliveryPreference?: string | null;
  items: Array<{ productId: string; qty: number; unitPriceCents: number }>;
};
export async function seedOrder(input: SeedOrderInput): Promise<string> {
  const orderRows = await query<{ id: string }>(
    `insert into orders
       (customer_id, week_of, fulfillment_type, delivery_address,
        delivery_preference, status, needs_reconciliation)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [
      input.customerId,
      input.weekOf,
      input.fulfillmentType,
      input.fulfillmentType === "delivery" ? "123 Test St" : null,
      input.fulfillmentType === "delivery" ? (input.deliveryPreference ?? null) : null,
      input.status ?? "new",
      input.needsReconciliation ?? false,
    ],
  );
  const orderId = orderRows[0].id;

  // product_unit_id omitted — the order_items_default_unit BEFORE-INSERT
  // trigger fills the product's base unit, same as before.
  for (const i of input.items) {
    await query(
      `insert into order_items (order_id, product_id, qty, unit_price_cents)
       values ($1, $2, $3, $4)`,
      [orderId, i.productId, i.qty, i.unitPriceCents],
    );
  }
  return orderId;
}

// Clears the seeded test customers' current-NY-week orders AND any open
// (non-terminal) order regardless of week, then restores
// products.qty_available to the seed values. Used by customer-side spec
// beforeEach hooks so spec ordering can't leak state — /c/[token] renders
// an open order as a pre-populated add-mode form (DEC-041), so any leftover
// open order from a prior spec breaks fresh-form tests that come after it,
// and the partial unique index makes a leaked open row block seedOrder.
//
// Terminal orders outside the current week are preserved deliberately —
// the global-setup fixture (a delivered 2026-04-27 prior order used to
// assert delivery_preference prefill) must survive.
export async function resetCustomerOrderState(): Promise<void> {
  const currentWeek = weekOfMondayNY();
  for (const c of Object.values(TEST_CUSTOMERS)) {
    await query(
      `delete from orders
        where customer_id = (select id from customers where token = $1)
          and (week_of = $2 or status in ('new', 'confirmed', 'ready'))`,
      [c.token, currentWeek],
    );
  }
  for (const p of Object.values(TEST_PRODUCTS)) {
    await query(`update products set qty_available = $1 where id = $2`, [
      p.qty_available,
      p.id,
    ]);
  }
  // Phase 3.7 tests can flip is_open=false; restoring here means specs that
  // run after them still see the open form.
  await query(
    `update ordering_schedule set is_open = true where is_singleton = true`,
  );
}

// Toggles the singleton ordering_schedule row's is_open flag for Phase 3.7
// state tests. The schedule table has a single row by design; updating any
// row updates the schedule.
export async function setOrderingOpen(open: boolean): Promise<void> {
  await query(
    `update ordering_schedule set is_open = $1 where is_singleton = true`,
    [open],
  );
}

// Reset TEST_PRODUCTS sort_order back to seeded values (kale=1, eggs=2,
// honey=3). Use in a try/finally around drag-reorder specs so a mid-test
// failure can't poison the order other specs see. Global setup already
// upserts these values, but it only runs once per playwright invocation —
// in-run leakage needs this finer-grained reset.
export async function resetProductSortOrder(): Promise<void> {
  const seeded: Array<{ id: string; sort_order: number }> = [
    { id: TEST_PRODUCTS.kale.id,  sort_order: 1 },
    { id: TEST_PRODUCTS.eggs.id,  sort_order: 2 },
    { id: TEST_PRODUCTS.honey.id, sort_order: 3 },
  ];
  for (const row of seeded) {
    await query(`update products set sort_order = $1 where id = $2`, [
      row.sort_order,
      row.id,
    ]);
  }
}

// #207 — products are soft-hidden (is_active=false) from the UI, never
// hard-deleted, so a test that adds a throwaway product can't clean up through
// the editor. This removes it at the DB level for test isolation.
export async function deleteProductByName(name: string): Promise<void> {
  await query(`delete from products where name = $1`, [name]);
}

// #207 — flip a product's soft-delete flag. Hidden products (is_active=false)
// drop out of the customer order form and the default admin view.
export async function setProductActive(id: string, active: boolean): Promise<void> {
  await query(`update products set is_active = $1 where id = $2`, [active, id]);
}

// Patches the singleton ordering_schedule row. Pass only the fields you want
// to change. Used by the inventory meta-pill tests to walk all three open
// states (closed / open manual / open via schedule).
export async function setOrderingSchedule(patch: {
  is_open?: boolean;
  weekly_open_day?: number | null;
  weekly_open_time?: string | null;
  weekly_close_day?: number | null;
  weekly_close_time?: string | null;
}): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    params.push(value);
    sets.push(`${key} = $${params.length}`);
  }
  if (sets.length === 0) return;
  await query(
    `update ordering_schedule set ${sets.join(", ")} where is_singleton = true`,
    params,
  );
}

// Drops every is_available=true product to qty_available = 0 — exercises
// DEC-031's "everything sold out" empty state. The dev DB usually contains
// products beyond TEST_PRODUCTS (real seed data), so zeroing only the test
// rows leaves the page able to render any non-test row. Snapshot returned so
// the spec can restore.
//
// TOCTOU caveat: snapshot SELECT and zero-out UPDATE are two statements. A
// concurrent insert between them would be zeroed but not in the snapshot,
// so cleanup misses it. Acceptable in the solo phase; revisit if multiple
// devs run tests against the same dev DB in parallel.
export type ProductQtySnapshot = Array<{ id: string; qty_available: number }>;
export async function setAllProductsSoldOut(): Promise<ProductQtySnapshot> {
  const snapshot = await query<{ id: string; qty_available: number }>(
    `select id, qty_available from products where is_available = true`,
  );
  await query(
    `update products set qty_available = 0 where is_available = true`,
  );
  return snapshot;
}

export async function restoreProductQty(snapshot: ProductQtySnapshot): Promise<void> {
  for (const row of snapshot) {
    await query(`update products set qty_available = $1 where id = $2`, [
      row.qty_available,
      row.id,
    ]);
  }
}

// Sets a single product's qty_available. Tests that mutate one product (e.g.
// per-item sold-out) call this; cleanup is via resetCustomerOrderState in
// afterEach, which only knows about TEST_PRODUCTS — pass an id in that set.
export async function setProductQty(id: string, qty: number): Promise<void> {
  await query(`update products set qty_available = $1 where id = $2`, [qty, id]);
}

// Resets a product's units to a single base row: label = baseLabel, conv = 1,
// price = basePriceCents, active = true, slug = "<name-slug>-<id8>" (the
// saveInventory/backfill format). DEC-037 dropped products.unit, so the base
// label is the caller's to supply (TEST_PRODUCTS carries the seeded values).
// Deletes every existing product_units row first to clear any leaked
// slug/label drift from a prior failed test run, then re-inserts a fresh
// base row. Used by beforeEach/afterEach in units-drawer specs.
export async function resetProductUnits(
  productId: string,
  basePriceCents: number,
  baseLabel: string,
): Promise<void> {
  const products = await query<{ name: string }>(
    `select name from products where id = $1`,
    [productId],
  );
  const product = products[0];
  if (!product) return;

  // order_items.product_unit_id is ON DELETE RESTRICT — line items placed
  // against these units during the test must go first. (The supabase-era
  // helper silently swallowed this FK error and no-op'd until the next
  // resetCustomerOrderState cleared the orders; pg throws, so clean up the
  // dependents explicitly. The affected orders are this spec's own fixtures
  // and get deleted by the next reset anyway.)
  await query(
    `delete from order_items
      where product_unit_id in (select id from product_units where product_id = $1)`,
    [productId],
  );

  // Non-atomic: a concurrent reader between delete + insert would observe
  // zero units for this product. Relies on Playwright's workers=1 config.
  await query(`delete from product_units where product_id = $1`, [productId]);

  const nameSlug = product.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const id8 = productId.slice(0, 8);

  await query(
    `insert into product_units
       (product_id, label, conversion_to_base, unit_price_cents, is_active, slug)
     values ($1, $2, 1, $3, true, $4)`,
    [productId, baseLabel, basePriceCents, `${nameSlug}-${id8}`],
  );
}

// Replaces a product's entire unit set in one call. The list is interpreted as
// the desired post-state; existing units are wiped first to avoid label/slug
// collisions. Units are inserted in array order so `sort_order` follows the
// caller's intent. Use this in beforeEach to set up a multi-unit fixture; pair
// with `resetProductUnits` in afterEach to restore the single-base default.
export type UnitSeed = {
  label: string;
  conversion_to_base: number;
  unit_price_cents: number;
  is_active?: boolean;
};
export async function setProductUnits(
  productId: string,
  units: UnitSeed[],
): Promise<void> {
  const products = await query<{ name: string }>(
    `select name from products where id = $1`,
    [productId],
  );
  const product = products[0];
  if (!product) return;

  // Same FK-dependent cleanup as resetProductUnits (see comment there).
  await query(
    `delete from order_items
      where product_unit_id in (select id from product_units where product_id = $1)`,
    [productId],
  );
  await query(`delete from product_units where product_id = $1`, [productId]);

  const nameSlug = product.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const id8 = productId.slice(0, 8);

  for (const [idx, u] of units.entries()) {
    const labelSlug = u.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    await query(
      `insert into product_units
         (product_id, label, conversion_to_base, unit_price_cents, is_active,
          sort_order, slug)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        productId,
        u.label,
        u.conversion_to_base,
        u.unit_price_cents,
        u.is_active ?? true,
        idx,
        `${nameSlug}-${labelSlug}-${id8}`,
      ],
    );
  }
}
