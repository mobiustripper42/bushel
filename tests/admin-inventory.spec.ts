import { test, expect, type Page } from "@playwright/test";
import { ADMIN_STORAGE_STATE, TEST_PRODUCTS } from "./helpers";

function rowByName(page: Page, name: string) {
  return page.locator(`tr[data-row-name="${name}"]`);
}
function newRow(page: Page) {
  return page.locator(`tr[data-row-id^="new-"]`);
}
const saveButton = (page: Page, count?: number) =>
  count === undefined
    ? page.getByRole("button", { name: /^(Saved|Save \d+ changes?|Saving…)$/ })
    : page.getByRole("button", { name: new RegExp(`^Save ${count} change${count === 1 ? "" : "s"}$`) });

test.describe("admin inventory", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test("renders header, meta pills, and product table", async ({ page }) => {
    await page.goto("/admin/inventory");
    await expect(page.getByRole("heading", { name: /inventory/i })).toBeVisible();
    await expect(page.getByText(/week of/i)).toBeVisible();
    await expect(page.getByText(/this week's list/i)).toBeVisible();
    await expect(page.getByText("Open for orders")).toBeVisible();
    await expect(page.getByText("Cutoff")).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(rowByName(page, TEST_PRODUCTS.kale.name)).toBeVisible();
    await expect(rowByName(page, TEST_PRODUCTS.eggs.name)).toBeVisible();
    await expect(rowByName(page, TEST_PRODUCTS.honey.name)).toBeVisible();
  });

  test("save button is idle when clean, dirties on edit, saves and persists", async ({ page }) => {
    await page.goto("/admin/inventory");
    await expect(saveButton(page)).toBeDisabled();

    const kale = rowByName(page, TEST_PRODUCTS.kale.name);
    await kale.getByRole("spinbutton", { name: /quantity/i }).fill("42");

    await expect(saveButton(page, 1)).toBeEnabled();
    await expect(page.getByRole("region", { name: /unsaved/i })).toBeVisible();

    await saveButton(page, 1).click();
    await expect(page.getByRole("button", { name: /^Saved$/ })).toBeVisible();
    await expect(page.getByRole("region", { name: /unsaved/i })).toHaveCount(0);

    await page.reload();
    await expect(rowByName(page, TEST_PRODUCTS.kale.name).getByRole("spinbutton", { name: /quantity/i })).toHaveValue("42");

    // restore
    await rowByName(page, TEST_PRODUCTS.kale.name)
      .getByRole("spinbutton", { name: /quantity/i })
      .fill(String(TEST_PRODUCTS.kale.qty_available));
    await saveButton(page, 1).click();
    await expect(page.getByRole("button", { name: /^Saved$/ })).toBeVisible();
  });

  test("availability switch toggles and saves", async ({ page }) => {
    await page.goto("/admin/inventory");

    const honey = rowByName(page, TEST_PRODUCTS.honey.name);
    const sw = honey.getByRole("switch");
    await expect(sw).toHaveAttribute("aria-checked", "true");

    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await expect(saveButton(page, 1)).toBeEnabled();

    await saveButton(page, 1).click();
    await expect(page.getByRole("button", { name: /^Saved$/ })).toBeVisible();

    await page.reload();
    const honeyAfter = rowByName(page, TEST_PRODUCTS.honey.name);
    await expect(honeyAfter.getByRole("switch")).toHaveAttribute("aria-checked", "false");

    // restore
    await honeyAfter.getByRole("switch").click();
    await saveButton(page, 1).click();
    await expect(page.getByRole("button", { name: /^Saved$/ })).toBeVisible();
  });

  test("discard reverts pending edits", async ({ page }) => {
    await page.goto("/admin/inventory");

    const kale = rowByName(page, TEST_PRODUCTS.kale.name);
    await kale.getByRole("spinbutton", { name: /quantity/i }).fill("999");
    await expect(saveButton(page, 1)).toBeVisible();

    await page.getByRole("button", { name: /^Discard$/ }).click();
    await expect(page.getByRole("button", { name: /^Saved$/ })).toBeVisible();
    await expect(rowByName(page, TEST_PRODUCTS.kale.name).getByRole("spinbutton", { name: /quantity/i })).toHaveValue(
      String(TEST_PRODUCTS.kale.qty_available),
    );
  });

  test("add row, save, then delete the added row", async ({ page }) => {
    await page.goto("/admin/inventory");

    await page.getByRole("button", { name: /add row/i }).click();

    const added = newRow(page);
    await added.getByRole("textbox", { name: "Product name" }).fill("Test Carrots");
    await added.getByRole("spinbutton", { name: /price/i }).fill("4.00");
    await added.getByRole("textbox", { name: "Unit" }).fill("per lb");
    await added.getByRole("spinbutton", { name: /quantity/i }).fill("20");

    await expect(saveButton(page, 1)).toBeEnabled();
    await saveButton(page, 1).click();
    await expect(page.getByRole("button", { name: /^Saved$/ })).toBeVisible();

    await page.reload();
    const saved = rowByName(page, "Test Carrots");
    await expect(saved).toBeVisible();

    await saved.getByRole("button", { name: /^Delete/ }).click();
    await expect(saveButton(page, 1)).toBeEnabled();
    await saveButton(page, 1).click();
    await expect(page.getByRole("button", { name: /^Saved$/ })).toBeVisible();

    await page.reload();
    await expect(rowByName(page, "Test Carrots")).toHaveCount(0);
  });
});
