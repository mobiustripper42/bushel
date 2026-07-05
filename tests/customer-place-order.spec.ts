import { test, expect, type Page } from "@playwright/test";
import { weekOfMondayNY } from "@/lib/week";
import { query } from "@/lib/db";
import {
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  customerOrderUrl,
  resetCustomerOrderState,
  setProductQty,
} from "./helpers";

async function getCustomerId(token: string): Promise<string> {
  const rows = await query<{ id: string }>(
    `select id from customers where token = $1`,
    [token],
  );
  if (!rows[0]) throw new Error(`Could not resolve customer ${token}`);
  return rows[0].id;
}

// Bumps the stepper on a named product to qty without relying on press-and-hold.
async function stepUp(page: Page, productName: string, qty: number) {
  const row = page.locator(".item-row", { hasText: productName });
  for (let i = 0; i < qty; i++) {
    await row.getByRole("button", { name: "increase" }).click();
  }
}

test.describe("/c/[token] place order", () => {
  test.beforeEach(async () => {
    await resetCustomerOrderState();
  });

  // Without this, the last "happy path" test leaves a freshly-placed order
  // for the seeded farmStand customer. The next spec to alphabetically
  // follow (notifications-flow.spec.ts) opens /c/<token> and expects to see
  // the "What's available" heading — but the /c page renders an open order
  // as the pre-populated add-mode form (DEC-041), so the assertion times
  // out. resetCustomerOrderState clears it.
  test.afterAll(async () => {
    await resetCustomerOrderState();
  });

  test("happy path: submit creates an order + decrements inventory, lands on confirmed", async ({
    page,
  }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await stepUp(page, TEST_PRODUCTS.kale.name, 2);
    await stepUp(page, TEST_PRODUCTS.eggs.name, 1);

    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    await expect(
      page.getByRole("heading", { name: /Order received/i }),
    ).toBeVisible();
    await expect(page.locator(".confirm-list")).toContainText(TEST_PRODUCTS.kale.name);
    await expect(page.locator(".confirm-list")).toContainText(TEST_PRODUCTS.eggs.name);
    // 2×$3.00 + 1×$6.00 = $12.00
    await expect(page.locator(".confirm-total")).toContainText("12.00");

    const farmStandId = await getCustomerId(TEST_CUSTOMERS.farmStand.token);
    const orderRows = await query<{
      id: string;
      needs_reconciliation: boolean;
      fulfillment_type: string;
    }>(
      `select id, needs_reconciliation, fulfillment_type
         from orders where customer_id = $1 and week_of = $2`,
      [farmStandId, weekOfMondayNY()],
    );
    const order = orderRows[0] ?? null;
    expect(order?.needs_reconciliation).toBe(false);
    expect(order?.fulfillment_type).toBe("delivery");

    const kaleRows = await query<{ qty_available: number }>(
      `select qty_available from products where id = $1`,
      [TEST_PRODUCTS.kale.id],
    );
    const kale = kaleRows[0] ?? null;
    expect(kale?.qty_available).toBe(TEST_PRODUCTS.kale.qty_available - 2);
  });

  // #149 — a successful submit clears the persisted cart draft, so a back-nav
  // to /c/[token] (or any later visit in the same tab) doesn't resurrect a
  // stale cart on top of the now-placed order.
  test("submit clears the persisted cart draft", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await stepUp(page, TEST_PRODUCTS.kale.name, 1);

    // Draft exists while ordering.
    const draftBefore = await page.evaluate(() =>
      Object.keys(sessionStorage).filter((k) => k.startsWith("bushel:cart:")),
    );
    expect(draftBefore.length).toBe(1);

    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    // sessionStorage survives the same-tab nav to /confirmed; the key is gone.
    const draftAfter = await page.evaluate(() =>
      Object.keys(sessionStorage).filter((k) => k.startsWith("bushel:cart:")),
    );
    expect(draftAfter.length).toBe(0);
  });

  // #149 — a FAILED submit must restore the optimistically-cleared draft and
  // re-enable persistence, so a rotation after a failed submit still keeps the
  // cart and later edits keep persisting. Uses the DEC-036 sold-out rejection
  // as the failure trigger.
  test("failed submit restores the draft and re-enables persistence", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await stepUp(page, TEST_PRODUCTS.eggs.name, 1);

    // Eggs sell out under them → submit is rejected (DEC-036), no redirect.
    await setProductQty(TEST_PRODUCTS.eggs.id, 0);
    await page.locator(".submit-btn").click();
    await expect(page.locator(".submit-error")).toContainText(/sold out/i);

    // Draft restored after the failed submit (not left cleared).
    const restored = await page.evaluate(() =>
      Object.keys(sessionStorage).filter((k) => k.startsWith("bushel:cart:")),
    );
    expect(restored.length).toBe(1);

    // Persistence re-enabled: a subsequent edit re-writes the draft.
    await stepUp(page, TEST_PRODUCTS.kale.name, 1);
    const draft = await page.evaluate(() => {
      const key = Object.keys(sessionStorage).find((k) => k.startsWith("bushel:cart:"));
      return key ? sessionStorage.getItem(key) : null;
    });
    expect(draft).toContain(TEST_PRODUCTS.kale.id);
  });

  test("oversold qty sets needs_reconciliation = true (DEC-012)", async ({
    page,
  }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

    // Type a qty above what's available — clamps at qty_available on blur (10),
    // so we additionally drop seed inventory under their fingertips before submit.
    const eggsRow = page.locator(".item-row", { hasText: TEST_PRODUCTS.eggs.name });
    const eggsInput = eggsRow.locator(".stepper-val");
    await eggsInput.click();
    await eggsInput.press("ControlOrMeta+A");
    await eggsInput.pressSequentially("5"); // max for eggs in seed
    await eggsInput.blur();

    // Sneak in a stock cut so the submit will oversell by 4.
    await query(`update products set qty_available = 1 where id = $1`, [
      TEST_PRODUCTS.eggs.id,
    ]);

    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    const farmStandId = await getCustomerId(TEST_CUSTOMERS.farmStand.token);
    const orderRows = await query<{ needs_reconciliation: boolean }>(
      `select needs_reconciliation
         from orders where customer_id = $1 and week_of = $2`,
      [farmStandId, weekOfMondayNY()],
    );
    const order = orderRows[0] ?? null;
    expect(order?.needs_reconciliation).toBe(true);

    const eggsRows = await query<{ qty_available: number }>(
      `select qty_available from products where id = $1`,
      [TEST_PRODUCTS.eggs.id],
    );
    const eggs = eggsRows[0] ?? null;
    expect(eggs?.qty_available).toBe(-4);
  });

  test("revisiting /c/[token] after submit shows the open order pre-populated (no empty form)", async ({
    page,
  }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await stepUp(page, TEST_PRODUCTS.kale.name, 1);
    await page.locator(".submit-btn").click();
    await page.waitForURL(/\/c\/[^/]+\/confirmed$/);

    // DEC-041 (#227): the link renders the OPEN order editable — revisiting
    // after submit shows the add-mode form pre-populated with what was
    // ordered, never an empty form and never a bounce. A second submit with
    // NEW items APPENDS to the same order row (the true no-op is a
    // same-submission_id replay — pgTAP place_order_additive.sql).
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await expect(
      page.getByRole("heading", { name: "Going with your order" }),
    ).toBeVisible();
    await expect(page.locator(".rail-existing:visible")).toContainText(
      TEST_PRODUCTS.kale.name,
    );
    await expect(page.locator(".submit-btn")).toHaveText("Update order");

    // And exactly one OPEN orders row exists — the partial unique index
    // (orders_one_open_per_customer) makes a second one impossible.
    // (Status-filtered so the global-setup delivered fixture doesn't
    // inflate the count.)
    const farmStandId = await getCustomerId(TEST_CUSTOMERS.farmStand.token);
    const orders = await query<{ id: string }>(
      `select id from orders where customer_id = $1 and status = any($2)`,
      [farmStandId, ["new", "confirmed", "ready"]],
    );
    expect(orders).toHaveLength(1);
  });
});
