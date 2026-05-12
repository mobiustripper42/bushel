import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_STORAGE_STATE, TEST_CUSTOMERS } from "./helpers";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function resetTestCustomers() {
  const supabase = adminClient();
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

  test("Add customer drawer requires email or phone", async ({ page }) => {
    await page.goto("/admin/customers");
    await page.getByRole("button", { name: /add customer/i }).click();
    await expect(drawer(page)).toBeVisible();

    await drawer(page).getByLabel("Customer name").fill("No Contact LLC");
    await drawer(page).getByRole("button", { name: /add customer/i }).click();

    await expect(drawer(page).getByRole("alert")).toContainText(/email or phone/i);
    // Drawer stays open
    await expect(drawer(page)).toBeVisible();
  });

  test("creates a new customer and shows it in the list", async ({ page }) => {
    const uniqueName = `Playwright Customer ${Date.now()}`;
    await page.goto("/admin/customers");
    await page.getByRole("button", { name: /add customer/i }).click();

    await drawer(page).getByLabel("Customer name").fill(uniqueName);
    await drawer(page).getByLabel("Email").fill("pw@example.com");
    await drawer(page).getByLabel("Priority").fill("50");
    await drawer(page).getByRole("button", { name: /add customer/i }).click();

    await expect(drawer(page)).toHaveCount(0);
    await expect(rowByName(page, uniqueName)).toBeVisible();
  });

  test("Delete customer deactivates and drops the row from the list", async ({ page }) => {
    // Seed phone so beforeEach-cleaned customer can be edited
    const supabase = adminClient();
    await supabase.from("customers").update({ phone: "216-555-0100" }).eq("token", TEST_CUSTOMERS.restaurant.token);

    await page.goto("/admin/customers");
    await rowByName(page, TEST_CUSTOMERS.restaurant.name).click();
    await expect(drawer(page)).toBeVisible();
    await drawer(page).getByRole("button", { name: /delete customer/i }).click();
    await expect(drawer(page)).toHaveCount(0);
    await expect(rowByName(page, TEST_CUSTOMERS.restaurant.name)).toHaveCount(0);
  });

  test("opens existing customer in drawer and saves an edit", async ({ page }) => {
    await page.goto("/admin/customers");
    const row = rowByName(page, TEST_CUSTOMERS.farmStand.name);
    await row.click();

    await expect(drawer(page)).toBeVisible();
    const phoneField = drawer(page).getByLabel("Phone");
    await phoneField.fill("216-555-0199");
    await drawer(page).getByRole("button", { name: /save changes/i }).click();

    await expect(drawer(page)).toHaveCount(0);
    await page.reload();
    await expect(rowByName(page, TEST_CUSTOMERS.farmStand.name)).toContainText("216-555-0199");
  });

  test("subscribed switch toggles inline without opening the drawer", async ({ page }) => {
    await page.goto("/admin/customers");
    const row = rowByName(page, TEST_CUSTOMERS.farmStand.name);
    const sw = row.getByRole("switch");

    const initial = await sw.getAttribute("aria-checked");
    await sw.click();
    // Drawer must NOT open from the switch
    await expect(drawer(page)).toHaveCount(0);

    await page.reload();
    const flipped = await rowByName(page, TEST_CUSTOMERS.farmStand.name)
      .getByRole("switch")
      .getAttribute("aria-checked");
    expect(flipped).not.toBe(initial);
  });
});
