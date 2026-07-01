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
import type { Locator } from "@playwright/test";

// #192: the per-order action stack (Mark/Confirm/Send buttons) renders only
// when the row is expanded. Click a non-status cell to toggle it open.
async function expandRow(row: Locator): Promise<void> {
  await row.locator(".col-o-cust").click();
}

// The action stack lives in the expanded detail row (third grid column),
// not the ord-row's status cell — locate buttons through the detail row.
function detailRowFor(row: Locator, orderId: string): Locator {
  return row.page().locator(`tr.ord-detail-row[data-order-id="${orderId}"]`);
}

test.describe("admin orders list", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  const thisWeek = weekOfMondayNY();

  test.beforeEach(async ({ context, browserName }) => {
    // The desktop Confirm/Send path writes the SMS body to the clipboard before
    // recording (Phase 6.7). Grant the permission so the action-stack send tests
    // don't error on clipboard-write. WebKit doesn't support the permission name
    // and goes down the sms: deep-link path instead, so it's chromium-only.
    if (browserName === "chromium") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    }
    await clearOrdersForWeek(thisWeek);
    // Clear the week's sends so the action-stack Send buttons start at "Send"
    // (not "Re-send") regardless of prior-test/prior-run send state.
    await admin().from("customer_sends").delete().eq("week_of", thisWeek);
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

  // #241: DEC-039 appends leave one order_items row per submission; the
  // detail panel folds same (product, unit, price) into one line.
  test("duplicate product rows consolidate to one line in the detail panel", async ({ page }) => {
    const ids = await customerIds();
    const orderId = await seedOrder({
      customerId: ids.farmStand,
      weekOf: thisWeek,
      fulfillmentType: "pickup",
      items: [
        { productId: TEST_PRODUCTS.kale.id, qty: 1, unitPriceCents: 300 },
        { productId: TEST_PRODUCTS.kale.id, qty: 2, unitPriceCents: 300 },
        { productId: TEST_PRODUCTS.eggs.id, qty: 1, unitPriceCents: 600 },
      ],
    });

    await page.goto("/admin/orders");
    const row = page.locator(`tr.ord-row[data-order-id="${orderId}"]`);
    // Items count sums qty across the raw rows (1 + 2 + 1 = 4)…
    await expect(row.locator(".ord-items-count")).toContainText("4");
    await expandRow(row);

    // …but the detail panel shows ONE kale line at the summed qty.
    const detail = detailRowFor(row, orderId);
    const kaleLines = detail.locator(".ord-detail-list li", { hasText: TEST_PRODUCTS.kale.name });
    await expect(kaleLines).toHaveCount(1);
    await expect(kaleLines.locator(".ord-li-qty")).toHaveText("3×");
    await expect(kaleLines.locator(".ord-li-amt")).toHaveText("$9.00");
    await expect(detail.locator(".ord-li-total")).toContainText("$15.00");
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
    await expandRow(row);

    const sb = admin();

    await detailRowFor(row, orderId).getByRole("button", { name: /mark ready/i }).click();
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

    const deliveredBtn = detailRowFor(row, orderId).getByRole("button", { name: /delivered/i });
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

  test("confirmed order renders the Confirmed pill and advances confirmed → ready (#190)", async ({ page }) => {
    const ids = await customerIds();
    const orderId = await seedOrder({
      customerId: ids.restaurant,
      weekOf: thisWeek,
      fulfillmentType: "delivery",
      status: "confirmed",
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 1, unitPriceCents: 300 }],
    });

    await page.goto("/admin/orders");
    const row = page.locator(`tr.ord-row[data-order-id="${orderId}"]`);
    await expect(row).toHaveAttribute("data-status", "confirmed");
    // Renders the Confirmed pill — not a fallthrough "Delivered" done-pill.
    await expect(row.locator(".pill-confirmed")).toHaveText("Confirmed");
    await expandRow(row);

    await detailRowFor(row, orderId).getByRole("button", { name: /mark ready/i }).click();
    await expect(row).toHaveAttribute("data-status", "ready", { timeout: 5000 });
    await expect(row.locator(".pill-ready")).toHaveText("Ready");
  });

  test("pickup order: ready advances to picked_up (not delivered)", async ({ page }) => {
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
    await expandRow(row);

    // Pickup orders show the "Mark picked up" advance button, not "Delivered".
    await expect(detailRowFor(row, orderId).getByRole("button", { name: /delivered/i })).toHaveCount(0);
    await detailRowFor(row, orderId).getByRole("button", { name: /picked up/i }).click();
    await expect(row).toHaveAttribute("data-status", "picked_up", { timeout: 5000 });

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
      .toBe("picked_up");
  });

  test("action stack: collapsed shows only the chip; expanded Confirm+Send advances new → confirmed; reminder wording follows fulfillment (#192/#193)", async ({ page }, testInfo) => {
    const ids = await customerIds();
    const pickupId = await seedOrder({
      customerId: ids.farmStand,
      weekOf: thisWeek,
      fulfillmentType: "pickup",
      items: [{ productId: TEST_PRODUCTS.honey.id, qty: 1, unitPriceCents: 1200 }],
    });
    const deliveryId = await seedOrder({
      customerId: ids.restaurant,
      weekOf: thisWeek,
      fulfillmentType: "delivery",
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 1, unitPriceCents: 300 }],
    });
    // The Confirm/Send link only renders with a phone on file (else "No phone").
    await admin()
      .from("customers")
      .update({ phone: "2165550100" })
      .eq("id", ids.restaurant);

    await page.goto("/admin/orders");

    // Collapsed: chip only, no action stack.
    const pickupRow = page.locator(`tr.ord-row[data-order-id="${pickupId}"]`);
    await expect(pickupRow.locator(".pill-new")).toHaveText("New");
    // No detail row at all while collapsed, and no action stack anywhere.
    await expect(detailRowFor(pickupRow, pickupId)).toHaveCount(0);
    await expect(page.locator(".ord-actions")).toHaveCount(0);

    // Pickup order expanded → has a Pickup reminder send action.
    await expandRow(pickupRow);
    const pickupActions = detailRowFor(pickupRow, pickupId).locator(".ord-actions");
    await expect(pickupActions).toBeVisible();
    await expect(pickupActions.getByText("Pickup reminder")).toBeVisible();

    // Delivery order expanded → Confirm + a Delivery reminder (#193), not Pickup.
    const deliveryRow = page.locator(`tr.ord-row[data-order-id="${deliveryId}"]`);
    await expandRow(deliveryRow);
    const deliveryActions = detailRowFor(deliveryRow, deliveryId).locator(".ord-actions");
    await expect(deliveryActions.getByText("Confirm order")).toBeVisible();
    await expect(deliveryActions.getByText("Delivery reminder")).toBeVisible();
    await expect(deliveryActions.getByText("Pickup reminder")).toHaveCount(0);

    // Confirm + Send records the send and auto-advances new → confirmed.
    // Desktop-only: WebKit navigates to sms:… on click and clears the page.
    if (testInfo.project.name === "mobile") return;
    await deliveryActions
      .locator(".send-action", { hasText: "Confirm order" })
      .getByRole("link", { name: /^send$/i })
      .click();
    await expect(deliveryRow).toHaveAttribute("data-status", "confirmed", { timeout: 5000 });
    await expect(deliveryRow.locator(".pill-confirmed")).toHaveText("Confirmed");
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

    // (c) Tapping the card opens the detail; the action stack appears (#192).
    await firstRow.click();
    const detail = page.locator("tr.ord-detail-row .ord-detail");
    await expect(detail).toBeVisible();
    await expect(detail.locator(".ord-li-name")).toContainText("Honey");

    // (d) The expanded action stack's advance button is ≥44px tall (WCAG 2.5.5).
    const advanceBtn = detailRowFor(firstRow, reconId).getByRole("button", { name: /mark ready/i });
    const box = await advanceBtn.boundingBox();
    expect(box, "Status-advance button should be visible").not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
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
