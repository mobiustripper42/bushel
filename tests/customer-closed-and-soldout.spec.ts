import { test, expect } from "@playwright/test";
import {
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  customerOrderUrl,
  resetCustomerOrderState,
  restoreProductQty,
  setAllProductsSoldOut,
  setOrderingOpen,
  setProductQty,
} from "./helpers";

// Phase 3.7 / DEC-031 — closed-state + all-sold-out empty state + per-item
// sold-out filtering. Per-item sold-out is also exercised by the existing
// order-form spec; this file owns the page-level state transitions.

test.describe("/c/[token] state — closed + all sold out (DEC-031)", () => {
  test.beforeEach(async () => {
    await resetCustomerOrderState();
  });

  test.afterEach(async () => {
    // Failure mid-test could leave is_open=false or qty=0 — other specs
    // would then see ClosedShell / AllSoldOutShell and fail. Reset hard.
    await resetCustomerOrderState();
  });

  test("closed state: ordering_schedule.is_open=false hides the form", async ({ page }) => {
    await setOrderingOpen(false);

    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

    await expect(
      page.getByRole("heading", { name: /Orders are closed this week/i }),
    ).toBeVisible();
    await expect(page.getByText(/Test Farm Stand/)).toBeVisible();
    await expect(page.locator(".inv")).toHaveCount(0);
    await expect(page.locator(".submit-btn")).toHaveCount(0);
    await expect(page.locator(".sticky-bar")).toHaveCount(0);
  });

  test("all sold out: every product qty_available=0 renders the empty state", async ({ page }) => {
    // Snapshot + restore needed because the dev DB may carry non-test products
    // with their own qty_available values. resetCustomerOrderState only knows
    // about TEST_PRODUCTS — anything else we touch we have to clean up here.
    const snapshot = await setAllProductsSoldOut();
    try {
      await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

      await expect(
        page.getByRole("heading", { name: /Everything is sold out/i }),
      ).toBeVisible();
      await expect(page.locator(".inv")).toHaveCount(0);
      await expect(page.locator(".submit-btn")).toHaveCount(0);
    } finally {
      await restoreProductQty(snapshot);
    }
  });

  test("per-item sold out: one product qty=0 greys that row but leaves the form", async ({ page }) => {
    // kale is in TEST_PRODUCTS, so resetCustomerOrderState in afterEach
    // restores it. No snapshot needed.
    await setProductQty(TEST_PRODUCTS.kale.id, 0);

    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

    const kaleRow = page.locator(".item-row", { hasText: TEST_PRODUCTS.kale.name });
    await expect(kaleRow).toHaveClass(/is-sold-out/);
    await expect(kaleRow.getByText("Sold out")).toBeVisible();
    await expect(kaleRow.getByRole("button", { name: "increase" })).toBeDisabled();

    // Other rows + form remain interactive.
    const eggsRow = page.locator(".item-row", { hasText: TEST_PRODUCTS.eggs.name });
    await expect(eggsRow).not.toHaveClass(/is-sold-out/);
    await eggsRow.getByRole("button", { name: "increase" }).click();
    await expect(eggsRow.locator(".stepper-val")).toHaveValue("1");
  });

  test("closed mid-order race: page loaded open, schedule flips closed, submit still succeeds (DEC-031 soft hint)", async ({ page }) => {
    // Customer loads the open page.
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    const eggsRow = page.locator(".item-row", { hasText: TEST_PRODUCTS.eggs.name });
    await eggsRow.getByRole("button", { name: "increase" }).click();

    // Annabel closes the store while the customer is filling the form.
    await setOrderingOpen(false);

    // Submit goes through — the closed toggle is a UI hint, not enforcement.
    // DEC-012's optimistic placement still owns the decision at submit time.
    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);
    await expect(
      page.getByRole("heading", { name: /Order received/i }),
    ).toBeVisible();
  });
});
