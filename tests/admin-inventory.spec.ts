import { test, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE, TEST_PRODUCTS } from "./helpers";

test.describe("admin inventory", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test("inventory page renders product table", async ({ page }) => {
    await page.goto("/admin/inventory");
    await expect(page.getByRole("heading", { name: /inventory/i })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("cell", { name: TEST_PRODUCTS.kale.name }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: TEST_PRODUCTS.eggs.name }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: TEST_PRODUCTS.honey.name }).first()).toBeVisible();
  });

  test("edit qty and price, save, verify persistence", async ({ page }) => {
    await page.goto("/admin/inventory");

    const qtyInput = page.getByRole("spinbutton", { name: `Qty available for ${TEST_PRODUCTS.kale.name}` });
    const priceInput = page.getByRole("spinbutton", { name: `Price for ${TEST_PRODUCTS.kale.name}` });

    await qtyInput.fill("42");
    await priceInput.fill("3.50");

    // Find the Save button in the Kale row by locating the row containing Kale's name input
    const kaleNameInput = page.getByRole("textbox", { name: `Name for ${TEST_PRODUCTS.kale.name}` });
    const kaleRow = kaleNameInput.locator("xpath=ancestor::tr");
    await kaleRow.getByRole("button", { name: /save/i }).click();

    await expect(kaleRow.getByText("Saved")).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    await expect(page.getByRole("spinbutton", { name: `Qty available for ${TEST_PRODUCTS.kale.name}` })).toHaveValue("42");
    await expect(page.getByRole("spinbutton", { name: `Price for ${TEST_PRODUCTS.kale.name}` })).toHaveValue("3.50");
  });

  test("save resets qty back to original after second edit", async ({ page }) => {
    await page.goto("/admin/inventory");

    const qtyInput = page.getByRole("spinbutton", { name: `Qty available for ${TEST_PRODUCTS.kale.name}` });
    // Reset Kale qty back to original value
    await qtyInput.fill(String(TEST_PRODUCTS.kale.qty_available));

    const kaleNameInput = page.getByRole("textbox", { name: `Name for ${TEST_PRODUCTS.kale.name}` });
    const kaleRow = kaleNameInput.locator("xpath=ancestor::tr");
    await kaleRow.getByRole("button", { name: /save/i }).click();

    await expect(kaleRow.getByText("Saved")).toBeVisible();
  });
});
