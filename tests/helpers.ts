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
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
  const sb = adminClient();
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
  const sb = adminClient();
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
export type ProductQtySnapshot = Array<{ id: string; qty_available: number }>;
export async function setAllProductsSoldOut(): Promise<ProductQtySnapshot> {
  const sb = adminClient();
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
  const sb = adminClient();
  for (const row of snapshot) {
    await sb
      .from("products")
      .update({ qty_available: row.qty_available })
      .eq("id", row.id);
  }
}
