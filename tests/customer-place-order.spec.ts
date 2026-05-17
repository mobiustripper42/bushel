import { test, expect, type Page } from "@playwright/test";
import { weekOfMondayNY } from "@/lib/week";
import {
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  admin,
  customerOrderUrl,
  resetCustomerOrderState,
} from "./helpers";

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
    await resetCustomerOrderState();
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
      .eq("week_of", weekOfMondayNY())
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
      .eq("week_of", weekOfMondayNY())
      .single();
    expect(order?.needs_reconciliation).toBe(true);

    const { data: eggs } = await sb
      .from("products")
      .select("qty_available")
      .eq("id", TEST_PRODUCTS.eggs.id)
      .single();
    expect(eggs?.qty_available).toBe(-4);
  });

  test("revisiting /c/[token] after submit redirects to /confirmed (no empty form)", async ({
    page,
  }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await stepUp(page, TEST_PRODUCTS.kale.name, 1);
    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    // The link is "your weekly order" — revisiting after submit must NOT
    // re-show the empty form. The page-level redirect handles this; without
    // it, a curious customer would see the form again and either re-tap
    // (the RPC's ON CONFLICT catches that) or be confused.
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);
    await expect(
      page.getByRole("heading", { name: /Order received/i }),
    ).toBeVisible();
    await expect(page.locator(".confirm-list")).toContainText(
      TEST_PRODUCTS.kale.name,
    );

    // And exactly one orders row exists for the current week — no duplicate.
    // (Filtered to this week so the global-setup prior-order fixture
    // doesn't inflate the count.)
    const farmStandId = await getCustomerId(TEST_CUSTOMERS.farmStand.token);
    const sb = admin();
    const { data: orders } = await sb
      .from("orders")
      .select("id")
      .eq("customer_id", farmStandId)
      .eq("week_of", weekOfMondayNY());
    expect(orders).toHaveLength(1);
  });
});
