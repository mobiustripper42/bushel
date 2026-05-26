import { test, expect } from "@playwright/test";

import {
  ADMIN_STORAGE_STATE,
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  admin,
  customerIds,
  clearOrdersForWeek,
  seedOrder,
  setProductQty,
} from "./helpers";
import { weekOfMondayNY } from "@/lib/week";

test.describe("admin orders list", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  const thisWeek = weekOfMondayNY();

  test.beforeEach(async () => {
    await clearOrdersForWeek(thisWeek);
  });

  test.afterAll(async () => {
    await clearOrdersForWeek(thisWeek);
  });

  test("renders current-week orders with totals and item counts", async ({ page }) => {
    const ids = await customerIds();
    const orderId = await seedOrder({
      customerId: ids.farmStand,
      weekOf: thisWeek,
      fulfillmentType: "pickup",
      items: [
        { productId: TEST_PRODUCTS.kale.id, qty: 2, unitPriceCents: 300 },
        { productId: TEST_PRODUCTS.eggs.id, qty: 1, unitPriceCents: 600 },
      ],
    });

    await page.goto("/admin/orders");

    const row = page.locator(`tr.ord-row[data-order-id="${orderId}"]`);
    await expect(row).toHaveCount(1);
    await expect(row.locator(".ord-cust-name")).toHaveText(TEST_CUSTOMERS.farmStand.name);
    await expect(row.locator(".ord-total")).toHaveText("$12.00");
    // #159: items count = sum of qty (2 × kale + 1 × eggs = 3), not line count.
    await expect(row.locator(".ord-items-count")).toContainText("3");
    await expect(row.locator(".chip-ful")).toHaveText("Pickup");
  });

  test("needs_reconciliation row pins to the top regardless of sort", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Sort headers are hidden on mobile (card-stack layout); pin behavior at 375px is covered by the mobile-specific test below.");
    const ids = await customerIds();
    // Restaurant placed earlier and clean — would normally sort first by placed-desc.
    const restaurantOrderId = await seedOrder({
      customerId: ids.restaurant,
      weekOf: thisWeek,
      fulfillmentType: "delivery",
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 1, unitPriceCents: 300 }],
    });
    // Farm stand placed later (so newer) AND flagged. With "placed desc" default
    // the newer farm-stand row would naturally appear first anyway — re-sort by
    // total ascending below to flip the natural order and prove the pin holds.
    const farmOrderId = await seedOrder({
      customerId: ids.farmStand,
      weekOf: thisWeek,
      fulfillmentType: "pickup",
      needsReconciliation: true,
      items: [{ productId: TEST_PRODUCTS.honey.id, qty: 5, unitPriceCents: 1200 }],
    });

    await page.goto("/admin/orders");

    // Sort by Total ascending — farm-stand total ($60) > restaurant ($3), so by
    // pure sort the restaurant row should come first. Reconciliation pin must
    // override.
    await page.getByRole("button", { name: /^Total/i }).click();

    const rowIds = await page
      .locator("tr.ord-row")
      .evaluateAll((els) =>
        (els as HTMLElement[]).map((el) => el.dataset.orderId ?? ""),
      );
    expect(rowIds[0]).toBe(farmOrderId);
    expect(rowIds).toContain(restaurantOrderId);

    await expect(
      page.locator(`tr.ord-row[data-order-id="${farmOrderId}"] .badge-recon`),
    ).toBeVisible();
  });

  test("delivery order: new → ready → delivered persists across reload", async ({ page }) => {
    const ids = await customerIds();
    const orderId = await seedOrder({
      customerId: ids.restaurant,
      weekOf: thisWeek,
      fulfillmentType: "delivery",
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 1, unitPriceCents: 300 }],
    });

    await page.goto("/admin/orders");
    const row = page.locator(`tr.ord-row[data-order-id="${orderId}"]`);
    await expect(row).toHaveAttribute("data-status", "new");

    const sb = admin();

    await row.getByRole("button", { name: /mark ready/i }).click();
    await expect(row).toHaveAttribute("data-status", "ready", { timeout: 5000 });
    // Wait for first transition to commit to DB before chaining the next click.
    // useTransition + revalidatePath can swallow a second click while the first
    // is mid-flight; polling the DB ensures the action's round-trip completed.
    await expect
      .poll(
        async () => {
          const { data } = await sb.from("orders").select("status").eq("id", orderId).single();
          return data?.status ?? null;
        },
        { timeout: 5000 },
      )
      .toBe("ready");

    const deliveredBtn = row.getByRole("button", { name: /delivered/i });
    await expect(deliveredBtn).toBeEnabled();
    await deliveredBtn.click();
    await expect(row).toHaveAttribute("data-status", "delivered", { timeout: 5000 });
    await expect
      .poll(
        async () => {
          const { data } = await sb.from("orders").select("status").eq("id", orderId).single();
          return data?.status ?? null;
        },
        { timeout: 5000 },
      )
      .toBe("delivered");

    // Hard navigation (not page.reload — RSC streaming can hang reload after
    // chained server actions in dev mode).
    await page.goto("/admin/orders");
    const reloadedRow = page.locator(`tr.ord-row[data-order-id="${orderId}"]`);
    await expect(reloadedRow).toHaveAttribute("data-status", "delivered");
    await expect(reloadedRow.locator(".pill-done")).toHaveText("Delivered");
  });

  test("pickup order: ready advances to picked-up (not delivered)", async ({ page }) => {
    const ids = await customerIds();
    const orderId = await seedOrder({
      customerId: ids.farmStand,
      weekOf: thisWeek,
      fulfillmentType: "pickup",
      status: "ready",
      items: [{ productId: TEST_PRODUCTS.honey.id, qty: 1, unitPriceCents: 1200 }],
    });

    await page.goto("/admin/orders");
    const row = page.locator(`tr.ord-row[data-order-id="${orderId}"]`);
    await expect(row).toHaveAttribute("data-status", "ready");

    // Pickup orders show the "Picked up" advance button, not "Delivered".
    await expect(row.getByRole("button", { name: /delivered/i })).toHaveCount(0);
    await row.getByRole("button", { name: /picked up/i }).click();
    await expect(row).toHaveAttribute("data-status", "picked-up", { timeout: 5000 });

    // DB confirmation
    const sb = admin();
    await expect
      .poll(
        async () => {
          const { data } = await sb
            .from("orders")
            .select("status")
            .eq("id", orderId)
            .single();
          return data?.status ?? null;
        },
        { timeout: 5000 },
      )
      .toBe("picked-up");
  });

  test("mobile (375px): page fits viewport; cards stack; status-advance is touch-sized; recon-pin renders; expand works", async ({ page, viewport }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only assertions; covered on the mobile project.");

    const ids = await customerIds();
    // Two orders so we can verify the recon-pin order and that the second card
    // also stacks without overflow.
    await seedOrder({
      customerId: ids.restaurant,
      weekOf: thisWeek,
      fulfillmentType: "delivery",
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 2, unitPriceCents: 300 }],
    });
    const reconId = await seedOrder({
      customerId: ids.farmStand,
      weekOf: thisWeek,
      fulfillmentType: "pickup",
      needsReconciliation: true,
      items: [{ productId: TEST_PRODUCTS.honey.id, qty: 3, unitPriceCents: 1200 }],
    });

    await page.goto("/admin/orders");

    // (a) No horizontal overflow at iPhone-13 width — admin shell collapses to
    // drawer (Phase 6.4) and the orders table reflows to a card stack.
    const vw = viewport!.width;
    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(docWidth).toBeLessThanOrEqual(vw + 1);

    // (b) Recon-flagged order pins first and its badge is visible at mobile width.
    const firstRow = page.locator("tr.ord-row").first();
    await expect(firstRow).toHaveAttribute("data-order-id", reconId);
    await expect(firstRow.locator(".badge-recon")).toBeVisible();

    // (c) Status-advance is ≥44px tall (Apple HIG / WCAG 2.5.5).
    const advanceBtn = firstRow.getByRole("button", { name: /mark ready/i });
    const box = await advanceBtn.boundingBox();
    expect(box, "Status-advance button should be visible").not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // (d) Tapping the card opens the detail; line items render in the stacked layout.
    await firstRow.click();
    const detail = page.locator("tr.ord-detail-row .ord-detail");
    await expect(detail).toBeVisible();
    await expect(detail.locator(".ord-li-name")).toContainText("Honey");
  });

  test("line-level oversold badge gates on order.needsReconciliation (orders that fit at placement stay clean once inventory hits zero)", async ({ page }) => {
    const ids = await customerIds();
    // Simulate the post-decrement steady state Annabel sees once Kale is sold
    // out: qty_available=0 on the product, two orders in the system — one
    // that fit at placement (needs_reconciliation=false) and one that
    // overshot (needs_reconciliation=true). Pre-fix, both would flag every
    // line as "oversold" because qty > 0 (current) is true for both.
    try {
      await setProductQty(TEST_PRODUCTS.kale.id, 0);

      const orderFit = await seedOrder({
        customerId: ids.farmStand,
        weekOf: thisWeek,
        fulfillmentType: "pickup",
        // Default needsReconciliation=false — this order fit when placed.
        items: [{ productId: TEST_PRODUCTS.kale.id, qty: 2, unitPriceCents: 300 }],
      });
      const orderOvershoot = await seedOrder({
        customerId: ids.restaurant,
        weekOf: thisWeek,
        fulfillmentType: "delivery",
        needsReconciliation: true,
        items: [{ productId: TEST_PRODUCTS.kale.id, qty: 3, unitPriceCents: 300 }],
      });

      await page.goto("/admin/orders");

      // Only one row expands at a time (orders-page tracks a single `expanded`
      // id), so check each detail in turn. Click the customer-name cell —
      // bare-row clicks can land on the status column which stops propagation.

      // The fit order: no per-line oversold marker, no order-level callout.
      await page.locator(`tr.ord-row[data-order-id="${orderFit}"] .ord-cust-name`).click();
      const fitDetail = page.locator("tr.ord-detail-row .ord-detail");
      await expect(fitDetail).toBeVisible();
      await expect(fitDetail.locator("li.is-oversold")).toHaveCount(0);
      await expect(fitDetail.locator(".callout-warn")).toHaveCount(0);

      // The overshoot order: line marker + order-level callout both present.
      await page.locator(`tr.ord-row[data-order-id="${orderOvershoot}"] .ord-cust-name`).click();
      const overDetail = page.locator("tr.ord-detail-row .ord-detail");
      await expect(overDetail).toBeVisible();
      await expect(overDetail.locator("li.is-oversold")).toHaveCount(1);
      await expect(overDetail.locator(".callout-warn")).toBeVisible();
    } finally {
      await setProductQty(TEST_PRODUCTS.kale.id, TEST_PRODUCTS.kale.qty_available);
    }
  });

  test("expand row reveals line items, customer note, and reconciliation callout", async ({ page }) => {
    const ids = await customerIds();
    const sb = admin();
    const orderId = await seedOrder({
      customerId: ids.farmStand,
      weekOf: thisWeek,
      fulfillmentType: "pickup",
      needsReconciliation: true,
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 4, unitPriceCents: 300 }],
    });
    await sb
      .from("orders")
      .update({ notes: "Front gate is sticky — knock twice." })
      .eq("id", orderId);

    await page.goto("/admin/orders");
    const row = page.locator(`tr.ord-row[data-order-id="${orderId}"]`);
    await row.click();

    const detail = page.locator("tr.ord-detail-row .ord-detail");
    await expect(detail).toBeVisible();
    await expect(detail.locator(".ord-li-name")).toContainText("Kale");
    await expect(detail.locator(".ord-li-total .mono")).toHaveText("$12.00");
    await expect(detail.locator(".ord-detail-note")).toContainText("Front gate is sticky");
    await expect(detail.locator(".callout-warn")).toBeVisible();
    await expect(detail.locator(".callout-warn button", { hasText: /adjust quantities/i })).toBeDisabled();
    await expect(detail.locator(".callout-warn button", { hasText: /mark resolved/i })).toBeDisabled();
  });
});
