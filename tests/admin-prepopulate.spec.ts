import { test, expect, type Page } from "@playwright/test";
import {
  ADMIN_STORAGE_STATE,
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  admin,
  resetProductUnits,
  setProductUnits,
} from "./helpers";

function rowByName(page: Page, name: string) {
  return page.locator(`tr[data-row-name="${name}"]`);
}

// Fixed UUIDs so the seed is idempotent across re-runs.
const LAST_WEEK_ORDER_ID = "eeeeeeee-0000-0000-0000-000000000001";
const LAST_WEEK_ORDER_ITEM_ID = "ffffffff-0000-0000-0000-000000000001";
const LAST_WEEK_MULTI_ORDER_ID = "eeeeeeee-0000-0000-0000-000000000002";
const LAST_WEEK_QTY = 3;

function lastWeekDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

test.describe("admin inventory — pre-populate from last week", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test.beforeEach(async () => {
    const supabase = admin();

    // Resolve the test farm-stand customer id (seed.sql doesn't fix the UUID)
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("token", TEST_CUSTOMERS.farmStand.token)
      .single();
    if (customerError || !customer) throw new Error(`Test customer lookup failed: ${customerError?.message ?? "not found"}`);

    // Reset Kale to a clean 0 starting state so the assertion is unambiguous
    const { error: resetError } = await supabase
      .from("products")
      .update({ qty_available: 0 })
      .eq("id", TEST_PRODUCTS.kale.id);
    if (resetError) throw new Error(`Kale reset failed: ${resetError.message}`);

    // Clear any prior last-week test fixture (cascades order_items)
    await supabase.from("orders").delete().eq("id", LAST_WEEK_ORDER_ID);

    // Seed one order from last week against Kale, qty=3
    const { error: orderError } = await supabase.from("orders").insert({
      id: LAST_WEEK_ORDER_ID,
      customer_id: customer.id,
      week_of: lastWeekDate(),
      fulfillment_type: "delivery",
      status: "new",
    });
    if (orderError) throw new Error(`Last-week order insert failed: ${orderError.message}`);

    const { error: itemError } = await supabase.from("order_items").insert({
      id: LAST_WEEK_ORDER_ITEM_ID,
      order_id: LAST_WEEK_ORDER_ID,
      product_id: TEST_PRODUCTS.kale.id,
      qty: LAST_WEEK_QTY,
      unit_price_cents: TEST_PRODUCTS.kale.price_cents,
    });
    if (itemError) throw new Error(`Last-week order_item insert failed: ${itemError.message}`);
  });

  test.afterEach(async () => {
    const supabase = admin();
    // Defensive cleanup covers both the single-unit and multi-unit fixture
    // ids in case an inner afterEach throws between order-delete and
    // resetProductUnits. Orders first (cascade order_items), then units —
    // order_items.product_unit_id is ON DELETE RESTRICT, so swapped order
    // would leak a partial state into the next test.
    await supabase
      .from("orders")
      .delete()
      .in("id", [LAST_WEEK_ORDER_ID, LAST_WEEK_MULTI_ORDER_ID]);
    // Pre-populate is now overwrite-only — every product gets its qty
    // set to last-week-ordered-total OR 0. The test only orders against
    // Kale, so Eggs + Honey get zeroed as a side effect; restore them
    // so downstream specs see the seed quantities.
    await supabase
      .from("products")
      .update({ qty_available: TEST_PRODUCTS.kale.qty_available })
      .eq("id", TEST_PRODUCTS.kale.id);
    await supabase
      .from("products")
      .update({ qty_available: TEST_PRODUCTS.eggs.qty_available })
      .eq("id", TEST_PRODUCTS.eggs.id);
    await supabase
      .from("products")
      .update({ qty_available: TEST_PRODUCTS.honey.qty_available })
      .eq("id", TEST_PRODUCTS.honey.id);
    await resetProductUnits(TEST_PRODUCTS.kale.id, TEST_PRODUCTS.kale.price_cents);
  });

  test("button restores last week's ordered qty onto current inventory", async ({ page }) => {
    await page.goto("/admin/inventory");

    const kaleQty = rowByName(page, TEST_PRODUCTS.kale.name).getByRole("textbox", { name: /quantity/i });
    await expect(kaleQty).toHaveValue("0");

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /pre-populate from last week/i }).click();

    await expect(page.getByText(/restored from last week/i)).toBeVisible();

    await page.reload();
    await expect(rowByName(page, TEST_PRODUCTS.kale.name).getByRole("textbox", { name: /quantity/i }))
      .toHaveValue(String(LAST_WEEK_QTY));
  });

  test("cancelling the confirm dialog is a no-op", async ({ page }) => {
    await page.goto("/admin/inventory");
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: /pre-populate from last week/i }).click();
    await expect(rowByName(page, TEST_PRODUCTS.kale.name).getByRole("textbox", { name: /quantity/i })).toHaveValue("0");
  });

  // 6.5e — pre-populate is unit-aware. Builds a multi-unit Kale (bunch base
  // + lb conv=2), seeds last-week orders with both units at snapshot prices
  // different from current, and asserts that after pre-populate (a) qty
  // adds back qty * conversion_to_base and (b) unit prices revert to the
  // last-week snapshot.
  test.describe("multi-unit pre-populate (6.5e)", () => {
    const BUNCH_SNAPSHOT_CENTS = 275; // $2.75 — different from current $3.00
    const LB_SNAPSHOT_CENTS = 450;    // $4.50 — different from current $5.00
    const BUNCH_CURRENT_CENTS = 300;
    const LB_CURRENT_CENTS = 500;
    const LB_CONV = 2;
    const BUNCH_QTY = 2;
    const LB_QTY = 1;
    // 2 * 1 + 1 * 2 = 4 base units restored
    const EXPECTED_RESTORED_QTY = BUNCH_QTY * 1 + LB_QTY * LB_CONV;

    test.beforeEach(async () => {
      const supabase = admin();

      // Defensive cleanup: blow away any prior single-unit OR multi-unit
      // last-week order so setProductUnits can free up Kale's old unit
      // rows. order_items.product_unit_id is ON DELETE RESTRICT, so any
      // residual reference would silently break the unit delete-then-
      // insert (FK violation → unit insert collides on unique label).
      await supabase
        .from("orders")
        .delete()
        .in("id", [LAST_WEEK_ORDER_ID, LAST_WEEK_MULTI_ORDER_ID]);

      // Replace Kale's single base unit with a two-unit set (bunch + lb).
      // Capture the inserted unit ids so we can stamp last-week orders.
      await setProductUnits(TEST_PRODUCTS.kale.id, [
        { label: TEST_PRODUCTS.kale.unit, conversion_to_base: 1, unit_price_cents: BUNCH_CURRENT_CENTS },
        { label: "lb",                    conversion_to_base: LB_CONV, unit_price_cents: LB_CURRENT_CENTS },
      ]);

      const { data: units, error: unitsError } = await supabase
        .from("product_units")
        .select("id, label")
        .eq("product_id", TEST_PRODUCTS.kale.id);
      if (unitsError || !units) throw new Error(`Unit lookup failed: ${unitsError?.message}`);
      const bunchUnit = units.find((u) => u.label === TEST_PRODUCTS.kale.unit);
      const lbUnit = units.find((u) => u.label === "lb");
      if (!bunchUnit || !lbUnit) throw new Error("Multi-unit fixture missing bunch/lb");

      // Resolve test customer + reset Kale qty to a known 0 starting state.
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("token", TEST_CUSTOMERS.farmStand.token)
        .single();
      if (!customer) throw new Error("Test customer not found");

      await supabase.from("products").update({ qty_available: 0 }).eq("id", TEST_PRODUCTS.kale.id);

      await supabase.from("orders").delete().eq("id", LAST_WEEK_MULTI_ORDER_ID);

      // Seed last week's order with two line items, each at a snapshot price
      // that differs from the current unit price.
      await supabase.from("orders").insert({
        id: LAST_WEEK_MULTI_ORDER_ID,
        customer_id: customer.id,
        week_of: lastWeekDate(),
        fulfillment_type: "delivery",
        status: "delivered",
      });

      const { error: itemsError } = await supabase.from("order_items").insert([
        {
          order_id: LAST_WEEK_MULTI_ORDER_ID,
          product_id: TEST_PRODUCTS.kale.id,
          product_unit_id: bunchUnit.id,
          qty: BUNCH_QTY,
          unit_price_cents: BUNCH_SNAPSHOT_CENTS,
        },
        {
          order_id: LAST_WEEK_MULTI_ORDER_ID,
          product_id: TEST_PRODUCTS.kale.id,
          product_unit_id: lbUnit.id,
          qty: LB_QTY,
          unit_price_cents: LB_SNAPSHOT_CENTS,
        },
      ]);
      if (itemsError) throw new Error(`Multi-unit order_items insert failed: ${itemsError.message}`);
    });

    test.afterEach(async () => {
      const supabase = admin();
      await supabase.from("orders").delete().eq("id", LAST_WEEK_MULTI_ORDER_ID);
      // Restore Kale to seed defaults (qty + single base unit).
      await supabase
        .from("products")
        .update({ qty_available: TEST_PRODUCTS.kale.qty_available })
        .eq("id", TEST_PRODUCTS.kale.id);
      await resetProductUnits(TEST_PRODUCTS.kale.id, TEST_PRODUCTS.kale.price_cents);
    });

    test("restores qty unit-aware; unit prices are NOT touched", async ({ page }) => {
      await page.goto("/admin/inventory");

      const qtySpin = rowByName(page, TEST_PRODUCTS.kale.name).getByRole("textbox", { name: /quantity/i });
      await expect(qtySpin).toHaveValue("0");

      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: /pre-populate from last week/i }).click();
      await expect(page.getByText(/restored from last week/i)).toBeVisible();

      // qty_available should be 4 (2 bunch * 1 + 1 lb * 2).
      await page.reload();
      await expect(
        rowByName(page, TEST_PRODUCTS.kale.name).getByRole("textbox", { name: /quantity/i }),
      ).toHaveValue(String(EXPECTED_RESTORED_QTY));

      // Unit prices stay at current values — pre-populate no longer
      // restores prices from last-week snapshots (Annabel decided
      // it's qty-only).
      const supabase = admin();
      const { data: units } = await supabase
        .from("product_units")
        .select("label, unit_price_cents")
        .eq("product_id", TEST_PRODUCTS.kale.id);
      const byLabel = Object.fromEntries(
        (units ?? []).map((u) => [u.label, u.unit_price_cents]),
      );
      expect(byLabel[TEST_PRODUCTS.kale.unit]).toBe(BUNCH_CURRENT_CENTS);
      expect(byLabel["lb"]).toBe(LB_CURRENT_CENTS);
    });
  });
});
