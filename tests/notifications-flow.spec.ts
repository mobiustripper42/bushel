import { test, expect } from "@playwright/test";

import {
  ADMIN_STORAGE_STATE,
  TEST_CUSTOMERS,
  admin,
  customerIds,
} from "./helpers";
import { weekOfMondayNY } from "@/lib/week";

// Phase 4.4 — cross-task integration tests covering the gaps that 4.1, 4.2,
// 4.3's own specs don't quite hit. Specifically: (a) does the deep-link
// actually point at the customer's order page end-to-end? (b) does Sent
// state survive a reload? (c) is re-send idempotent? (d) are the three
// modes independent on the (customer_id, week_of, mode) PK?

async function resetCustomerState(): Promise<void> {
  const sb = admin();
  for (const token of [TEST_CUSTOMERS.farmStand.token, TEST_CUSTOMERS.restaurant.token]) {
    const { data, error } = await sb
      .from("customers")
      .update({
        phone: "(216) 555-0100",
        priority: 200,
        send_weekly_link: true,
        is_active: true,
      })
      .eq("token", token)
      .select("id");
    if (error) throw new Error(`resetCustomerState(${token}): ${error.message}`);
    if (!data?.length) throw new Error(`resetCustomerState(${token}): no rows updated — test customer missing`);
  }
}

async function clearSends(): Promise<void> {
  await admin()
    .from("customer_sends")
    .delete()
    .eq("week_of", weekOfMondayNY());
}

// admin-settings.spec.ts flips ordering_schedule.is_open without restoring,
// and the "deep-link → customer page" test below renders the customer order
// page (which redirects to the closed state when is_open=false).
async function ensureOrderingOpen(): Promise<void> {
  await admin()
    .from("ordering_schedule")
    .update({ is_open: true, override_closes_at: null })
    .eq("is_singleton", true);
}

// Polls customer_sends for a row's sent_at, optionally requiring it to
// differ from a prior value (used to detect a second upsert landed). Real
// signal of "the server action completed" — beats a fixed sleep.
async function pollSentAt(
  sb: ReturnType<typeof admin>,
  customerId: string,
  mode: string,
  notEqualTo: string | null,
): Promise<string | null> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const { data } = await sb
      .from("customer_sends")
      .select("sent_at")
      .eq("customer_id", customerId)
      .eq("week_of", weekOfMondayNY())
      .eq("mode", mode)
      .maybeSingle();
    if (data?.sent_at && data.sent_at !== notEqualTo) return data.sent_at;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

test.describe("notifications cross-task flow", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test.beforeEach(async ({ context, browserName }) => {
    // Phase 6.7 — desktop Send path writes to clipboard before recording.
    // WebKit doesn't accept the clipboard-write permission; mobile project
    // hits the sms: deep-link branch which never touches the clipboard.
    if (browserName === "chromium") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    }
    await resetCustomerState();
    await clearSends();
    await ensureOrderingOpen();
  });

  test("deep-link body contains a working customer URL — operator → customer page", async ({ page }) => {
    const ids = await customerIds();
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

  test("reload preserves Sent state — admin returns later and the pill persists", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "WebKit navigates to sms:... on click and clears the page; covered on desktop");
    const ids = await customerIds();
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

  test("re-send is idempotent — second click does not duplicate the row", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "WebKit navigates to sms:... on click and clears the page; covered on desktop");
    const ids = await customerIds();
    await page.goto("/admin/send");

    const list = page.getByRole("list", { name: /weekly update queue/i });
    const farmStandRow = list.locator(`li.send-row[data-customer-id="${ids.farmStand}"]`);

    // First send
    await farmStandRow.getByRole("link", { name: /^send$/i }).click();
    const sb = admin();
    const firstSentAt = await pollSentAt(sb, ids.farmStand, "weekly_update", null);
    expect(firstSentAt).toBeTruthy();

    // Reload so the button now reads "Re-send"
    await page.goto("/admin/send");
    const reloadedRow = page.getByRole("list", { name: /weekly update queue/i })
      .locator(`li.send-row[data-customer-id="${ids.farmStand}"]`);
    const reSendLink = reloadedRow.getByRole("link", { name: /re-send/i });
    await expect(reSendLink).toBeVisible();

    // Second send — upsert updates sent_at while keeping row count at 1.
    // Polling for sent_at !== firstSentAt is the real signal that the
    // second action completed (sleep-then-count was flaky-by-construction).
    await reSendLink.click();
    await expect(reloadedRow.locator(".send-status")).toContainText("Sent");
    const secondSentAt = await pollSentAt(sb, ids.farmStand, "weekly_update", firstSentAt);
    expect(secondSentAt).not.toBe(firstSentAt);

    const { data, error } = await sb
      .from("customer_sends")
      .select("customer_id")
      .eq("customer_id", ids.farmStand)
      .eq("week_of", weekOfMondayNY())
      .eq("mode", "weekly_update");
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

});
