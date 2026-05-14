import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  customerOrderUrl,
} from "./helpers";

// We hit Supabase directly to reset the per-customer test state and to read back
// what the action wrote. Tests would otherwise interfere with each other because
// (customer_id, week_of) is unique on orders.
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Wipe any order this customer placed today + restore inventory so each test
// starts from the seed quantities. Cheaper than a full db reset between tests.
async function resetCustomerState(customerId: string) {
  const sb = admin();
  await sb.from("orders").delete().eq("customer_id", customerId);
  for (const p of Object.values(TEST_PRODUCTS)) {
    await sb
      .from("products")
      .update({ qty_available: p.qty_available })
      .eq("id", p.id);
  }
}

async function getCustomerId(token: string): Promise<string> {
  const sb = admin();
  const { data, error } = await sb
    .from("customers")
    .select("id")
    .eq("token", token)
    .single();
  if (error || !data) throw new Error(`Could not resolve customer ${token}`);
  return data.id;
}

// Bumps the stepper on a named product to qty without relying on press-and-hold.
async function stepUp(page: Page, productName: string, qty: number) {
  const row = page.locator(".item-row", { hasText: productName });
  for (let i = 0; i < qty; i++) {
    await row.getByRole("button", { name: "increase" }).click();
  }
}

test.describe("/c/[token] place order", () => {
  test.beforeEach(async () => {
    const farmStandId = await getCustomerId(TEST_CUSTOMERS.farmStand.token);
    const restaurantId = await getCustomerId(TEST_CUSTOMERS.restaurant.token);
    await resetCustomerState(farmStandId);
    await resetCustomerState(restaurantId);
  });

  test("happy path: submit creates an order + decrements inventory, lands on confirmed", async ({
    page,
  }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await stepUp(page, TEST_PRODUCTS.kale.name, 2);
    await stepUp(page, TEST_PRODUCTS.eggs.name, 1);

    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    await expect(
      page.getByRole("heading", { name: /Order received/i }),
    ).toBeVisible();
    await expect(page.locator(".confirm-list")).toContainText(TEST_PRODUCTS.kale.name);
    await expect(page.locator(".confirm-list")).toContainText(TEST_PRODUCTS.eggs.name);
    // 2×$3.00 + 1×$6.00 = $12.00
    await expect(page.locator(".confirm-total")).toContainText("12.00");

    const sb = admin();
    const farmStandId = await getCustomerId(TEST_CUSTOMERS.farmStand.token);
    const { data: order } = await sb
      .from("orders")
      .select("id, needs_reconciliation, fulfillment_type")
      .eq("customer_id", farmStandId)
      .single();
    expect(order?.needs_reconciliation).toBe(false);
    expect(order?.fulfillment_type).toBe("delivery");

    const { data: kale } = await sb
      .from("products")
      .select("qty_available")
      .eq("id", TEST_PRODUCTS.kale.id)
      .single();
    expect(kale?.qty_available).toBe(TEST_PRODUCTS.kale.qty_available - 2);
  });

  test("oversold qty sets needs_reconciliation = true (DEC-012)", async ({
    page,
  }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

    // Type a qty above what's available — clamps at qty_available on blur (10),
    // so we additionally drop seed inventory under their fingertips before submit.
    const eggsRow = page.locator(".item-row", { hasText: TEST_PRODUCTS.eggs.name });
    const eggsInput = eggsRow.locator(".stepper-val");
    await eggsInput.click();
    await eggsInput.press("ControlOrMeta+A");
    await eggsInput.pressSequentially("5"); // max for eggs in seed
    await eggsInput.blur();

    // Sneak in a stock cut so the submit will oversell by 4.
    const sb = admin();
    await sb
      .from("products")
      .update({ qty_available: 1 })
      .eq("id", TEST_PRODUCTS.eggs.id);

    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    const farmStandId = await getCustomerId(TEST_CUSTOMERS.farmStand.token);
    const { data: order } = await sb
      .from("orders")
      .select("needs_reconciliation")
      .eq("customer_id", farmStandId)
      .single();
    expect(order?.needs_reconciliation).toBe(true);

    const { data: eggs } = await sb
      .from("products")
      .select("qty_available")
      .eq("id", TEST_PRODUCTS.eggs.id)
      .single();
    expect(eggs?.qty_available).toBe(-4);
  });

  test("double-submit: second attempt redirects to confirmed without creating a duplicate", async ({
    page,
  }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await stepUp(page, TEST_PRODUCTS.kale.name, 1);
    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    // Navigate back to the order page and try again with different items.
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await stepUp(page, TEST_PRODUCTS.honey.name, 1);
    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    // Only one orders row should exist for the week.
    const farmStandId = await getCustomerId(TEST_CUSTOMERS.farmStand.token);
    const sb = admin();
    const { data: orders } = await sb
      .from("orders")
      .select("id")
      .eq("customer_id", farmStandId);
    expect(orders).toHaveLength(1);

    // The /confirmed page should reflect the FIRST order (kale, not honey),
    // because the function returns the existing order id on the second call.
    await expect(page.locator(".confirm-list")).toContainText(TEST_PRODUCTS.kale.name);
    await expect(page.locator(".confirm-list")).not.toContainText(
      TEST_PRODUCTS.honey.name,
    );
  });
});
