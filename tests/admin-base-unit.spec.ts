import { test, expect, type Page } from "@playwright/test";
import {
  ADMIN_STORAGE_STATE,
  TEST_PRODUCTS,
  resetProductUnits,
  setProductQty,
  setProductUnits,
} from "./helpers";
import { query } from "@/lib/db";

// #208 (DEC-038) — changeable base unit. "Make base" on a non-base unit row
// opens a confirm modal; confirming calls the atomic set_base_unit RPC, which
// rescales every conversion + qty_available and makes the new base the
// customer default (smallest sort_order). Gated while the drawer has unsaved
// edits so the post-rebase reload can't clobber staged changes.

const KALE = TEST_PRODUCTS.kale;

function row(page: Page, name: string) {
  return page.locator(`tr[data-row-name="${name}"]`);
}
function chip(page: Page, name: string) {
  return row(page, name).locator(".units-chip");
}
function drawer(page: Page) {
  return page.locator("aside.units-drawer");
}
function confirmModal(page: Page) {
  return page.locator(".modal");
}

test.describe("admin inventory · make base unit", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test.beforeEach(async () => {
    // Two units: bunch is base (conv 1), "per lb" is half a bunch's worth
    // (conv 0.5). Stock pinned to 10 base units so the rescale is assertable.
    await setProductUnits(KALE.id, [
      { label: KALE.unit, conversion_to_base: 1, unit_price_cents: KALE.price_cents },
      { label: "per lb", conversion_to_base: 0.5, unit_price_cents: 800 },
    ]);
    await setProductQty(KALE.id, 10);
  });

  test.afterEach(async () => {
    await resetProductUnits(KALE.id, KALE.price_cents, KALE.unit);
    await setProductQty(KALE.id, KALE.qty_available);
  });

  test("make base: confirm rebases conversions, stock, and default order", async ({ page }) => {
    await page.goto("/admin/inventory");
    await chip(page, KALE.name).click();
    await expect(drawer(page)).toBeVisible();

    // Base row carries the badge and no Make-base affordance.
    await expect(drawer(page).locator(".units-row.is-base")).toHaveAttribute(
      "data-unit-label",
      KALE.unit,
    );
    await expect(
      drawer(page).locator(".units-row.is-base .units-make-base"),
    ).toHaveCount(0);

    await drawer(page)
      .getByRole("button", { name: "Make per lb the base unit" })
      .click();

    // Deliberate step: a confirm modal, not an inline flip.
    await expect(confirmModal(page)).toBeVisible();
    await expect(confirmModal(page)).toContainText(/counted and sold in/i);
    await confirmModal(page).getByRole("button", { name: /^Make base$/ }).click();

    // Success closes the drawer (state reloads via router.refresh).
    await expect(drawer(page)).toBeHidden();

    // DB: per lb is now 1.0, bunch rescaled to 2.0, stock 10 / 0.5 = 20,
    // prices untouched, new base sorts first.
    const units = await query<{
      label: string;
      conversion_to_base: number;
      unit_price_cents: number;
      sort_order: number;
    }>(
      `select label, conversion_to_base, unit_price_cents, sort_order
         from product_units where product_id = $1 order by sort_order`,
      [KALE.id],
    );
    expect(units).toHaveLength(2);
    expect(units[0].label).toBe("per lb");
    expect(Number(units[0].conversion_to_base)).toBe(1);
    expect(units[0].unit_price_cents).toBe(800);
    expect(units[1].label).toBe(KALE.unit);
    expect(Number(units[1].conversion_to_base)).toBe(2);
    expect(units[1].unit_price_cents).toBe(KALE.price_cents);

    const products = await query<{ qty_available: number }>(
      `select qty_available from products where id = $1`,
      [KALE.id],
    );
    expect(Number(products[0]!.qty_available)).toBe(20);

    // Reload + reopen: the drawer now badges "per lb" as base, and the inline
    // row's unit cell follows (it mirrors the base unit per DEC-037).
    await page.reload();
    await expect(row(page, KALE.name).getByLabel("Unit", { exact: true })).toHaveValue("per lb");
    await chip(page, KALE.name).click();
    await expect(drawer(page).locator(".units-row.is-base")).toHaveAttribute(
      "data-unit-label",
      "per lb",
    );
  });

  test("cancel leaves everything untouched", async ({ page }) => {
    await page.goto("/admin/inventory");
    await chip(page, KALE.name).click();
    await drawer(page)
      .getByRole("button", { name: "Make per lb the base unit" })
      .click();
    await expect(confirmModal(page)).toBeVisible();
    await confirmModal(page).getByRole("button", { name: "Cancel" }).click();
    await expect(confirmModal(page)).toBeHidden();
    await expect(drawer(page)).toBeVisible();

    const rows = await query<{ conversion_to_base: number }>(
      `select conversion_to_base from product_units
        where product_id = $1 and label = $2`,
      [KALE.id, "per lb"],
    );
    expect(Number(rows[0]!.conversion_to_base)).toBe(0.5);
  });

  test("make base is gated while the drawer has unsaved edits", async ({ page }) => {
    await page.goto("/admin/inventory");
    await chip(page, KALE.name).click();
    await expect(drawer(page)).toBeVisible();

    const makeBase = drawer(page).getByRole("button", {
      name: "Make per lb the base unit",
    });
    await expect(makeBase).toBeEnabled();

    // Dirty the drawer: edit the non-base unit's price.
    const lbRow = drawer(page).locator('.units-row[data-unit-label="per lb"]');
    await lbRow.getByRole("textbox", { name: "Unit price" }).fill("9.00");

    await expect(makeBase).toBeDisabled();
    await expect(makeBase).toHaveAttribute("title", "Save your unit changes first");

    // A brand-new (unsaved) row never offers Make base — it has no DB id.
    await drawer(page).getByRole("button", { name: /add another unit/i }).click();
    const newRow = drawer(page).locator(".units-row").nth(2);
    await expect(newRow.locator(".units-make-base")).toHaveCount(0);
  });
});
