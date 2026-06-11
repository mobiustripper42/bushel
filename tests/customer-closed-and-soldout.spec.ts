import { test, expect } from "@playwright/test";
import {
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  customerOrderUrl,
  resetCustomerOrderState,
  restoreProductQty,
  setAllProductsSoldOut,
  setOrderingOpen,
  setProductActive,
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

  // #207 — a hidden product (is_active=false) is gone from the customer form
  // entirely, regardless of is_available/qty. Distinct from sold-out, which
  // still renders the row greyed.
  test("hidden product: is_active=false excludes the row from the customer form", async ({ page }) => {
    try {
      await setProductActive(TEST_PRODUCTS.honey.id, false);

      await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

      // Honey is absent — not greyed, not present at all.
      await expect(page.locator(".item-row", { hasText: TEST_PRODUCTS.honey.name })).toHaveCount(0);
      // Other products still render and the form is interactive.
      const kaleRow = page.locator(".item-row", { hasText: TEST_PRODUCTS.kale.name });
      await expect(kaleRow).toBeVisible();
    } finally {
      await setProductActive(TEST_PRODUCTS.honey.id, true);
    }
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

  // #132 / DEC-036 — the inverse of the closed-race above. DEC-012 optimism
  // lets a customer oversell the "last few" (qty>0), but it does NOT extend to
  // a product that is already at qty=0. A stale tab (loaded with stock →
  // inventory hit 0 → submit) must be rejected, not driven negative.
  test("sold-out mid-order race: product hits qty=0 after load, submit is rejected (DEC-036)", async ({ page }) => {
    // Customer loads with stock and adds eggs.
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    const eggsRow = page.locator(".item-row", { hasText: TEST_PRODUCTS.eggs.name });
    await eggsRow.getByRole("button", { name: "increase" }).click();

    // Eggs sell out under them (admin edit or another customer's order).
    await setProductQty(TEST_PRODUCTS.eggs.id, 0);

    // Submit is rejected — no redirect, friendly error, order not created.
    await page.locator(".submit-btn").click();
    await expect(page.locator(".submit-error")).toContainText(/sold out/i);
    await expect(page).toHaveURL(/\/c\/[^/]+$/);
  });
});
