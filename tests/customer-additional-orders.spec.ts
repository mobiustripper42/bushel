import { test, expect, type Page } from "@playwright/test";
import { weekOfMondayNY } from "@/lib/week";
import {
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  admin,
  customerIds,
  customerOrderUrl,
  resetCustomerOrderState,
  restoreProductQty,
  seedOrder,
  setAllProductsSoldOut,
  setOrderingOpen,
} from "./helpers";

// #211 / DEC-039 — additive orders. A customer with an order for the current
// week can append items to it via the /confirmed hub's "Add to your order"
// button (→ /c/[token]?add=1, the form's ADD MODE). One orders row per
// (customer, week) throughout; appends grow order_items.

// Bumps the stepper on a named product to qty without relying on press-and-hold.
async function stepUp(page: Page, productName: string, qty: number) {
  const row = page.locator(".item-row", { hasText: productName });
  for (let i = 0; i < qty; i++) {
    await row.getByRole("button", { name: "increase" }).click();
  }
}

test.describe("/c/[token] additional orders", () => {
  test.beforeEach(async () => {
    await resetCustomerOrderState();
  });

  test.afterAll(async () => {
    await resetCustomerOrderState();
  });

  test("happy path: add via ?add=1 appends to the week's order — merged total, one orders row, inventory decremented", async ({
    page,
  }) => {
    // Place the initial order through the real form (kale ×2, delivery).
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await stepUp(page, TEST_PRODUCTS.kale.name, 2);
    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    // The hub offers the add entry point (store open, products orderable,
    // order not terminal).
    const addLink = page.getByRole("link", { name: "Add to your order" });
    await expect(addLink).toBeVisible();
    await addLink.click();
    await page.waitForURL(/\/c\/[^/]+\?add=1$/);

    // Add mode: fulfillment is read-only — no tabs, no editable preference.
    await expect(page.locator(".fulfill-tabs")).toHaveCount(0);
    await expect(page.locator("#delivery-pref")).toHaveCount(0);
    await expect(page.locator(".fulfill")).toContainText("Text Annabel");

    // Append eggs ×1 and submit.
    await stepUp(page, TEST_PRODUCTS.eggs.name, 1);
    const submit = page.locator(".submit-btn");
    await expect(submit).toHaveText("Add to order");
    await submit.click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    // /confirmed shows the MERGED order: both lines, combined total
    // (2×$3.00 kale + 1×$6.00 eggs = $12.00).
    await expect(page.locator(".confirm-list")).toContainText(TEST_PRODUCTS.kale.name);
    await expect(page.locator(".confirm-list")).toContainText(TEST_PRODUCTS.eggs.name);
    await expect(page.locator(".confirm-total")).toContainText("12.00");

    // DB: still exactly one orders row for (customer, week); two line items;
    // inventory decremented for the appended line too.
    const sb = admin();
    const ids = await customerIds();
    const { data: orders } = await sb
      .from("orders")
      .select("id, status")
      .eq("customer_id", ids.farmStand)
      .eq("week_of", weekOfMondayNY());
    expect(orders).toHaveLength(1);

    const { data: items } = await sb
      .from("order_items")
      .select("id, submission_id")
      .eq("order_id", orders![0].id);
    expect(items).toHaveLength(2);
    // Both submissions carry their idempotency key (per-submission audit).
    expect(items!.every((i) => i.submission_id !== null)).toBe(true);

    const { data: eggs } = await sb
      .from("products")
      .select("qty_available")
      .eq("id", TEST_PRODUCTS.eggs.id)
      .single();
    expect(eggs?.qty_available).toBe(TEST_PRODUCTS.eggs.qty_available - 1);
  });

  test("add mode shows the existing order's fulfillment read-only", async ({ page }) => {
    const ids = await customerIds();
    await seedOrder({
      customerId: ids.farmStand,
      weekOf: weekOfMondayNY(),
      fulfillmentType: "delivery",
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 1, unitPriceCents: 300 }],
    });

    await page.goto(`${customerOrderUrl(TEST_CUSTOMERS.farmStand.token)}?add=1`);
    await expect(page.getByRole("heading", { name: "Going with your order" })).toBeVisible();
    // seedOrder's delivery address, rendered as text — not an input.
    await expect(page.locator(".fulfill .addr-text")).toHaveText("123 Test St");
    await expect(page.locator(".fulfill-tabs")).toHaveCount(0);
    await expect(page.locator("#delivery-pref")).toHaveCount(0);
    await expect(page.locator("#pickup-note")).toHaveCount(0);
    await expect(page.locator(".submit-btn")).toHaveText("Add to order");
  });

  test("hub gating: closed store hides the add button and explains why", async ({ page }) => {
    const ids = await customerIds();
    await seedOrder({
      customerId: ids.farmStand,
      weekOf: weekOfMondayNY(),
      fulfillmentType: "delivery",
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 1, unitPriceCents: 300 }],
    });
    try {
      await setOrderingOpen(false);
      await page.goto(`${customerOrderUrl(TEST_CUSTOMERS.farmStand.token)}/confirmed`);
      await expect(page.getByRole("heading", { name: /Order received/i })).toBeVisible();
      await expect(page.getByRole("link", { name: "Add to your order" })).toHaveCount(0);
      await expect(page.getByText("Ordering’s closed for this week.")).toBeVisible();
    } finally {
      await setOrderingOpen(true);
    }
  });

  test("hub gating: nothing orderable hides the add button", async ({ page }) => {
    const ids = await customerIds();
    await seedOrder({
      customerId: ids.farmStand,
      weekOf: weekOfMondayNY(),
      fulfillmentType: "delivery",
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 1, unitPriceCents: 300 }],
    });
    const snapshot = await setAllProductsSoldOut();
    try {
      await page.goto(`${customerOrderUrl(TEST_CUSTOMERS.farmStand.token)}/confirmed`);
      await expect(page.getByRole("heading", { name: /Order received/i })).toBeVisible();
      await expect(page.getByRole("link", { name: "Add to your order" })).toHaveCount(0);
    } finally {
      await restoreProductQty(snapshot);
    }
  });

  test("hub gating: terminal order hides the add button; ?add=1 bounces back to /confirmed", async ({
    page,
  }) => {
    const ids = await customerIds();
    await seedOrder({
      customerId: ids.farmStand,
      weekOf: weekOfMondayNY(),
      fulfillmentType: "pickup",
      status: "picked-up",
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 1, unitPriceCents: 300 }],
    });

    await page.goto(`${customerOrderUrl(TEST_CUSTOMERS.farmStand.token)}/confirmed`);
    await expect(page.getByRole("heading", { name: /Order received/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add to your order" })).toHaveCount(0);
    await expect(page.getByText(/been packed/)).toBeVisible();

    // A stale ?add=1 link can't reach the form against a fulfilled order —
    // the page bounces it to /confirmed (where the reason copy lives).
    await page.goto(`${customerOrderUrl(TEST_CUSTOMERS.farmStand.token)}?add=1`);
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);
  });
});
