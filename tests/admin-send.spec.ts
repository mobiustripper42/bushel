import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { ADMIN_STORAGE_STATE, TEST_CUSTOMERS } from "./helpers";
import { weekOfMondayNY } from "@/lib/week";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Dev/preview DB carries real data and historical test artifacts; multiple
// customers may share the same display name. Filter rows by data-customer-id
// instead of visible text. Resolved once per test from the seeded tokens.
async function testCustomerIds(): Promise<{ farmStand: string; restaurant: string }> {
  const sb = admin();
  const { data: rows, error } = await sb
    .from("customers")
    .select("id, token")
    .in("token", [TEST_CUSTOMERS.farmStand.token, TEST_CUSTOMERS.restaurant.token]);
  if (error || !rows) throw new Error(`testCustomerIds: ${error?.message ?? "no rows"}`);
  const map = new Map(rows.map((r) => [r.token, r.id]));
  return {
    farmStand: map.get(TEST_CUSTOMERS.farmStand.token)!,
    restaurant: map.get(TEST_CUSTOMERS.restaurant.token)!,
  };
}

async function clearSends(): Promise<void> {
  const sb = admin();
  const weekOf = weekOfMondayNY();
  await sb.from("customer_sends").delete().eq("week_of", weekOf);
}

async function clearIntroNote(): Promise<void> {
  const sb = admin();
  await sb.from("ordering_schedule").update({ intro_note: null }).eq("is_singleton", true);
}

async function ensureOrderForCustomer(token: string): Promise<void> {
  const sb = admin();
  const { data: customer } = await sb
    .from("customers")
    .select("id, delivery_address")
    .eq("token", token)
    .single();
  if (!customer) throw new Error(`customer ${token} not found`);
  const weekOf = weekOfMondayNY();
  await sb.from("orders").upsert(
    {
      customer_id: customer.id,
      week_of: weekOf,
      fulfillment_type: "delivery",
      delivery_address: customer.delivery_address,
      delivery_preference: "Back door, gate code 4321",
      pickup_note: null,
      status: "new",
    },
    { onConflict: "customer_id,week_of" },
  );
}

async function clearCurrentWeekOrders(): Promise<void> {
  const sb = admin();
  const weekOf = weekOfMondayNY();
  for (const c of Object.values(TEST_CUSTOMERS)) {
    const { data } = await sb
      .from("customers")
      .select("id")
      .eq("token", c.token)
      .maybeSingle();
    if (data?.id) {
      await sb
        .from("orders")
        .delete()
        .eq("customer_id", data.id)
        .eq("week_of", weekOf);
    }
  }
}

// Restores the seeded test customers to the state this spec expects. Other
// admin specs may mutate these rows (admin-customers' "subscribed switch"
// test flips send_weekly_link without restoring), so we re-establish phones,
// priorities, subscribed state, and is_active each time.
async function ensureTestCustomerState(): Promise<void> {
  const sb = admin();
  await sb
    .from("customers")
    .update({
      phone: "(216) 555-0100",
      priority: 200,
      send_weekly_link: true,
      is_active: true,
    })
    .eq("token", TEST_CUSTOMERS.farmStand.token);
  await sb
    .from("customers")
    .update({
      phone: "(216) 555-0200",
      priority: 100,
      send_weekly_link: true,
      is_active: true,
    })
    .eq("token", TEST_CUSTOMERS.restaurant.token);
}

test.describe("admin send-queue", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test.beforeEach(async () => {
    await ensureTestCustomerState();
    await clearSends();
    await clearIntroNote();
  });

  test.afterAll(async () => {
    await clearSends();
    await clearCurrentWeekOrders();
    await clearIntroNote();
  });

  test("weekly_update: lists subscribers in priority order with sms: deep links", async ({ page }) => {
    const ids = await testCustomerIds();
    await page.goto("/admin/send");

    const list = page.getByRole("list", { name: /weekly update queue/i });
    const farmStandRow = list.locator(`li.send-row[data-customer-id="${ids.farmStand}"]`);
    const restaurantRow = list.locator(`li.send-row[data-customer-id="${ids.restaurant}"]`);
    await expect(farmStandRow).toHaveCount(1);
    await expect(restaurantRow).toHaveCount(1);

    // priority order — farm stand (200) appears in DOM before restaurant (100)
    const allIds = await list.locator("li.send-row").evaluateAll((els) =>
      (els as HTMLElement[]).map((el) => el.dataset.customerId ?? ""),
    );
    const farmIdx = allIds.indexOf(ids.farmStand);
    const restIdx = allIds.indexOf(ids.restaurant);
    expect(farmIdx).toBeGreaterThanOrEqual(0);
    expect(restIdx).toBeGreaterThan(farmIdx);

    // sms: href is well-formed for the farm stand row
    const href = await farmStandRow
      .getByRole("link", { name: /^send$/i })
      .getAttribute("href");
    expect(href).toMatch(/^sms:\+?\d+\?body=/);
    expect(href).toContain("Bay%20Branch%20Farm");
    expect(href).toContain(TEST_CUSTOMERS.farmStand.token);
  });

  test("weekly_update: clicking Send records the send and flips the status pill", async ({ page }) => {
    const ids = await testCustomerIds();
    await page.goto("/admin/send");

    const list = page.getByRole("list", { name: /weekly update queue/i });
    const farmStandRow = list.locator(`li.send-row[data-customer-id="${ids.farmStand}"]`);

    await expect(farmStandRow.locator(".send-status")).toHaveText("Unsent");
    await expect(farmStandRow).toHaveAttribute("data-sent", "false");

    // The sms: scheme has no handler in headless Chromium, so the browser
    // ignores the navigation but still fires onClick — which posts to the
    // server action and updates state.
    await farmStandRow.getByRole("link", { name: /^send$/i }).click();

    await expect(farmStandRow.locator(".send-status")).toContainText("Sent", { timeout: 5000 });
    await expect(farmStandRow).toHaveAttribute("data-sent", "true");

    // DB side. The pill flips optimistically before the server action
    // completes, so poll for the actual row insertion.
    const sb = admin();
    await expect
      .poll(
        async () => {
          const { data } = await sb
            .from("customer_sends")
            .select("customer_id")
            .eq("customer_id", ids.farmStand)
            .eq("week_of", weekOfMondayNY())
            .eq("mode", "weekly_update");
          return data?.length ?? 0;
        },
        { timeout: 5000 },
      )
      .toBe(1);
  });

  test("intro note saves and is injected into the weekly_update body", async ({ page }) => {
    const ids = await testCustomerIds();
    await page.goto("/admin/send");

    const textarea = page.getByLabel(/this week.+intro note/i);
    await textarea.fill("Sungolds are exceptional this week.");
    await page.getByRole("button", { name: /save intro/i }).click();

    await expect(page.getByText(/^Saved$/i)).toBeVisible({ timeout: 5000 });

    // Reload — value persists
    await page.reload();
    await expect(page.getByLabel(/this week.+intro note/i)).toHaveValue(
      "Sungolds are exceptional this week.",
    );

    // Farm stand row's sms href now contains the intro
    const list = page.getByRole("list", { name: /weekly update queue/i });
    const farmStandRow = list.locator(`li.send-row[data-customer-id="${ids.farmStand}"]`);
    const href = await farmStandRow
      .getByRole("link", { name: /^send$/i })
      .getAttribute("href");
    expect(href).toContain("Sungolds%20are%20exceptional%20this%20week.");
  });

  test("order_confirmation mode: only customers with current-week orders appear", async ({ page }) => {
    const ids = await testCustomerIds();
    await clearCurrentWeekOrders();
    await ensureOrderForCustomer(TEST_CUSTOMERS.farmStand.token);

    await page.goto("/admin/send?mode=order_confirmation");

    const list = page.getByRole("list", { name: /order confirmation queue/i });
    const farmStandRow = list.locator(`li.send-row[data-customer-id="${ids.farmStand}"]`);
    const restaurantRow = list.locator(`li.send-row[data-customer-id="${ids.restaurant}"]`);

    // farmStand has an order this week (we just created one); restaurant does
    // not. Other dev-DB customers may or may not appear — we only assert what
    // we control.
    await expect(farmStandRow).toHaveCount(1);
    await expect(restaurantRow).toHaveCount(0);

    // sms href reflects the delivery confirmation template
    const href = await farmStandRow
      .getByRole("link", { name: /^send$/i })
      .getAttribute("href");
    expect(href).toContain("Delivery%20note");
    expect(href).toContain("gate%20code%204321");
  });

  test("pickup_reminder mode: same order-bound customer set, different body", async ({ page }) => {
    const ids = await testCustomerIds();
    await clearCurrentWeekOrders();
    await ensureOrderForCustomer(TEST_CUSTOMERS.farmStand.token);

    await page.goto("/admin/send?mode=pickup_reminder");

    const list = page.getByRole("list", { name: /pickup reminder queue/i });
    const farmStandRow = list.locator(`li.send-row[data-customer-id="${ids.farmStand}"]`);
    await expect(farmStandRow).toHaveCount(1);

    const href = await farmStandRow
      .getByRole("link", { name: /^send$/i })
      .getAttribute("href");
    expect(href).toContain("reminder");
    expect(href).toContain("ready%20for%20pickup");

    // clicking Send works in this mode too
    await farmStandRow.getByRole("link", { name: /^send$/i }).click();
    await expect(farmStandRow.locator(".send-status")).toContainText("Sent", {
      timeout: 5000,
    });
  });
});
