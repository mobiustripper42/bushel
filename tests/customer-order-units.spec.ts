import { test, expect } from "@playwright/test";
import { weekOfMondayNY } from "@/lib/week";
import {
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  admin,
  customerOrderUrl,
  resetCustomerOrderState,
  resetProductUnits,
  setProductUnits,
  setProductQty,
} from "./helpers";

// 6.5c — Customer order form: per-product unit picker (#153). Kale is set up
// as a two-unit product (bunch base + pound at 2× conversion). Eggs stays
// single-unit so single-unit regression assertions have a known-good row.

const KALE = TEST_PRODUCTS.kale;
const EGGS = TEST_PRODUCTS.eggs;

const KALE_BUNCH_PRICE = KALE.price_cents;       // 300 — base unit
const KALE_LB_PRICE = 500;                       // 1 lb sells for $5.00
const KALE_LB_CONV = 2;                          // 1 lb = 2 base bunches

function kaleRow(page: import("@playwright/test").Page) {
  return page.locator(".item-row", { hasText: KALE.name });
}
function eggsRow(page: import("@playwright/test").Page) {
  return page.locator(".item-row", { hasText: EGGS.name });
}

test.describe("/c/[token] · per-product unit picker", () => {
  test.beforeEach(async () => {
    await resetCustomerOrderState();
    await setProductUnits(KALE.id, [
      { label: KALE.unit, conversion_to_base: 1, unit_price_cents: KALE_BUNCH_PRICE },
      { label: "lb", conversion_to_base: KALE_LB_CONV, unit_price_cents: KALE_LB_PRICE },
    ]);
  });

  test.afterEach(async () => {
    await resetProductUnits(KALE.id, KALE_BUNCH_PRICE, KALE.unit);
  });

  test("multi-unit row renders a picker with both options; single-unit row has none", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

    const picker = kaleRow(page).locator(".unit-picker");
    await expect(picker).toBeVisible();
    await expect(picker.locator("label.unit-option")).toHaveCount(2);
    await expect(picker.locator("label.unit-option").filter({ hasText: KALE.unit })).toBeVisible();
    await expect(picker.locator("label.unit-option").filter({ hasText: "lb" })).toBeVisible();

    // Single-unit Eggs row has no picker.
    await expect(eggsRow(page).locator(".unit-picker")).toHaveCount(0);
  });

  test("switching unit resets qty to 0 and price + meta track the selected unit", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

    const row = kaleRow(page);
    const stepperInput = row.locator(".stepper-val");
    const price = row.locator(".item-price .mono");
    const perLabel = row.locator(".item-per");

    // Default to base unit (bunch).
    await expect(price).toHaveText("$3.00");
    await expect(perLabel).toContainText(KALE.unit);

    // Bump qty to 3 in the base unit.
    await row.getByRole("button", { name: "increase" }).click();
    await row.getByRole("button", { name: "increase" }).click();
    await row.getByRole("button", { name: "increase" }).click();
    await expect(stepperInput).toHaveValue("3");

    // Switch to lb — qty resets, price + meta unit follow the selection.
    await row.locator("label.unit-option").filter({ hasText: "lb" }).click();
    await expect(stepperInput).toHaveValue("0");
    await expect(price).toHaveText("$5.00");
    await expect(perLabel).toContainText("lb");
  });

  test("order-box line amount uses the selected unit's price, not the base", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

    const row = kaleRow(page);
    // Pick lb ($5.00/lb) and order 2 lb.
    await row.locator("label.unit-option").filter({ hasText: "lb" }).click();
    await row.getByRole("button", { name: "increase" }).click();
    await row.getByRole("button", { name: "increase" }).click();
    await expect(row.locator(".stepper-val")).toHaveValue("2");

    // The "your order" summary line for Kale must read 2 × $5.00 = $10.00
    // (selected unit price), NOT 2 × base $3.00 = $6.00. Regression guard for
    // the rail/summary line-amount pulling products.price_cents directly.
    const kaleLine = page
      .locator(".submit-summary .rail-list li")
      .filter({ hasText: KALE.name });
    await expect(kaleLine.locator(".rail-amt")).toContainText("10.00");
    await expect(page.locator(".submit-summary .rail-row-total")).toContainText("10.00");
  });

  test("per-unit sold-out: lb radio is disabled when base inventory < 1 lb-conversion", async ({ page }) => {
    // qty_available = 1 bunch is enough for the bunch radio (conv=1) but
    // below the lb conversion (conv=2), so the lb radio must be disabled.
    await setProductQty(KALE.id, 1);

    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

    const row = kaleRow(page);
    const bunchInput = row.locator("label.unit-option").filter({ hasText: KALE.unit }).locator("input");
    const lbInput = row.locator("label.unit-option").filter({ hasText: "lb" }).locator("input");

    await expect(bunchInput).toBeEnabled();
    await expect(lbInput).toBeDisabled();
    await expect(
      row.locator("label.unit-option").filter({ hasText: "lb" })
    ).toHaveClass(/is-disabled/);
  });

  test("single-unit row stepper still works (regression for non-multi products)", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

    const row = eggsRow(page);
    await row.getByRole("button", { name: "increase" }).click();
    await row.getByRole("button", { name: "increase" }).click();
    await expect(row.locator(".stepper-val")).toHaveValue("2");

    // 2 × $6.00 = $12.00 — sticky/summary totals reflect Eggs only.
    await expect(page.locator(".submit-summary .rail-row-total")).toContainText("12.00");
  });

  test("submit payload records selected unit's price + id + fractional decrement (6.5d contract)", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

    const row = kaleRow(page);
    // Switch to lb (price $5.00, conv=2) and order 2 lb.
    await row.locator("label.unit-option").filter({ hasText: "lb" }).click();
    await row.getByRole("button", { name: "increase" }).click();
    await row.getByRole("button", { name: "increase" }).click();
    await expect(row.locator(".stepper-val")).toHaveValue("2");

    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    const sb = admin();
    const { data: customer } = await sb
      .from("customers")
      .select("id")
      .eq("token", TEST_CUSTOMERS.farmStand.token)
      .single();
    const { data: order } = await sb
      .from("orders")
      .select("id")
      .eq("customer_id", customer!.id)
      .eq("week_of", weekOfMondayNY())
      .single();
    const { data: lineItem } = await sb
      .from("order_items")
      .select("qty, unit_price_cents, product_unit_id, product_units(label)")
      .eq("order_id", order!.id)
      .eq("product_id", KALE.id)
      .single();

    // 6.5d: order_items.unit_price_cents pulled from product_units at RPC
    // time, product_unit_id matches the lb row (not the bunch fallback),
    // and qty stays in selected-unit units.
    expect(lineItem?.unit_price_cents).toBe(KALE_LB_PRICE);
    expect(lineItem?.qty).toBe(2);
    expect(
      (lineItem as unknown as { product_units: { label: string } })
        ?.product_units?.label,
    ).toBe("lb");

    // qty_available decremented by qty * conversion_to_base.
    const { data: kale } = await sb
      .from("products")
      .select("qty_available")
      .eq("id", KALE.id)
      .single();
    expect(Number(kale?.qty_available)).toBeCloseTo(
      KALE.qty_available - 2 * KALE_LB_CONV,
      2,
    );
  });

  test("long product name is fully visible at 375px (resolves #144)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Wrap behavior is mobile-viewport-specific.");
    // Temporarily rename Kale to a long name to exercise the wrap path.
    const sb = (await import("./helpers")).admin();
    const longName = "Heirloom Tuscan dinosaur kale (extra long name)";
    await sb.from("products").update({ name: longName }).eq("id", KALE.id);
    try {
      await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

      const row = page.locator(".item-row", { hasText: longName });
      const name = row.locator(".item-name");
      await expect(name).toBeVisible();

      // Two assertions: the rendered text matches exactly (no CSS truncation),
      // and the box height exceeds a single line — proves it wrapped instead
      // of clipping with text-overflow: ellipsis.
      await expect(name).toHaveText(longName);
      const lineCount = await name.evaluate((el) => {
        const lh = parseFloat(getComputedStyle(el).lineHeight);
        return Math.round(el.getBoundingClientRect().height / lh);
      });
      expect(lineCount).toBeGreaterThan(1);
    } finally {
      await sb.from("products").update({ name: KALE.name }).eq("id", KALE.id);
    }
  });
});
