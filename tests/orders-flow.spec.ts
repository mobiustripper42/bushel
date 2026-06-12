import { test, expect, type Download, type Page } from "@playwright/test";

import {
  ADMIN_STORAGE_STATE,
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  admin,
  customerOrderUrl,
  customerIds,
  clearOrdersForWeek,
  seedOrder,
  resetCustomerOrderState,
  resetProductUnits,
  setProductQty,
  setProductUnits,
} from "./helpers";
import { weekOfMondayNY } from "@/lib/week";
import { EXPORT_COLUMNS } from "@/lib/admin/export-orders";

// Phase 5.3 — cross-task integration tests covering the gaps that 5.1
// (status UI) and 5.2 (CSV/TSV export) own-specs don't quite hit:
//   (a) end-to-end customer → admin: place an order, see it, advance it,
//       export it
//   (b) reconciliation pin survives sort + week-filter changes together
//   (c) export respects the active week filter

async function stepUp(page: Page, productName: string, qty: number): Promise<void> {
  const row = page.locator(".item-row", { hasText: productName });
  for (let i = 0; i < qty; i++) {
    await row.getByRole("button", { name: "increase" }).click();
  }
}

async function readDownloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  let text = "";
  for await (const chunk of stream) text += chunk.toString();
  return text;
}

function shiftWeek(weekOf: string, weeks: number): string {
  const [y, m, d] = weekOf.split("-").map((n) => parseInt(n, 10));
  const anchor = new Date(Date.UTC(y, m - 1, d));
  anchor.setUTCDate(anchor.getUTCDate() + weeks * 7);
  return anchor.toISOString().slice(0, 10);
}

test.describe("orders flow — cross-task (customer ↔ admin ↔ export)", () => {
  const thisWeek = weekOfMondayNY();
  const lastWeek = shiftWeek(thisWeek, -1);

  test.beforeEach(async () => {
    await resetCustomerOrderState();
  });

  // Clean both weeks we ever touch — test 3 seeds lastWeek and clears it
  // inline on success, but a mid-test failure would otherwise leak the
  // last-week order indefinitely.
  test.afterAll(async () => {
    await clearOrdersForWeek(thisWeek);
    await clearOrdersForWeek(lastWeek);
  });

  test("customer places an order → admin advances status → export contains the row", async ({
    browser,
  }) => {
    // Customer context (no admin cookies)
    const customerCtx = await browser.newContext();
    const customerPage = await customerCtx.newPage();
    await customerPage.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await stepUp(customerPage, TEST_PRODUCTS.kale.name, 2);
    await customerPage.locator(".submit-btn").click();
    await customerPage.waitForURL(/\/c\/[^/]+\/confirmed$/);
    await customerCtx.close();

    // Pick up the order id the customer just created
    const sb = admin();
    const ids = await customerIds();
    const { data: order } = await sb
      .from("orders")
      .select("id")
      .eq("customer_id", ids.farmStand)
      .eq("week_of", thisWeek)
      .single();
    expect(order?.id).toBeTruthy();
    const orderId = order!.id;

    // Admin context — separate so admin cookies don't bleed into customerCtx
    const adminCtx = await browser.newContext({ storageState: ADMIN_STORAGE_STATE });
    const adminPage = await adminCtx.newPage();
    await adminPage.goto("/admin/orders");

    const row = adminPage.locator(`tr.ord-row[data-order-id="${orderId}"]`);
    await expect(row).toHaveAttribute("data-status", "new");
    // #192: advance buttons live in the expanded row — open it first.
    await row.locator(".col-o-cust").click();

    // new → ready
    await row.getByRole("button", { name: /mark ready/i }).click();
    await expect(row).toHaveAttribute("data-status", "ready", { timeout: 5000 });
    await expect
      .poll(async () => {
        const { data } = await sb.from("orders").select("status").eq("id", orderId).single();
        return data?.status ?? null;
      }, { timeout: 5000 })
      .toBe("ready");

    // ready → delivered (farmStand defaults to delivery)
    const deliveredBtn = row.getByRole("button", { name: /delivered/i });
    await expect(deliveredBtn).toBeEnabled();
    await deliveredBtn.click();
    await expect(row).toHaveAttribute("data-status", "delivered", { timeout: 5000 });
    await expect
      .poll(async () => {
        const { data } = await sb.from("orders").select("status").eq("id", orderId).single();
        return data?.status ?? null;
      }, { timeout: 5000 })
      .toBe("delivered");

    // Export → CSV contains the just-placed order's line item.
    // No invoice-number column anymore (Wave assigns on import) — match on
    // customer name + product name; column shape is
    //   Customer Name, Item Number, Quantity, Unit Price, Description, …
    await adminPage.getByRole("button", { name: /export to wave/i }).click();
    const [download] = await Promise.all([
      adminPage.waitForEvent("download"),
      adminPage.getByRole("button", { name: /download csv/i }).click(),
    ]);
    const text = await readDownloadText(download);
    const lines = text.split("\r\n");
    // No header row — first line is the seeded order's data.
    expect(lines[0]).not.toBe(EXPORT_COLUMNS.join(","));
    // Customer Name leads each row; Description column carries product name.
    const kaleLine = lines.find(
      (l) =>
        l.startsWith(`${TEST_CUSTOMERS.farmStand.name},`) &&
        l.includes(TEST_PRODUCTS.kale.name),
    );
    expect(kaleLine).toBeTruthy();
    // Seed product has description = null, so Item Number cell is empty.
    expect(kaleLine).toBe(`${TEST_CUSTOMERS.farmStand.name},,2,3.00,${TEST_PRODUCTS.kale.name},,`);

    // Reference orderId so the unused-var lint stays happy + documents the
    // intent that this CSV line corresponds to the order we just created.
    expect(orderId).toBeTruthy();

    await adminCtx.close();
  });

  test("reconciliation pin holds across both column sort and week filter changes", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Sort headers are hidden on mobile (card-stack layout); pin behavior is covered by the admin-orders mobile-specific test.");
    await clearOrdersForWeek(thisWeek);
    const ids = await customerIds();
    // Clean order placed later (so newer by created_at) for restaurant
    const cleanId = await seedOrder({
      customerId: ids.restaurant,
      weekOf: thisWeek,
      fulfillmentType: "delivery",
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 1, unitPriceCents: 300 }],
    });
    // Flagged order — placed AFTER the clean one (still newer by created_at)
    // to remove the "newest naturally pins to top" confound — the recon pin
    // is doing the work in both sort orders below.
    const recId = await seedOrder({
      customerId: ids.farmStand,
      weekOf: thisWeek,
      fulfillmentType: "pickup",
      needsReconciliation: true,
      items: [{ productId: TEST_PRODUCTS.honey.id, qty: 1, unitPriceCents: 1200 }],
    });

    const adminCtx = await browser.newContext({ storageState: ADMIN_STORAGE_STATE });
    const adminPage = await adminCtx.newPage();
    await adminPage.goto("/admin/orders");

    async function topOrderId(): Promise<string> {
      const rowIds = await adminPage
        .locator("tr.ord-row")
        .evaluateAll((els) =>
          (els as HTMLElement[]).map((el) => el.dataset.orderId ?? ""),
        );
      return rowIds[0];
    }

    // Default sort (placed desc): flagged row pinned regardless of which is newer
    expect(await topOrderId()).toBe(recId);

    // Sort by Customer ascending — Test Farm Stand (F) < Test Restaurant (T)
    // but even if it were the other way, the recon pin must win.
    await adminPage.getByRole("button", { name: /^Customer/i }).click();
    expect(await topOrderId()).toBe(recId);

    // Flip to last week and back — pin must hold after a route change too
    await adminPage.getByRole("button", { name: /^last week/i }).click();
    await expect(adminPage).toHaveURL(/week=last/);
    await adminPage.getByRole("button", { name: /^this week/i }).click();
    await expect(adminPage).not.toHaveURL(/week=last/);
    expect(await topOrderId()).toBe(recId);
    expect(await adminPage.locator("tr.ord-row").count()).toBe(2);

    // Sanity — the clean row is still present, just not first
    await expect(
      adminPage.locator(`tr.ord-row[data-order-id="${cleanId}"]`),
    ).toHaveCount(1);

    await adminCtx.close();
  });

  test("export respects the active week filter", async ({ browser }) => {
    await clearOrdersForWeek(thisWeek);
    await clearOrdersForWeek(lastWeek);

    const ids = await customerIds();
    // farmStand=delivery this week with Kale; restaurant=pickup last week with
    // Honey. Customer + product names are the unique markers — no invoice-
    // number column anymore, so identification has to come from these.
    await seedOrder({
      customerId: ids.farmStand,
      weekOf: thisWeek,
      fulfillmentType: "delivery",
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 3, unitPriceCents: 300 }],
    });
    await seedOrder({
      customerId: ids.restaurant,
      weekOf: lastWeek,
      fulfillmentType: "pickup",
      items: [{ productId: TEST_PRODUCTS.honey.id, qty: 2, unitPriceCents: 1200 }],
    });

    const adminCtx = await browser.newContext({ storageState: ADMIN_STORAGE_STATE });
    const adminPage = await adminCtx.newPage();

    // This-week default: export contains only this-week's line items
    await adminPage.goto("/admin/orders");
    await adminPage.getByRole("button", { name: /export to wave/i }).click();
    const [thisDl] = await Promise.all([
      adminPage.waitForEvent("download"),
      adminPage.getByRole("button", { name: /download csv/i }).click(),
    ]);
    expect(thisDl.suggestedFilename()).toBe(`bushel-orders-${thisWeek}.csv`);
    const thisText = await readDownloadText(thisDl);
    expect(thisText).toContain(TEST_CUSTOMERS.farmStand.name);
    expect(thisText).toContain(TEST_PRODUCTS.kale.name);
    expect(thisText).not.toContain(TEST_CUSTOMERS.restaurant.name);
    expect(thisText).not.toContain(TEST_PRODUCTS.honey.name);

    // Switch to Last week — re-export
    await adminPage.getByRole("button", { name: /^last week/i }).click();
    await expect(adminPage).toHaveURL(/week=last/);
    await adminPage.getByRole("button", { name: /export to wave/i }).click();
    const [lastDl] = await Promise.all([
      adminPage.waitForEvent("download"),
      adminPage.getByRole("button", { name: /download csv/i }).click(),
    ]);
    expect(lastDl.suggestedFilename()).toBe(`bushel-orders-${lastWeek}.csv`);
    const lastText = await readDownloadText(lastDl);
    expect(lastText).toContain(TEST_CUSTOMERS.restaurant.name);
    expect(lastText).toContain(TEST_PRODUCTS.honey.name);
    expect(lastText).not.toContain(TEST_CUSTOMERS.farmStand.name);
    expect(lastText).not.toContain(TEST_PRODUCTS.kale.name);

    await adminCtx.close();
  });

  // 6.5f — multi-unit cross-cutting end-to-end. Exercises the full path:
  // admin seeds units → customer picks a non-base unit → place_order does
  // unit-aware decrement + per-unit price snapshot → admin orders detail
  // displays the correct unit label per line.
  test.describe("multi-unit end-to-end (6.5f)", () => {
    const LB_CONV = 2;
    const BUNCH_PRICE = TEST_PRODUCTS.kale.price_cents; // $3.00 base
    const LB_PRICE = 500;                                // $5.00 per lb

    test.beforeEach(async () => {
      await setProductUnits(TEST_PRODUCTS.kale.id, [
        { label: TEST_PRODUCTS.kale.unit, conversion_to_base: 1, unit_price_cents: BUNCH_PRICE },
        { label: "lb",                    conversion_to_base: LB_CONV, unit_price_cents: LB_PRICE },
      ]);
    });

    test.afterEach(async () => {
      await resetProductUnits(TEST_PRODUCTS.kale.id, BUNCH_PRICE, TEST_PRODUCTS.kale.unit);
      await setProductQty(TEST_PRODUCTS.kale.id, TEST_PRODUCTS.kale.qty_available);
    });

    test("happy path: customer orders lb → admin sees correct unit label + price + decrement", async ({
      browser,
    }) => {
      // Customer picks lb, orders 2.
      const customerCtx = await browser.newContext();
      const customerPage = await customerCtx.newPage();
      await customerPage.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

      const kaleRow = customerPage.locator(".item-row", { hasText: TEST_PRODUCTS.kale.name });
      await kaleRow.locator("label.unit-option").filter({ hasText: "lb" }).click();
      await kaleRow.getByRole("button", { name: "increase" }).click();
      await kaleRow.getByRole("button", { name: "increase" }).click();
      await customerPage.locator(".submit-btn").click();
      await customerPage.waitForURL(/\/c\/[^/]+\/confirmed$/);

      // /confirmed shows "lb", not the base "bunch".
      const confirmList = customerPage.locator(".confirm-list");
      await expect(confirmList).toContainText(/lb/);
      await expect(confirmList).not.toContainText(/bunch/);
      await customerCtx.close();

      // Find the order id.
      const sb = admin();
      const ids = await customerIds();
      const { data: order } = await sb
        .from("orders")
        .select("id")
        .eq("customer_id", ids.farmStand)
        .eq("week_of", thisWeek)
        .single();
      expect(order?.id).toBeTruthy();

      // Inventory decremented by qty * conversion_to_base = 2 * 2 = 4.
      const { data: kale } = await sb
        .from("products")
        .select("qty_available")
        .eq("id", TEST_PRODUCTS.kale.id)
        .single();
      expect(Number(kale?.qty_available)).toBeCloseTo(
        TEST_PRODUCTS.kale.qty_available - 2 * LB_CONV,
        2,
      );

      // Admin orders expand row → line shows "lb", $5.00 line price.
      const adminCtx = await browser.newContext({ storageState: ADMIN_STORAGE_STATE });
      const adminPage = await adminCtx.newPage();
      await adminPage.goto("/admin/orders");
      const row = adminPage.locator(`tr.ord-row[data-order-id="${order!.id}"]`);
      await row.click();

      const detail = adminPage.locator("tr.ord-detail-row .ord-detail");
      await expect(detail).toBeVisible();
      const lineItem = detail.locator(".ord-detail-list li").first();
      await expect(lineItem.locator(".ord-li-name")).toContainText(TEST_PRODUCTS.kale.name);
      // The unit segment is " · lb", not " · bunch" — the line corresponds to
      // the customer's lb selection. Be precise so a bug that falls back to
      // the base unit doesn't pass.
      await expect(lineItem.locator(".ord-li-unit")).toHaveText(/· lb$/);
      await expect(lineItem.locator(".ord-li-unit")).not.toHaveText(/bunch/);
      // 2 lb × $5.00 = $10.00 (selected unit's price, not base).
      await expect(lineItem.locator(".ord-li-amt")).toHaveText("$10.00");

      await adminCtx.close();
    });

    test("oversell-by-unit: customer orders past per-unit availability → admin sees recon pin + correct label", async ({
      browser,
    }) => {
      // Tight inventory: 3 base units = 1.5 lb at conv=2 → 1 lb is OK but
      // 2 lb tips over. Stepper max is 1 lb (floor(3/2)=1), so the customer
      // can't normally order 2 lb. Set qty_available so 2 lb is the
      // stepper's max BUT the order WILL still trigger the oversold path
      // when stock is reduced after page render. Cleanest setup: render
      // page with qty=4 (max=2 lb), then drop qty to 1 before submit so
      // the place_order RPC oversells.
      await setProductQty(TEST_PRODUCTS.kale.id, 4);

      const customerCtx = await browser.newContext();
      const customerPage = await customerCtx.newPage();
      await customerPage.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

      const kaleRow = customerPage.locator(".item-row", { hasText: TEST_PRODUCTS.kale.name });
      await kaleRow.locator("label.unit-option").filter({ hasText: "lb" }).click();
      await kaleRow.getByRole("button", { name: "increase" }).click();
      await kaleRow.getByRole("button", { name: "increase" }).click();
      await expect(kaleRow.locator(".stepper-val")).toHaveValue("2");

      // Drop inventory under the customer's feet — emulates a parallel
      // customer or an admin edit between page render and submit.
      await setProductQty(TEST_PRODUCTS.kale.id, 1);

      await customerPage.locator(".submit-btn").click();
      await customerPage.waitForURL(/\/c\/[^/]+\/confirmed$/);
      await customerCtx.close();

      const sb = admin();
      const ids = await customerIds();
      const { data: order } = await sb
        .from("orders")
        .select("id, needs_reconciliation")
        .eq("customer_id", ids.farmStand)
        .eq("week_of", thisWeek)
        .single();
      expect(order?.needs_reconciliation).toBe(true);

      // Admin orders detail → recon callout + per-line "lb oversold" message.
      const adminCtx = await browser.newContext({ storageState: ADMIN_STORAGE_STATE });
      const adminPage = await adminCtx.newPage();
      await adminPage.goto("/admin/orders");
      const row = adminPage.locator(`tr.ord-row[data-order-id="${order!.id}"]`);
      await row.click();
      const detail = adminPage.locator("tr.ord-detail-row .ord-detail");
      await expect(detail.locator(".callout-warn")).toBeVisible();
      const oversoldLine = detail.locator(".ord-detail-list li.is-oversold");
      await expect(oversoldLine.locator(".ord-li-unit")).toHaveText(/· lb$/);
      // place_order decrements optimistically (DEC-012); inventory was 1
      // base unit at place_order time, the 4-base-unit order (2 lb × conv 2)
      // ran it to -3. The display clamps qty_available to 0 — there's no
      // such thing as "negative lb available." shortBy = (4 - 0) / 2 = 2 lb.
      await expect(oversoldLine.locator(".ord-li-flag")).toHaveText(
        "Only 0 lb available — 2 lb oversold",
      );

      await adminCtx.close();
    });
  });
});
