import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { ADMIN_STORAGE_STATE, TEST_CUSTOMERS, TEST_PRODUCTS } from "./helpers";
import { weekOfMondayNY } from "@/lib/week";

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

async function clearWeek(weekOf: string): Promise<void> {
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
  status?: "new" | "ready" | "picked-up" | "delivered";
  needsReconciliation?: boolean;
  items: Array<{ productId: string; qty: number; unitPriceCents: number }>;
};

async function seedOrder(input: SeedOrderInput): Promise<string> {
  const sb = admin();
  const { data: order, error: oErr } = await sb
    .from("orders")
    .insert({
      customer_id: input.customerId,
      week_of: input.weekOf,
      fulfillment_type: input.fulfillmentType,
      delivery_address:
        input.fulfillmentType === "delivery" ? "123 Test St" : null,
      delivery_preference:
        input.fulfillmentType === "delivery" ? "Front door" : null,
      status: input.status ?? "new",
      needs_reconciliation: input.needsReconciliation ?? false,
    })
    .select("id")
    .single();
  if (oErr || !order) throw new Error(`seedOrder: ${oErr?.message}`);

  const rows = input.items.map((i) => ({
    order_id: order.id,
    product_id: i.productId,
    qty: i.qty,
    unit_price_cents: i.unitPriceCents,
  }));
  const { error: iErr } = await sb.from("order_items").insert(rows);
  if (iErr) throw new Error(`seedOrder items: ${iErr.message}`);
  return order.id;
}

test.describe("admin orders list", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  const thisWeek = weekOfMondayNY();

  test.beforeEach(async () => {
    await clearWeek(thisWeek);
  });

  test.afterAll(async () => {
    await clearWeek(thisWeek);
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
    await expect(row.locator(".ord-items-count")).toContainText("2");
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
