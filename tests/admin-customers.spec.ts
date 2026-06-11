import { test, expect, type Page } from "@playwright/test";
import {
  ADMIN_STORAGE_STATE,
  TEST_CUSTOMERS,
  admin,
} from "./helpers";

async function resetTestCustomers() {
  const supabase = admin();
  for (const token of [TEST_CUSTOMERS.farmStand.token, TEST_CUSTOMERS.restaurant.token]) {
    await supabase
      .from("customers")
      .update({
        business_name: null,
        email: null,
        phone: null,
        delivery_address: null,
        is_active: true,
        send_weekly_link: true,
        priority: 100,
      })
      .eq("token", token);
  }
  // Drop any non-seed customers created by tests
  await supabase
    .from("customers")
    .delete()
    .not("token", "in", `(${[TEST_CUSTOMERS.farmStand.token, TEST_CUSTOMERS.restaurant.token].map((t) => `"${t}"`).join(",")})`);
}

function rowByName(page: Page, name: string) {
  return page.locator(`tr[data-row-name="${name}"]`);
}

function drawer(page: Page) {
  return page.getByRole("dialog");
}

test.describe("admin customers", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test.beforeEach(async () => {
    await resetTestCustomers();
  });

  test("renders header and seed customers", async ({ page }) => {
    await page.goto("/admin/customers");
    await expect(page.getByRole("heading", { name: /customers/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /add customer/i })).toBeVisible();
    await expect(rowByName(page, TEST_CUSTOMERS.farmStand.name)).toBeVisible();
    await expect(rowByName(page, TEST_CUSTOMERS.restaurant.name)).toBeVisible();
  });

  test("Add customer drawer requires phone", async ({ page }) => {
    await page.goto("/admin/customers");
    await page.getByRole("button", { name: /add customer/i }).click();
    await expect(drawer(page)).toBeVisible();

    await drawer(page).getByLabel("Customer name").fill("No Phone LLC");
    await drawer(page).getByLabel("Email").fill("noPhone@example.com");
    await drawer(page).getByRole("button", { name: /add customer/i }).click();

    await expect(drawer(page).getByRole("alert")).toContainText(/phone is required/i);
    // Drawer stays open
    await expect(drawer(page)).toBeVisible();
  });

  test("creates a new customer and shows it in the list", async ({ page }) => {
    const uniqueName = `Playwright Customer ${Date.now()}`;
    await page.goto("/admin/customers");
    await page.getByRole("button", { name: /add customer/i }).click();

    await drawer(page).getByLabel("Customer name").fill(uniqueName);
    await drawer(page).getByLabel(/phone/i).fill("216-555-0150");
    await drawer(page).getByLabel("Priority").fill("50");
    await drawer(page).getByRole("button", { name: /add customer/i }).click();

    await expect(drawer(page)).toHaveCount(0);
    await expect(rowByName(page, uniqueName)).toBeVisible();
  });

  test("Hide customer deactivates and drops the row from the list", async ({ page }) => {
    // Seed phone so beforeEach-cleaned customer can be edited
    const supabase = admin();
    await supabase.from("customers").update({ phone: "216-555-0100" }).eq("token", TEST_CUSTOMERS.restaurant.token);

    await page.goto("/admin/customers");
    await rowByName(page, TEST_CUSTOMERS.restaurant.name).click();
    await expect(drawer(page)).toBeVisible();
    await drawer(page).getByRole("button", { name: /hide customer/i }).click();
    await expect(drawer(page)).toHaveCount(0);
    await expect(rowByName(page, TEST_CUSTOMERS.restaurant.name)).toHaveCount(0);
  });

  test("opens existing customer in drawer and saves an edit", async ({ page }) => {
    await page.goto("/admin/customers");
    const row = rowByName(page, TEST_CUSTOMERS.farmStand.name);
    await row.click();

    await expect(drawer(page)).toBeVisible();
    const phoneField = drawer(page).getByLabel(/phone/i);
    await phoneField.fill("216-555-0199");
    await drawer(page).getByRole("button", { name: /save changes/i }).click();

    await expect(drawer(page)).toHaveCount(0);
    await page.reload();
    await expect(rowByName(page, TEST_CUSTOMERS.farmStand.name)).toContainText("216-555-0199");
  });

  test("Regenerate rotates the customer token and refreshes the row", async ({ page }) => {
    const supabase = admin();
    const seedToken = TEST_CUSTOMERS.restaurant.token;

    try {
      await page.goto("/admin/customers");
      const row = rowByName(page, TEST_CUSTOMERS.restaurant.name);
      await expect(row).toContainText(`/c/${seedToken}`);

      await row
        .getByRole("button", { name: new RegExp(`regenerate order link for ${TEST_CUSTOMERS.restaurant.name}`, "i") })
        .click();

      const modal = page.getByRole("dialog", { name: /regenerate order link/i });
      await expect(modal).toBeVisible();
      await modal.getByRole("button", { name: /yes, regenerate/i }).click();
      await expect(modal).toHaveCount(0);

      // Token should change to a 6+3 base36 slug and the old token should be gone.
      await expect(row).not.toContainText(`/c/${seedToken}`);
      const tokenCell = row.locator(".cust-name-token");
      const newToken = (await tokenCell.textContent())?.replace(/^\/c\//, "").trim() ?? "";
      expect(newToken).toMatch(/^[a-z0-9]{6}-[a-z0-9]{3}$/);
      expect(newToken).not.toBe(seedToken);
    } finally {
      // Restore the seed token so subsequent tests + global-setup upsert behave.
      await supabase
        .from("customers")
        .update({ token: seedToken })
        .eq("name", TEST_CUSTOMERS.restaurant.name);
    }
  });

  test("mobile (375px): page fits viewport; row renders as a card; copy-link is tappable", async ({ page, viewport }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only assertions; covered on the mobile project.");
    await page.goto("/admin/customers");

    // No horizontal overflow at iPhone-13 width — the cust-table reflows to
    // a card stack (Phase 6.6 / DEC-034).
    const vw = viewport!.width;
    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(docWidth).toBeLessThanOrEqual(vw + 1);

    // Seed row still locatable by data-row-name, with copy-link in reach.
    const row = rowByName(page, TEST_CUSTOMERS.farmStand.name);
    await expect(row).toBeVisible();
    await expect(row.locator(".cust-name")).toHaveText(TEST_CUSTOMERS.farmStand.name);

    const copy = row.getByRole("button", {
      name: new RegExp(`copy order link for ${TEST_CUSTOMERS.farmStand.name}`, "i"),
    });
    const box = await copy.boundingBox();
    expect(box, "Copy-link button should be visible").not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(36);
  });

  test("subscribed switch toggles inline without opening the drawer", async ({ page }) => {
    await page.goto("/admin/customers");
    const row = rowByName(page, TEST_CUSTOMERS.farmStand.name);
    const sw = row.getByRole("switch");

    const initial = await sw.getAttribute("aria-checked");
    await sw.click();
    // Drawer must NOT open from the switch
    await expect(drawer(page)).toHaveCount(0);

    // Wait for the server action's round-trip to persist before reloading —
    // otherwise on slow projects (mobile WebKit) the reload can race and read
    // the pre-toggle DB row.
    const supabase = admin();
    const expectedFlipped = initial === "true" ? false : true;
    await expect
      .poll(
        async () => {
          const { data } = await supabase
            .from("customers")
            .select("send_weekly_link")
            .eq("token", TEST_CUSTOMERS.farmStand.token)
            .single();
          return data?.send_weekly_link ?? null;
        },
        { timeout: 5000 },
      )
      .toBe(expectedFlipped);

    await page.reload();
    const flipped = await rowByName(page, TEST_CUSTOMERS.farmStand.name)
      .getByRole("switch")
      .getAttribute("aria-checked");
    expect(flipped).not.toBe(initial);
  });

  // #61 — hidden customers are dropped from the default view; a header toggle
  // reveals them with a distinct "is-inactive" treatment, and the drawer swaps
  // "Hide customer" for "Restore customer". #207 unified this wording to
  // Hide/Show across the customer + inventory screens. The next test's
  // beforeEach (resetTestCustomers) restores is_active=true on both seed rows
  // so the bare hide doesn't leak.
  test("Show hidden reveals inactive rows; drawer Restore restores them", async ({ page }) => {
    const supabase = admin();
    await supabase
      .from("customers")
      .update({ is_active: false })
      .eq("token", TEST_CUSTOMERS.restaurant.token);

    await page.goto("/admin/customers");

    // Default view: restaurant is hidden.
    await expect(rowByName(page, TEST_CUSTOMERS.farmStand.name)).toBeVisible();
    await expect(rowByName(page, TEST_CUSTOMERS.restaurant.name)).toHaveCount(0);

    // Eyebrow reflects active count only — 1 active row, not 2 accounts.
    await expect(page.getByText(/1 account · /)).toBeVisible();

    // Toggle appears with the hidden count.
    const toggle = page.getByRole("button", { name: /show hidden \(1\)/i });
    await expect(toggle).toBeVisible();
    await toggle.click();

    const restaurantRow = rowByName(page, TEST_CUSTOMERS.restaurant.name);
    await expect(restaurantRow).toBeVisible();
    await expect(restaurantRow).toHaveClass(/is-inactive/);
    await expect(restaurantRow).toHaveAttribute("data-row-state", "inactive");
    // Subscribed switch is disabled on a deactivated row.
    await expect(restaurantRow.getByRole("switch")).toBeDisabled();

    // Drawer on the inactive row swaps Hide → Restore.
    await restaurantRow.locator(".cust-name").click();
    await expect(drawer(page)).toBeVisible();
    await expect(drawer(page).getByText(/hidden customer/i)).toBeVisible();
    await expect(drawer(page).getByRole("button", { name: /^hide customer$/i })).toHaveCount(0);

    await drawer(page).getByRole("button", { name: /^restore customer$/i }).click();
    await expect(drawer(page)).toHaveCount(0);

    // Row is back in the default view; toggle is gone (no more hidden).
    await expect(rowByName(page, TEST_CUSTOMERS.restaurant.name)).toBeVisible();
    await expect(rowByName(page, TEST_CUSTOMERS.restaurant.name)).not.toHaveClass(/is-inactive/);
    await expect(page.getByRole("button", { name: /show hidden/i })).toHaveCount(0);
  });

  // #129 — drawer is the most complex consumer of the unsaved-changes
  // guard (dirty is derived via JSON stringification). The drawer's
  // scrim/X/Escape are NOT navigations, so the hook's click and popstate
  // listeners don't catch them — the drawer wraps onClose to prompt
  // explicitly when dirty. The Cancel button is the explicit "discard"
  // affordance and intentionally skips the prompt. Smoke-test both paths.
  test("unsaved-changes guard: scrim prompts, Cancel does not", async ({ page }, testInfo) => {
    // Mobile drawer fills the viewport; the scrim is behind the form's
    // field-row, which intercepts the click target. The guard itself is
    // exercised on desktop here — mobile drawer interaction (#129) needs
    // a touch-friendly assertion path tracked separately.
    test.skip(testInfo.project.name === "mobile", "Drawer scrim is occluded by field-row on the 375px drawer; desktop covers the guard path.");
    await page.goto("/admin/customers");
    const row = rowByName(page, TEST_CUSTOMERS.farmStand.name);
    await row.click();
    await expect(drawer(page)).toBeVisible();

    // Type into Phone — drawer is now dirty.
    await drawer(page).getByLabel(/phone/i).fill("216-555-0900");

    // Scrim click prompts; dismiss → drawer stays open.
    const dismissPrompt = (dialog: import("@playwright/test").Dialog) => dialog.dismiss();
    page.on("dialog", dismissPrompt);
    await page.locator(".drawer-scrim").click();
    await expect(drawer(page)).toBeVisible();
    page.off("dialog", dismissPrompt);

    // Cancel button skips the prompt — explicit discard.
    const failOnPrompt = (dialog: import("@playwright/test").Dialog) => {
      throw new Error(`Cancel must not prompt: ${dialog.message()}`);
    };
    page.on("dialog", failOnPrompt);
    await drawer(page).getByRole("button", { name: /^cancel$/i }).click();
    await expect(drawer(page)).toHaveCount(0);
    page.off("dialog", failOnPrompt);
    // resetTestCustomers (next test's beforeEach) is the safety net — but
    // Cancel didn't persist so the row's original phone is intact already.
  });
});
