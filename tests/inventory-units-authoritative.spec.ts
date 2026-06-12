import { test, expect, type Page } from "@playwright/test";
import {
  ADMIN_STORAGE_STATE,
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  customerOrderUrl,
  deleteProductByName,
  resetCustomerOrderState,
  resetProductUnits,
} from "./helpers";

// #212 / DEC-037 — product_units is the single source of truth for unit label
// + price. products.unit / products.price_cents are gone, and the spawn
// trigger with them: saveInventory now owns the base product_units row. These
// tests prove the two seams that used to ride on the dropped columns:
//   (a) a brand-new product created through the inline editor gets a usable
//       base unit on the customer order form (app-code spawn works), and
//   (b) an inline base-price edit in admin reaches the customer form (the
//       editor writes product_units, the form reads product_units — no
//       mirror trigger in between).

const KALE = TEST_PRODUCTS.kale;
const NEW_PRODUCT = "Test Snap Peas";

function rowByName(page: Page, name: string) {
  return page.locator(`tr[data-row-name="${name}"]`);
}
const saveButton = (page: Page, count: number) =>
  page.getByRole("button", {
    name: new RegExp(`^Save ${count} change${count === 1 ? "" : "s"}$`),
  });

test.describe("inventory ↔ customer form · product_units authoritative (#212)", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test.beforeEach(async () => {
    await resetCustomerOrderState();
  });

  test("new product created via inline editor shows a usable unit + price on the customer form", async ({
    browser,
    page,
  }) => {
    try {
      await page.goto("/admin/inventory");
      await page.getByRole("button", { name: /add row/i }).click();

      const added = page.locator(`tr[data-row-id^="new-"]`);
      // Click before filling — WebKit's cold-load .fill() flake.
      const nameInput = added.getByRole("textbox", { name: "Product name" });
      await nameInput.click();
      await nameInput.fill(NEW_PRODUCT);
      await added.getByRole("textbox", { name: /price/i }).fill("4.50");
      await added.getByRole("textbox", { name: "Unit" }).fill("pint");
      await added.getByRole("textbox", { name: /quantity/i }).fill("12");

      await saveButton(page, 1).click();
      await expect(page.getByRole("button", { name: /^Saved$/ })).toBeVisible();

      // Customer side: fresh unauthenticated context.
      const customerCtx = await browser.newContext();
      const customerPage = await customerCtx.newPage();
      await customerPage.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

      const row = customerPage.locator(".item-row", { hasText: NEW_PRODUCT });
      await expect(row).toBeVisible();
      // Price + unit label come from the saveInventory-created base unit row.
      await expect(row.locator(".item-price .mono")).toHaveText("$4.50");
      await expect(row.locator(".item-per")).toContainText("pint");
      await expect(row).not.toHaveClass(/is-sold-out/);

      // Usable: the stepper accepts a quantity and the order box prices it.
      await row.getByRole("button", { name: "increase" }).click();
      await expect(row.locator(".stepper-val")).toHaveValue("1");
      await expect(
        customerPage.locator(".submit-summary .rail-row-total"),
      ).toContainText("4.50");
      await customerCtx.close();
    } finally {
      await deleteProductByName(NEW_PRODUCT);
    }
  });

  test("inline base-price + unit-label edit reaches the customer form", async ({
    browser,
    page,
  }) => {
    try {
      await page.goto("/admin/inventory");

      const kale = rowByName(page, KALE.name);
      const priceInput = kale.getByRole("textbox", { name: /price/i });
      await priceInput.click();
      await priceInput.fill("3.75");
      await kale.getByRole("textbox", { name: "Unit" }).fill("bag");

      await saveButton(page, 1).click();
      await expect(page.getByRole("button", { name: /^Saved$/ })).toBeVisible();

      const customerCtx = await browser.newContext();
      const customerPage = await customerCtx.newPage();
      await customerPage.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

      const row = customerPage.locator(".item-row", { hasText: KALE.name });
      await expect(row.locator(".item-price .mono")).toHaveText("$3.75");
      await expect(row.locator(".item-per")).toContainText("bag");
      await customerCtx.close();
    } finally {
      // Restore the seeded base unit (label + price) regardless of outcome.
      await resetProductUnits(KALE.id, KALE.price_cents, KALE.unit);
    }
  });
});
