import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_STORAGE_STATE, TEST_CUSTOMERS } from "./helpers";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Each test uses a unique name + token so concurrent re-runs don't collide,
// and afterEach scrubs anything inserted during the test.
function uniqueName(base: string) {
  return `${base} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

test.describe("admin customers", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  const createdIds: string[] = [];
  const renamedIds: { id: string; original: string }[] = [];
  const emailedIds: string[] = [];

  test.afterEach(async () => {
    const supabase = adminClient();
    if (createdIds.length) {
      await supabase.from("customers").delete().in("id", createdIds);
      createdIds.length = 0;
    }
    for (const { id, original } of renamedIds) {
      await supabase.from("customers").update({ name: original }).eq("id", id);
    }
    renamedIds.length = 0;
    if (emailedIds.length) {
      await supabase.from("customers").update({ email: null }).in("id", emailedIds);
      emailedIds.length = 0;
    }
  });

  test("list renders existing customers", async ({ page }) => {
    await page.goto("/admin/customers");
    await expect(page.getByRole("heading", { name: /customers/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: TEST_CUSTOMERS.farmStand.name }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: TEST_CUSTOMERS.restaurant.name }).first()).toBeVisible();
  });

  test("create flow: new customer appears in list", async ({ page }) => {
    const name = uniqueName("Test Bakery");

    await page.goto("/admin/customers");
    await page.getByRole("link", { name: /new customer/i }).click();
    await expect(page).toHaveURL(/\/admin\/customers\/new/);

    await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("bakery@example.com");
    await page.getByRole("spinbutton", { name: "Priority" }).fill("50");
    await page.getByRole("button", { name: /create customer/i }).click();

    await expect(page).toHaveURL(/\/admin\/customers$/);
    await expect(page.getByRole("cell", { name })).toBeVisible();

    // Track the created row for cleanup
    const supabase = adminClient();
    const { data } = await supabase.from("customers").select("id").eq("name", name).single();
    if (data) createdIds.push(data.id);
  });

  test("create flow: rejects when both email and phone are empty", async ({ page }) => {
    await page.goto("/admin/customers/new");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill(uniqueName("No Contact"));
    await page.getByRole("button", { name: /create customer/i }).click();
    await expect(page.getByText(/at least one of email or phone is required/i)).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/customers\/new/);
  });

  test("edit flow: updating name persists", async ({ page }) => {
    const supabase = adminClient();
    const { data: original, error } = await supabase
      .from("customers")
      .select("id, name")
      .eq("token", TEST_CUSTOMERS.farmStand.token)
      .single();
    if (error || !original) throw new Error(`Could not find farm stand customer: ${error?.message}`);

    const newName = uniqueName("Farm Stand Edited");
    renamedIds.push({ id: original.id, original: original.name });
    emailedIds.push(original.id);

    await page.goto(`/admin/customers/${original.id}`);
    await page.getByRole("textbox", { name: "Name", exact: true }).fill(newName);
    // Seed customer has no email/phone; the OR-validation requires at least one
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("farmstand@example.com");
    await page.getByRole("button", { name: /save changes/i }).click();

    // Wait for the save round-trip: button re-enables (label flips back from "Saving…")
    await expect(page.getByRole("button", { name: /save changes/i })).toBeEnabled();

    // Verify persistence at the DB layer first (canonical truth)
    const { data: updated } = await supabase.from("customers").select("name").eq("id", original.id).single();
    expect(updated?.name).toBe(newName);

    // Then verify the list view reflects it
    await page.goto("/admin/customers");
    await expect(page.getByRole("cell", { name: newName })).toBeVisible();
  });

  test("deactivate toggle flips status", async ({ page }) => {
    // Seed an isolated customer for this test so the toggle doesn't affect others
    const supabase = adminClient();
    const name = uniqueName("Toggle Test");
    const { data, error } = await supabase
      .from("customers")
      .insert({ name, token: `tgl-${Date.now()}`, email: "toggle@example.com", is_active: true })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Seed insert failed: ${error?.message}`);
    createdIds.push(data.id);

    await page.goto("/admin/customers");
    const row = page.getByRole("cell", { name }).locator("xpath=ancestor::tr");
    await row.getByRole("button", { name: /deactivate customer/i }).click();
    await expect(row.getByRole("button", { name: /activate customer/i })).toBeVisible();
    await expect(row).toContainText(/inactive/i);
  });
});
