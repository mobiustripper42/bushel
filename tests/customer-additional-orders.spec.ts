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

// #211/DEC-039 + #227/DEC-041/DEC-042 — additive orders on the open-order
// model. A customer's link renders their OPEN order editable (pre-populated
// add mode; new items append). A terminal order (picked_up/delivered) drops
// out of the identity: /confirmed shows it read-only with a "Place a new
// order" path, and /c/[token] serves a fresh form.

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

  test("happy path: revisiting the link appends to the open order — merged total, one orders row, inventory decremented", async ({
    page,
  }) => {
    // Place the initial order through the real form (kale ×2, delivery).
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await stepUp(page, TEST_PRODUCTS.kale.name, 2);
    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    // The hub offers the add entry point (store open, products orderable,
    // order not terminal) — it now points at the plain order link.
    const addLink = page.getByRole("link", { name: "Add to your order" });
    await expect(addLink).toBeVisible();
    await addLink.click();
    await page.waitForURL(/\/c\/[^/]+$/);

    // Add mode: fulfillment is read-only — no tabs, no editable preference.
    await expect(page.locator(".fulfill-tabs")).toHaveCount(0);
    await expect(page.locator("#delivery-pref")).toHaveCount(0);
    await expect(page.locator(".fulfill")).toContainText("Text Annabel");

    // Append eggs ×1 and submit.
    await stepUp(page, TEST_PRODUCTS.eggs.name, 1);
    const submit = page.locator(".submit-btn");
    await expect(submit).toHaveText("Update order");
    await submit.click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    // /confirmed shows the MERGED order: both lines, combined total
    // (2×$3.00 kale + 1×$6.00 eggs = $12.00).
    await expect(page.locator(".confirm-list")).toContainText(TEST_PRODUCTS.kale.name);
    await expect(page.locator(".confirm-list")).toContainText(TEST_PRODUCTS.eggs.name);
    await expect(page.locator(".confirm-total")).toContainText("12.00");

    // DB: still exactly one OPEN orders row for the customer; two line
    // items; inventory decremented for the appended line too.
    const sb = admin();
    const ids = await customerIds();
    const { data: orders } = await sb
      .from("orders")
      .select("id, status")
      .eq("customer_id", ids.farmStand)
      .in("status", ["new", "confirmed", "ready"]);
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

  // #241: appends insert separate order_items rows per submission (audit +
  // idempotency), but every view folds same (product, unit, price) into one
  // line — a customer topping up cherry tomatoes twice must not read as
  // three cherry-tomato lines.
  test("same-product append consolidates to one line on receipt + add mode; DB rows stay granular", async ({
    page,
  }) => {
    // Kale ×2 through the form…
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await stepUp(page, TEST_PRODUCTS.kale.name, 2);
    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    // …then top up the SAME product ×1.
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await stepUp(page, TEST_PRODUCTS.kale.name, 1);
    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    // Receipt: ONE kale line, qty 3, total 3 × $3.00.
    const kaleLines = page.locator(".confirm-list li", { hasText: TEST_PRODUCTS.kale.name });
    await expect(kaleLines).toHaveCount(1);
    await expect(kaleLines.locator(".confirm-qty")).toHaveText("3×");
    await expect(page.locator(".confirm-total")).toContainText("9.00");

    // Add mode: the "Already ordered" group also shows one consolidated line.
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    const existing = page.locator(".rail-existing:visible");
    await expect(existing.locator("li", { hasText: TEST_PRODUCTS.kale.name })).toHaveCount(1);
    await expect(existing).toContainText("3×");

    // DB: still two granular rows, each carrying its submission_id.
    const sb = admin();
    const ids = await customerIds();
    const { data: orders } = await sb
      .from("orders")
      .select("id")
      .eq("customer_id", ids.farmStand)
      .in("status", ["new", "confirmed", "ready"]);
    const { data: rows } = await sb
      .from("order_items")
      .select("id, submission_id")
      .eq("order_id", orders![0].id);
    expect(rows).toHaveLength(2);
    expect(new Set(rows!.map((r) => r.submission_id)).size).toBe(2);
  });

  test("open order renders the form in add mode with fulfillment read-only", async ({ page }) => {
    const ids = await customerIds();
    await seedOrder({
      customerId: ids.farmStand,
      weekOf: weekOfMondayNY(),
      fulfillmentType: "delivery",
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 1, unitPriceCents: 300 }],
    });

    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await expect(page.getByRole("heading", { name: "Going with your order" })).toBeVisible();
    // seedOrder's delivery address, rendered as text — not an input.
    await expect(page.locator(".fulfill .addr-text")).toHaveText("123 Test St");
    await expect(page.locator(".fulfill-tabs")).toHaveCount(0);
    await expect(page.locator("#delivery-pref")).toHaveCount(0);
    await expect(page.locator("#pickup-note")).toHaveCount(0);
    await expect(page.locator(".submit-btn")).toHaveText("Update order");
  });

  // 9.1/DEC-039 — the "your order" card shows the COMPLETE order: already-placed
  // lines read-only above the editable additions, with a grand total.
  test("add mode summary shows existing items read-only + grand total", async ({ page }) => {
    const ids = await customerIds();
    await seedOrder({
      customerId: ids.farmStand,
      weekOf: weekOfMondayNY(),
      fulfillmentType: "delivery",
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 1, unitPriceCents: 300 }],
    });

    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

    // Already-ordered kale ×1 ($3.00) renders read-only in the summary.
    const existing = page.locator(".rail-existing:visible");
    await expect(existing).toContainText("Already ordered");
    await expect(existing).toContainText(TEST_PRODUCTS.kale.name);

    // Append eggs ×1 ($6.00). The additions list is the non-existing rail-list.
    await stepUp(page, TEST_PRODUCTS.eggs.name, 1);
    const additions = page.locator(".rail-list:not(.rail-list-existing):visible");
    await expect(additions).toContainText(TEST_PRODUCTS.eggs.name);

    // Total is the GRAND total: existing $3.00 + new $6.00 = $9.00.
    await expect(page.locator(".rail-row-total:visible")).toContainText("9.00");
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

      // The closed shell must not eat the open order: the customer's link
      // redirects to the receipt instead of dead-ending at "closed".
      await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
      await page.waitForURL(/\/c\/[^/]+\/confirmed$/);
      await expect(page.getByRole("heading", { name: /Order received/i })).toBeVisible();
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

  // DEC-041: a fulfilled order drops out of the open-order identity — the
  // receipt goes read-only with a "Place a new order" path, and the order
  // link serves a fresh form whose submit CREATES a second orders row.
  test("terminal order: read-only receipt offers a new order; the link serves a fresh form that creates one", async ({
    page,
  }) => {
    const ids = await customerIds();
    const fulfilledId = await seedOrder({
      customerId: ids.farmStand,
      weekOf: weekOfMondayNY(),
      fulfillmentType: "pickup",
      status: "picked_up",
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 1, unitPriceCents: 300 }],
    });

    // /confirmed: read-only receipt — no add affordance, packed copy, and
    // the "Place a new order" path (store open, products orderable).
    await page.goto(`${customerOrderUrl(TEST_CUSTOMERS.farmStand.token)}/confirmed`);
    await expect(page.getByRole("heading", { name: /Order received/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add to your order" })).toHaveCount(0);
    await expect(page.getByText(/been packed/)).toBeVisible();

    // The order link serves a FRESH form (not the add-mode view).
    await page.getByRole("link", { name: "Place a new order" }).click();
    await page.waitForURL(/\/c\/[^/]+$/);
    await expect(page.getByRole("heading", { name: /What.s available/i })).toBeVisible();
    await expect(page.locator(".rail-existing")).toHaveCount(0);

    // Submitting creates a SECOND order — the fulfilled one is untouched.
    await stepUp(page, TEST_PRODUCTS.eggs.name, 1);
    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    const sb = admin();
    const { data: orders } = await sb
      .from("orders")
      .select("id, status")
      .eq("customer_id", ids.farmStand)
      .eq("week_of", weekOfMondayNY());
    expect(orders).toHaveLength(2);
    const fulfilled = orders!.find((o) => o.id === fulfilledId);
    expect(fulfilled?.status).toBe("picked_up");
    const fresh = orders!.find((o) => o.id !== fulfilledId);
    expect(fresh?.status).toBe("new");
  });
});
