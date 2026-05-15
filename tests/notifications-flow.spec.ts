import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { ADMIN_STORAGE_STATE, TEST_CUSTOMERS } from "./helpers";
import { weekOfMondayNY } from "@/lib/week";

// Phase 4.4 — cross-task integration tests covering the gaps that 4.1, 4.2,
// 4.3's own specs don't quite hit. Specifically: (a) does the deep-link
// actually point at the customer's order page end-to-end? (b) does Sent
// state survive a reload? (c) is re-send idempotent? (d) are the three
// modes independent on the (customer_id, week_of, mode) PK?

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function testCustomerIds(): Promise<{ farmStand: string; restaurant: string }> {
  const sb = admin();
  const { data, error } = await sb
    .from("customers")
    .select("id, token")
    .in("token", [TEST_CUSTOMERS.farmStand.token, TEST_CUSTOMERS.restaurant.token]);
  if (error || !data) throw new Error(`testCustomerIds: ${error?.message ?? "no rows"}`);
  const map = new Map(data.map((r) => [r.token, r.id]));
  return {
    farmStand: map.get(TEST_CUSTOMERS.farmStand.token)!,
    restaurant: map.get(TEST_CUSTOMERS.restaurant.token)!,
  };
}

async function resetCustomerState(): Promise<void> {
  const sb = admin();
  for (const token of [TEST_CUSTOMERS.farmStand.token, TEST_CUSTOMERS.restaurant.token]) {
    await sb
      .from("customers")
      .update({
        phone: "(216) 555-0100",
        priority: 200,
        send_weekly_link: true,
        is_active: true,
      })
      .eq("token", token);
  }
}

async function clearSends(): Promise<void> {
  await admin()
    .from("customer_sends")
    .delete()
    .eq("week_of", weekOfMondayNY());
}

async function clearOrdersFor(customerId: string): Promise<void> {
  await admin()
    .from("orders")
    .delete()
    .eq("customer_id", customerId)
    .eq("week_of", weekOfMondayNY());
}

async function ensureDeliveryOrder(token: string): Promise<void> {
  const sb = admin();
  const { data } = await sb
    .from("customers")
    .select("id, delivery_address")
    .eq("token", token)
    .single();
  if (!data) throw new Error(`customer ${token} not found`);
  await sb.from("orders").upsert(
    {
      customer_id: data.id,
      week_of: weekOfMondayNY(),
      fulfillment_type: "delivery",
      delivery_address: data.delivery_address,
      delivery_preference: "Back door, gate code 4321",
      pickup_note: null,
      status: "new",
    },
    { onConflict: "customer_id,week_of" },
  );
}

test.describe("notifications cross-task flow", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test.beforeEach(async () => {
    await resetCustomerState();
    await clearSends();
  });

  test("deep-link body contains a working customer URL — operator → customer page", async ({ page }) => {
    const ids = await testCustomerIds();
    await page.goto("/admin/send");

    // Extract the sms: href for our test customer
    const list = page.getByRole("list", { name: /weekly update queue/i });
    const farmStandRow = list.locator(`li.send-row[data-customer-id="${ids.farmStand}"]`);
    const href = await farmStandRow.getByRole("link", { name: /^send$/i }).getAttribute("href");
    expect(href).toBeTruthy();

    // The body is everything after ?body= — decode it and pull out the
    // customer URL that ends the message. Template puts it on the last line.
    const encodedBody = href!.split("?body=")[1];
    const decodedBody = decodeURIComponent(encodedBody);
    const urlMatch = decodedBody.match(/https?:\/\/[^\s]+\/c\/[a-zA-Z0-9-]+/);
    expect(urlMatch).toBeTruthy();
    const orderUrlFromLink = urlMatch![0];
    expect(orderUrlFromLink).toContain(`/c/${TEST_CUSTOMERS.farmStand.token}`);

    // Navigate to the same /c/<token> path as the customer would after
    // tapping the link. Use the path only — base URL in the deep link is
    // prod (NEXT_PUBLIC_APP_URL fallback), test runs on localhost. Drop
    // the admin storage state so we hit the customer flow, not the admin
    // identity (the customer route sets its own cookie from the token).
    const orderPath = new URL(orderUrlFromLink).pathname;
    const customerCtx = await page.context().browser()!.newContext();
    const customerPage = await customerCtx.newPage();
    await customerPage.goto(`${page.url().split("/admin")[0]}${orderPath}`);
    await expect(customerPage).toHaveURL(new RegExp(`/c/${TEST_CUSTOMERS.farmStand.token}`));
    await expect(customerPage.getByRole("heading", { name: /what.s available/i })).toBeVisible({ timeout: 5000 });
    await expect(customerPage.getByText(TEST_CUSTOMERS.farmStand.name)).toBeVisible();
    await customerCtx.close();
  });

  test("reload preserves Sent state — admin returns later and the pill persists", async ({ page }) => {
    const ids = await testCustomerIds();
    await page.goto("/admin/send");

    const list = page.getByRole("list", { name: /weekly update queue/i });
    const farmStandRow = list.locator(`li.send-row[data-customer-id="${ids.farmStand}"]`);

    await expect(farmStandRow).toHaveAttribute("data-sent", "false");
    await farmStandRow.getByRole("link", { name: /^send$/i }).click();
    await expect(farmStandRow.locator(".send-status")).toContainText("Sent", { timeout: 5000 });

    // Wait for the DB row to land (optimistic flip happens before action completes)
    const sb = admin();
    await expect
      .poll(async () => {
        const { data } = await sb
          .from("customer_sends")
          .select("customer_id")
          .eq("customer_id", ids.farmStand)
          .eq("week_of", weekOfMondayNY())
          .eq("mode", "weekly_update");
        return data?.length ?? 0;
      }, { timeout: 5000 })
      .toBe(1);

    // Hard navigate (not page.reload — we want a full fresh fetch path).
    await page.goto("/admin/send");
    const reloadedRow = page.getByRole("list", { name: /weekly update queue/i })
      .locator(`li.send-row[data-customer-id="${ids.farmStand}"]`);
    await expect(reloadedRow).toHaveAttribute("data-sent", "true");
    await expect(reloadedRow.locator(".send-status")).toContainText("Sent");
    await expect(reloadedRow.getByRole("link", { name: /re-send/i })).toBeVisible();
  });

  test("re-send is idempotent — second click does not duplicate the row", async ({ page }) => {
    const ids = await testCustomerIds();
    await page.goto("/admin/send");

    const list = page.getByRole("list", { name: /weekly update queue/i });
    const farmStandRow = list.locator(`li.send-row[data-customer-id="${ids.farmStand}"]`);

    // First send
    await farmStandRow.getByRole("link", { name: /^send$/i }).click();
    const sb = admin();
    await expect
      .poll(async () => {
        const { data } = await sb
          .from("customer_sends")
          .select("customer_id")
          .eq("customer_id", ids.farmStand)
          .eq("week_of", weekOfMondayNY())
          .eq("mode", "weekly_update");
        return data?.length ?? 0;
      }, { timeout: 5000 })
      .toBe(1);

    // Reload so the button now reads "Re-send"
    await page.goto("/admin/send");
    const reloadedRow = page.getByRole("list", { name: /weekly update queue/i })
      .locator(`li.send-row[data-customer-id="${ids.farmStand}"]`);
    const reSendLink = reloadedRow.getByRole("link", { name: /re-send/i });
    await expect(reSendLink).toBeVisible();

    // Second send — upsert keeps the row count at 1
    await reSendLink.click();
    await expect(reloadedRow.locator(".send-status")).toContainText("Sent");

    // Give the second action time to complete, then re-count
    await page.waitForTimeout(500);
    const { data, error } = await sb
      .from("customer_sends")
      .select("customer_id, sent_at")
      .eq("customer_id", ids.farmStand)
      .eq("week_of", weekOfMondayNY())
      .eq("mode", "weekly_update");
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  test("mode independence — sent in weekly_update does not bleed into order_confirmation", async ({ page }) => {
    const ids = await testCustomerIds();

    // Seed an order so the customer appears in order_confirmation mode too
    await clearOrdersFor(ids.farmStand);
    await ensureDeliveryOrder(TEST_CUSTOMERS.farmStand.token);

    // Mark sent in weekly_update mode
    await page.goto("/admin/send");
    const weeklyList = page.getByRole("list", { name: /weekly update queue/i });
    const weeklyRow = weeklyList.locator(`li.send-row[data-customer-id="${ids.farmStand}"]`);
    await weeklyRow.getByRole("link", { name: /^send$/i }).click();
    await expect(weeklyRow).toHaveAttribute("data-sent", "true", { timeout: 5000 });

    // Switch to order_confirmation mode — same customer should appear unsent
    await page.goto("/admin/send?mode=order_confirmation");
    const confirmList = page.getByRole("list", { name: /order confirmation queue/i });
    const confirmRow = confirmList.locator(`li.send-row[data-customer-id="${ids.farmStand}"]`);
    await expect(confirmRow).toHaveCount(1);
    await expect(confirmRow).toHaveAttribute("data-sent", "false");
    await expect(confirmRow.locator(".send-status")).toHaveText("Unsent");

    // DB sanity — only one customer_sends row, in weekly_update
    const sb = admin();
    const { data: rows } = await sb
      .from("customer_sends")
      .select("mode")
      .eq("customer_id", ids.farmStand)
      .eq("week_of", weekOfMondayNY());
    expect(rows?.map((r) => r.mode).sort()).toEqual(["weekly_update"]);

    // cleanup
    await clearOrdersFor(ids.farmStand);
  });
});
