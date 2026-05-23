import { test, expect, type Page } from "@playwright/test";
import { ADMIN_STORAGE_STATE, TEST_PRODUCTS, admin, resetProductUnits } from "./helpers";

// Per-product Units drawer (#152). The drawer opens from the units chip in
// each row's unit cell. The 6.5a safety-net trigger gives every product a
// single base unit; the drawer's job is to let admins add/edit additional
// units and toggle activity per-unit.

const KALE = TEST_PRODUCTS.kale;
const EGGS = TEST_PRODUCTS.eggs;

function row(page: Page, name: string) {
  return page.locator(`tr[data-row-name="${name}"]`);
}
function chip(page: Page, name: string) {
  return row(page, name).locator(".units-chip");
}
function drawer(page: Page) {
  return page.getByRole("dialog");
}
function drawerSave(page: Page) {
  return drawer(page).getByRole("button", { name: /^(Save units|Saved|Saving…)$/ });
}

test.describe("admin inventory · units drawer", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test.beforeEach(async () => {
    await resetProductUnits(KALE.id, KALE.price_cents);
    await resetProductUnits(EGGS.id, EGGS.price_cents);
  });

  test.afterEach(async () => {
    await resetProductUnits(KALE.id, KALE.price_cents);
    await resetProductUnits(EGGS.id, EGGS.price_cents);
  });

  test("single-unit product shows '+ Add unit' chip and opens drawer", async ({ page }) => {
    await page.goto("/admin/inventory");
    const c = chip(page, KALE.name);
    await expect(c).toContainText(/add unit/i);
    await expect(c).not.toHaveClass(/is-multi/);

    await c.click();
    await expect(drawer(page)).toBeVisible();
    await expect(drawer(page).getByRole("heading", { name: KALE.name })).toBeVisible();

    // base row visible, conversion locked, no delete button
    const baseInput = drawer(page).getByLabel("Base unit label");
    await expect(baseInput).toHaveValue(KALE.unit);
    await expect(drawer(page).getByLabel("Conversion to base").first()).toBeDisabled();
    await expect(drawer(page).getByRole("button", { name: /^Delete unit/ })).toHaveCount(0);
  });

  test("add a second unit, save, chip updates", async ({ page }) => {
    await page.goto("/admin/inventory");
    await chip(page, KALE.name).click();
    await expect(drawer(page)).toBeVisible();

    await drawer(page).getByRole("button", { name: /add another unit/i }).click();
    const newRow = drawer(page).locator(".units-row").nth(1);
    await newRow.getByRole("textbox", { name: "Unit label" }).fill("per lb");
    await newRow.getByRole("spinbutton", { name: "Conversion to base" }).fill("0.5");
    await newRow.getByRole("spinbutton", { name: "Unit price" }).fill("8.00");

    await drawerSave(page).click();
    await expect(drawer(page)).toBeHidden();

    const c = chip(page, KALE.name);
    await expect(c).toContainText(/2\s*units/);
    await expect(c).toHaveClass(/is-multi/);

    // verify persisted via DB
    const sb = admin();
    const { data } = await sb.from("product_units").select("label, unit_price_cents, conversion_to_base, is_active").eq("product_id", KALE.id);
    const extra = data?.find((u) => u.label === "per lb");
    expect(extra).toBeTruthy();
    expect(extra?.unit_price_cents).toBe(800);
    expect(Number(extra?.conversion_to_base)).toBe(0.5);
    expect(extra?.is_active).toBe(true);
  });

  test("inactive unit is reflected in chip subtext", async ({ page }) => {
    // seed an extra unit, then deactivate it via the drawer
    const sb = admin();
    await sb.from("product_units").insert({
      product_id: EGGS.id,
      label: "per half-dozen",
      conversion_to_base: 0.5,
      unit_price_cents: 350,
      is_active: true,
      slug: `eggs-per-half-dozen-${EGGS.id.slice(0, 8)}`,
    });

    await page.goto("/admin/inventory");
    await expect(chip(page, EGGS.name)).toContainText(/2\s*units/);

    await chip(page, EGGS.name).click();
    const switches = drawer(page).getByRole("switch");
    await expect(switches).toHaveCount(2);
    await switches.nth(1).click(); // turn off the extra
    await drawerSave(page).click();
    await expect(drawer(page)).toBeHidden();

    const c = chip(page, EGGS.name);
    await expect(c).toContainText(/2\s*units\s*·\s*1\s*off/);
  });

  test("remove a non-base unit", async ({ page }) => {
    const sb = admin();
    await sb.from("product_units").insert({
      product_id: KALE.id,
      label: "per lb",
      conversion_to_base: 0.25,
      unit_price_cents: 1200,
      is_active: true,
      slug: `kale-per-lb-${KALE.id.slice(0, 8)}`,
    });

    await page.goto("/admin/inventory");
    await chip(page, KALE.name).click();
    await expect(drawer(page).locator(".units-row")).toHaveCount(2);

    await drawer(page).getByRole("button", { name: /^Delete unit/ }).click();
    await expect(drawer(page).locator(".units-row")).toHaveCount(1);
    await drawerSave(page).click();
    await expect(drawer(page)).toBeHidden();

    await expect(chip(page, KALE.name)).toContainText(/add unit/i);
  });

  test("validation: blank label, duplicate label, zero conversion, all inactive", async ({ page }) => {
    await page.goto("/admin/inventory");
    await chip(page, KALE.name).click();

    // blank label
    await drawer(page).getByRole("button", { name: /add another unit/i }).click();
    await drawerSave(page).click();
    await expect(drawer(page).getByRole("alert")).toContainText(/every unit needs a label/i);

    // duplicate label (same as base)
    const newRow = drawer(page).locator(".units-row").nth(1);
    await newRow.getByRole("textbox", { name: "Unit label" }).fill(KALE.unit);
    await drawerSave(page).click();
    await expect(drawer(page).getByRole("alert")).toContainText(/labels must be unique/i);

    // zero conversion
    await newRow.getByRole("textbox", { name: "Unit label" }).fill("per lb");
    await newRow.getByRole("spinbutton", { name: "Conversion to base" }).fill("0");
    await drawerSave(page).click();
    await expect(drawer(page).getByRole("alert")).toContainText(/conversion must be greater than zero/i);

    // all inactive
    await newRow.getByRole("spinbutton", { name: "Conversion to base" }).fill("0.5");
    const switches = drawer(page).getByRole("switch");
    await switches.nth(0).click();
    await switches.nth(1).click();
    await drawerSave(page).click();
    await expect(drawer(page).getByRole("alert")).toContainText(/at least one unit must stay active/i);
  });

  test("new (unsaved) row hides the units chip", async ({ page }) => {
    await page.goto("/admin/inventory");
    await page.getByRole("button", { name: /add row/i }).click();
    const newRow = page.locator(`tr[data-row-id^="new-"]`);
    await expect(newRow.locator(".units-chip")).toHaveCount(0);
  });
});
