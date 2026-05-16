import { test, expect, type Download, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  ADMIN_STORAGE_STATE,
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  customerOrderUrl,
  resetCustomerOrderState,
} from "./helpers";
import { weekOfMondayNY } from "@/lib/week";
import { EXPORT_COLUMNS } from "@/lib/admin/export-orders";

// Phase 5.3 — cross-task integration tests covering the gaps that 5.1
// (status UI) and 5.2 (CSV/TSV export) own-specs don't quite hit:
//   (a) end-to-end customer → admin: place an order, see it, advance it,
//       export it
//   (b) reconciliation pin survives sort + week-filter changes together
//   (c) export respects the active week filter

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function customerIds(): Promise<{ farmStand: string; restaurant: string }> {
  const sb = admin();
  const { data, error } = await sb
    .from("customers")
    .select("id, token")
    .in("token", [TEST_CUSTOMERS.farmStand.token, TEST_CUSTOMERS.restaurant.token]);
  if (error || !data) throw new Error(`customerIds: ${error?.message ?? "no rows"}`);
  const map = new Map(data.map((r) => [r.token, r.id]));
  return {
    farmStand: map.get(TEST_CUSTOMERS.farmStand.token)!,
    restaurant: map.get(TEST_CUSTOMERS.restaurant.token)!,
  };
}

async function clearOrdersForWeek(weekOf: string): Promise<void> {
  const sb = admin();
  const ids = await customerIds();
  await sb
    .from("orders")
    .delete()
    .in("customer_id", [ids.farmStand, ids.restaurant])
    .eq("week_of", weekOf);
}

type SeedOrderInput = {
  customerId: string;
  weekOf: string;
  fulfillmentType: "pickup" | "delivery";
  needsReconciliation?: boolean;
  items: Array<{ productId: string; qty: number; unitPriceCents: number }>;
};

async function seedOrder(input: SeedOrderInput): Promise<string> {
  const sb = admin();
  const { data: order, error } = await sb
    .from("orders")
    .insert({
      customer_id: input.customerId,
      week_of: input.weekOf,
      fulfillment_type: input.fulfillmentType,
      delivery_address: input.fulfillmentType === "delivery" ? "123 Test St" : null,
      status: "new",
      needs_reconciliation: input.needsReconciliation ?? false,
    })
    .select("id")
    .single();
  if (error || !order) throw new Error(`seedOrder: ${error?.message}`);
  await sb.from("order_items").insert(
    input.items.map((i) => ({
      order_id: order.id,
      product_id: i.productId,
      qty: i.qty,
      unit_price_cents: i.unitPriceCents,
    })),
  );
  return order.id;
}

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

    // Export → CSV contains the just-placed order's line item
    await adminPage.getByRole("button", { name: /export to wave/i }).click();
    const [download] = await Promise.all([
      adminPage.waitForEvent("download"),
      adminPage.getByRole("button", { name: /download csv/i }).click(),
    ]);
    const text = await readDownloadText(download);
    const lines = text.split("\r\n");
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","));
    // First 12 chars of the order id is the invoice number
    const invoiceNumber = orderId.slice(0, 12);
    const kaleLine = lines.find((l) => l.startsWith(invoiceNumber));
    expect(kaleLine).toBeTruthy();
    expect(kaleLine).toContain(TEST_CUSTOMERS.farmStand.name);
    expect(kaleLine).toContain(TEST_PRODUCTS.kale.name);
    expect(kaleLine).toContain(",2,3.00,bunch,,");

    await adminCtx.close();
  });

  test("reconciliation pin holds across both column sort and week filter changes", async ({
    browser,
  }) => {
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
    const thisWeekOrderId = await seedOrder({
      customerId: ids.farmStand,
      weekOf: thisWeek,
      fulfillmentType: "delivery",
      items: [{ productId: TEST_PRODUCTS.kale.id, qty: 3, unitPriceCents: 300 }],
    });
    const lastWeekOrderId = await seedOrder({
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
    expect(thisText).toContain(thisWeekOrderId.slice(0, 12));
    expect(thisText).not.toContain(lastWeekOrderId.slice(0, 12));
    expect(thisText).toContain(TEST_CUSTOMERS.farmStand.name);
    expect(thisText).not.toContain(TEST_CUSTOMERS.restaurant.name);

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
    expect(lastText).toContain(lastWeekOrderId.slice(0, 12));
    expect(lastText).not.toContain(thisWeekOrderId.slice(0, 12));
    expect(lastText).toContain(TEST_CUSTOMERS.restaurant.name);
    expect(lastText).not.toContain(TEST_CUSTOMERS.farmStand.name);

    await adminCtx.close();
  });
});
