import { test, expect } from "@playwright/test";

import {
  ADMIN_STORAGE_STATE,
  TEST_CUSTOMERS,
  admin,
  customerIds,
} from "./helpers";
import { weekOfMondayNY } from "@/lib/week";

async function clearSends(): Promise<void> {
  const sb = admin();
  const weekOf = weekOfMondayNY();
  await sb.from("customer_sends").delete().eq("week_of", weekOf);
}

async function clearIntroNote(): Promise<void> {
  const sb = admin();
  await sb.from("ordering_schedule").update({ intro_note: null }).eq("is_singleton", true);
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

  test.beforeEach(async ({ context, browserName }) => {
    // Phase 6.7 — on desktop the Send button writes the SMS body to the
    // clipboard before recording the send. Without these permissions the
    // clipboard write throws and the send is intentionally NOT recorded
    // (the operator sees an error and retries), which breaks every test
    // here that asserts the Sent pill flip after clicking Send.
    //
    // WebKit doesn't support the clipboard-write permission name, but the
    // mobile project's tests go down the sms: deep-link path anyway, so
    // clipboard isn't needed there.
    if (browserName === "chromium") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    }
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
    const ids = await customerIds();
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

  test("weekly_update: clicking Send records the send and flips the status pill", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile",
      "WebKit navigates to sms:... on click and clears the page; onClick fires (server action runs) but the DOM is gone before the optimistic Sent pill can be asserted. Headless Chromium ignores the sms: navigation, so desktop covers this code path.",
    );
    const ids = await customerIds();
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

  test("desktop: clicking Send postMessages the extension and copies the body to clipboard", async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Desktop-only path (Phase 6.7). Mobile uses the sms: deep link directly.");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const ids = await customerIds();
    await page.goto("/admin/send");

    const list = page.getByRole("list", { name: /weekly update queue/i });
    const farmStandRow = list.locator(`li.send-row[data-customer-id="${ids.farmStand}"]`);
    await expect(farmStandRow.locator(".send-status")).toHaveText("Unsent");

    // Pull the body the row will copy by decoding it out of the sms: href.
    const href = (await farmStandRow.getByRole("link", { name: /^send$/i }).getAttribute("href")) ?? "";
    const bodyEncoded = href.split("?body=")[1] ?? "";
    const expectedBody = decodeURIComponent(bodyEncoded);
    expect(expectedBody).toContain("Bay Branch Farm");

    // Install a listener on the admin page BEFORE clicking so we can capture
    // the postMessage the desktop path fires. The Bushel SMS Helper extension
    // (when installed) bridges this to its service worker, which then opens /
    // focuses the MWS tab via chrome.tabs. CI doesn't have the extension, so
    // no popup will appear — we just verify the bridge contract.
    const messagePromise = page.evaluate(() => {
      return new Promise<{ phone: string; body: string }>((resolve) => {
        window.addEventListener("message", (ev) => {
          if (ev.data?.type === "bushel-sms-helper:fill") {
            resolve({ phone: ev.data.phone, body: ev.data.body });
          }
        });
      });
    });

    await farmStandRow.getByRole("link", { name: /^send$/i }).click();

    const posted = await messagePromise;
    expect(posted.body).toBe(expectedBody);
    expect(posted.phone).toBeTruthy();

    // Clipboard contains the body as a fallback for no-extension operators.
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(expectedBody);

    // Copied indicator + Sent pill flip.
    await expect(farmStandRow.locator(".send-row-copied")).toBeVisible();
    await expect(farmStandRow.locator(".send-status")).toContainText("Sent", { timeout: 5000 });
    await expect(farmStandRow).toHaveAttribute("data-sent", "true");

    // DB confirmation.
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
    const ids = await customerIds();
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

  test("weekly-only: title reads 'Send Texts' and no mode tabs render (#189)", async ({ page }) => {
    await customerIds();
    await page.goto("/admin/send");

    await expect(page.locator(".send-title")).toHaveText("Send Texts");
    // The confirmation/reminder mode tabs are gone — they moved to the Orders page.
    await expect(page.locator(".send-mode-tabs")).toHaveCount(0);
    await expect(page.getByText("Order confirmation")).toHaveCount(0);
    await expect(page.getByText("Pickup reminder")).toHaveCount(0);
  });

  test("mobile (375px): page fits viewport; Send button is touch-sized; drawer opens and closes", async ({ page, viewport }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only assertions; covered on the mobile project.");
    await customerIds();
    await page.goto("/admin/send");

    // (a) No horizontal overflow at the iPhone-13 width — shell + page combined
    // fit the viewport because the admin sidebar collapses into a drawer on
    // mobile (Phase 6.4/DEC-034). 1px tolerance for WebKit sub-pixel rounding.
    const vw = viewport!.width;
    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(docWidth).toBeLessThanOrEqual(vw + 1);

    // (b) Send button is ≥44px tall (Apple HIG / WCAG 2.5.5). Same row used by
    // operator on every tap; the rest of the queue mirrors this row's layout.
    const sendLink = page.locator("li.send-row").first().getByRole("link", { name: /^send$/i });
    const box = await sendLink.boundingBox();
    expect(box, "Send link should be visible").not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // (c) Hamburger opens the drawer; nav link inside is reachable; close button closes it.
    await expect(page.locator(".admin-side")).not.toBeVisible();
    await page.getByRole("button", { name: /open navigation/i }).click();
    const drawer = page.locator(".admin-mobile-drawer.is-open");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: /inventory/i })).toBeVisible();
    await page.getByRole("button", { name: /close navigation/i }).click();
    await expect(page.locator(".admin-mobile-drawer.is-open")).toHaveCount(0);
  });
});
