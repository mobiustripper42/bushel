import { test, expect, type Page } from "@playwright/test";
import {
  ADMIN_STORAGE_STATE,
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  admin,
} from "./helpers";

function rowByName(page: Page, name: string) {
  return page.locator(`tr[data-row-name="${name}"]`);
}

// Fixed UUIDs so the seed is idempotent across re-runs.
const LAST_WEEK_ORDER_ID = "eeeeeeee-0000-0000-0000-000000000001";
const LAST_WEEK_ORDER_ITEM_ID = "ffffffff-0000-0000-0000-000000000001";
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
    await supabase.from("orders").delete().eq("id", LAST_WEEK_ORDER_ID);
    // Reset Kale qty back to the canonical seed value
    await supabase
      .from("products")
      .update({ qty_available: TEST_PRODUCTS.kale.qty_available })
      .eq("id", TEST_PRODUCTS.kale.id);
  });

  test("button restores last week's ordered qty onto current inventory", async ({ page }) => {
    await page.goto("/admin/inventory");

    const kaleQty = rowByName(page, TEST_PRODUCTS.kale.name).getByRole("spinbutton", { name: /quantity/i });
    await expect(kaleQty).toHaveValue("0");

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /pre-populate from last week/i }).click();

    await expect(page.getByText(/restored qty on/i)).toBeVisible();

    await page.reload();
    await expect(rowByName(page, TEST_PRODUCTS.kale.name).getByRole("spinbutton", { name: /quantity/i }))
      .toHaveValue(String(LAST_WEEK_QTY));
  });

  test("cancelling the confirm dialog is a no-op", async ({ page }) => {
    await page.goto("/admin/inventory");
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: /pre-populate from last week/i }).click();
    await expect(rowByName(page, TEST_PRODUCTS.kale.name).getByRole("spinbutton", { name: /quantity/i })).toHaveValue("0");
  });
});
