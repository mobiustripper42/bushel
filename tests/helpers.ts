import { createClient } from "@supabase/supabase-js";
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

export const TEST_PRODUCTS = {
  kale:  { id: "cccccccc-0000-0000-0000-000000000001", name: "Kale",  unit: "bunch", price_cents: 300,  qty_available: 10 },
  eggs:  { id: "cccccccc-0000-0000-0000-000000000002", name: "Eggs",  unit: "dozen", price_cents: 600,  qty_available: 5  },
  honey: { id: "cccccccc-0000-0000-0000-000000000003", name: "Honey", unit: "jar",   price_cents: 1200, qty_available: 8  },
} as const;

// Lazy admin Supabase client — only constructed when a test calls it.
// Exported as both `admin` (the common shorthand used in admin-side specs)
// and `adminClient` (the name customer-side specs picked up). Same function;
// two names so the Phase 6.8 consolidation didn't churn every existing call.
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
export { admin as adminClient };

// Resolves the two seeded test customers' UUIDs by token. Used by every spec
// that needs to query orders/sends/etc. scoped to the test fixtures.
export async function customerIds(): Promise<{ farmStand: string; restaurant: string }> {
  const sb = admin();
  const { data, error } = await sb
    .from("customers")
    .select("id, token")
    .in("token", [TEST_CUSTOMERS.farmStand.token, TEST_CUSTOMERS.restaurant.token]);
  if (error || !data) throw new Error(`customerIds: ${error?.message ?? "no rows"}`);
  const map = new Map(data.map((r) => [r.token, r.id]));
  return {
    farmStand: map.get(TEST_CUSTOMERS.farmStand.token)!,
    restaurant: map.get(TEST_CUSTOMERS.restaurant.token)!,
  };
}
// admin-send + notifications-flow specs settled on `testCustomerIds`; alias
// rather than churn every call site.
export { customerIds as testCustomerIds };

// Deletes orders for the two seeded test customers in a given NY-week-Monday.
// Caller passes the week explicitly (use `weekOfMondayNY()` from @/lib/week
// for the current week). admin-orders + admin-orders-export specs called
// this `clearWeek`; alias preserved for the same reason.
export async function clearOrdersForWeek(weekOf: string): Promise<void> {
  const sb = admin();
  const ids = await customerIds();
  await sb
    .from("orders")
    .delete()
    .in("customer_id", [ids.farmStand, ids.restaurant])
    .eq("week_of", weekOf);
}
export { clearOrdersForWeek as clearWeek };

// Inserts an order + its line items for a seeded test customer. Union of the
// shapes used across admin-orders, admin-orders-export, and orders-flow specs
// (status, needsReconciliation are optional so any caller can omit them).
export type SeedOrderInput = {
  customerId: string;
  weekOf: string;
  fulfillmentType: "pickup" | "delivery";
  status?: "new" | "ready" | "picked-up" | "delivered";
  needsReconciliation?: boolean;
  // Opt-in for delivery orders. Defaults to null — matches admin-orders-export
  // and orders-flow specs' pre-refactor behavior. admin-orders.spec passes
  // "Front door" explicitly where it needs the field populated.
  deliveryPreference?: string | null;
  items: Array<{ productId: string; qty: number; unitPriceCents: number }>;
};
export async function seedOrder(input: SeedOrderInput): Promise<string> {
  const sb = admin();
  const { data: order, error: oErr } = await sb
    .from("orders")
    .insert({
      customer_id: input.customerId,
      week_of: input.weekOf,
      fulfillment_type: input.fulfillmentType,
      delivery_address:
        input.fulfillmentType === "delivery" ? "123 Test St" : null,
      delivery_preference:
        input.fulfillmentType === "delivery"
          ? (input.deliveryPreference ?? null)
          : null,
      status: input.status ?? "new",
      needs_reconciliation: input.needsReconciliation ?? false,
    })
    .select("id")
    .single();
  if (oErr || !order) throw new Error(`seedOrder: ${oErr?.message}`);

  const rows = input.items.map((i) => ({
    order_id: order.id,
    product_id: i.productId,
    qty: i.qty,
    unit_price_cents: i.unitPriceCents,
  }));
  const { error: iErr } = await sb.from("order_items").insert(rows);
  if (iErr) throw new Error(`seedOrder items: ${iErr.message}`);
  return order.id;
}

// Clears current-NY-week orders for the seeded test customers and restores
// products.qty_available to the seed values. Used by customer-side spec
// beforeEach hooks so spec ordering can't leak state — the redirect on
// /c/[token] now hides the form whenever an order exists for the current
// week, so any leftover order from a prior spec breaks form-interaction
// tests that come after it.
//
// Scoped to the current week deliberately so the global-setup fixture
// (a delivered 2026-04-27 prior order used to assert delivery_preference
// prefill) is preserved.
export async function resetCustomerOrderState(): Promise<void> {
  const sb = admin();
  const currentWeek = weekOfMondayNY();
  for (const c of Object.values(TEST_CUSTOMERS)) {
    const { data } = await sb
      .from("customers")
      .select("id")
      .eq("token", c.token)
      .maybeSingle();
    if (data?.id) {
      await sb
        .from("orders")
        .delete()
        .eq("customer_id", data.id)
        .eq("week_of", currentWeek);
    }
  }
  for (const p of Object.values(TEST_PRODUCTS)) {
    await sb
      .from("products")
      .update({ qty_available: p.qty_available })
      .eq("id", p.id);
  }
  // Phase 3.7 tests can flip is_open=false; restoring here means specs that
  // run after them still see the open form.
  await sb
    .from("ordering_schedule")
    .update({ is_open: true })
    .eq("is_singleton", true);
}

// Toggles the singleton ordering_schedule row's is_open flag for Phase 3.7
// state tests. The schedule table has a single row by design; updating any
// row updates the schedule.
export async function setOrderingOpen(open: boolean): Promise<void> {
  const sb = admin();
  await sb
    .from("ordering_schedule")
    .update({ is_open: open })
    .eq("is_singleton", true);
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
  const sb = admin();
  const { data } = await sb
    .from("products")
    .select("id, qty_available")
    .eq("is_available", true);
  const snapshot: ProductQtySnapshot =
    data?.map((r) => ({ id: r.id, qty_available: r.qty_available })) ?? [];
  await sb
    .from("products")
    .update({ qty_available: 0 })
    .eq("is_available", true);
  return snapshot;
}

export async function restoreProductQty(snapshot: ProductQtySnapshot): Promise<void> {
  const sb = admin();
  for (const row of snapshot) {
    await sb
      .from("products")
      .update({ qty_available: row.qty_available })
      .eq("id", row.id);
  }
}

// Sets a single product's qty_available. Tests that mutate one product (e.g.
// per-item sold-out) call this; cleanup is via resetCustomerOrderState in
// afterEach, which only knows about TEST_PRODUCTS — pass an id in that set.
export async function setProductQty(id: string, qty: number): Promise<void> {
  const sb = admin();
  await sb.from("products").update({ qty_available: qty }).eq("id", id);
}
