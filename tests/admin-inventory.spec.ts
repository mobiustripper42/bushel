import { test, expect, type Page } from "@playwright/test";
import {
  ADMIN_STORAGE_STATE,
  TEST_PRODUCTS,
  resetProductSortOrder,
  setOrderingSchedule,
} from "./helpers";

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
    // Scope page-specific copy to .page-head / .meta-row — Phase 3 admin shell
    // (#66) added a top bar with its own "Week of" and a sidebar footer with
    // its own "Open for orders" pill, which collide under page-wide getByText.
    await expect(page.locator(".page-head").getByText(/week of/i)).toBeVisible();
    await expect(page.getByText(/this week's list/i)).toBeVisible();
    await expect(page.locator(".meta-row").getByText("Open for orders")).toBeVisible();
    await expect(page.locator(".meta-row").getByText("Customers")).toBeVisible();
    await expect(page.locator(".meta-row").getByText(/cutoff/i)).toHaveCount(0);
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

  test("mobile (375px): page fits viewport; rows render as cards; qty input is editable", async ({ page, viewport }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only assertions; covered on the mobile project.");
    await page.goto("/admin/inventory");

    // No horizontal overflow at iPhone-13 width — the data-table reflows to
    // a card stack (Phase 6.6 / DEC-034).
    const vw = viewport!.width;
    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(docWidth).toBeLessThanOrEqual(vw + 1);

    // Seed row still reachable through the same data-row-name attribute.
    const kale = rowByName(page, TEST_PRODUCTS.kale.name);
    await expect(kale).toBeVisible();

    // Qty input is still wired up — Annabel can edit from a phone in a pinch.
    const qtyInput = kale.getByRole("spinbutton", { name: /quantity/i });
    await expect(qtyInput).toBeVisible();
    await qtyInput.fill("17");
    await expect(saveButton(page, 1)).toBeEnabled();
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

  // #143 — drag the grip on the left of a row to reorder. Default fixture
  // is Kale (1), Eggs (2), Honey (3); drag Honey above Kale, save, reload,
  // and confirm the new order persists. The try/finally + admin-client
  // reset guarantees other specs see the seeded order even if an assertion
  // here fails mid-test (cleanup-via-drag would otherwise leak).
  test("drag-to-reorder: grip drag updates row order, persists across reload", async ({ page }, testInfo) => {
    // Native HTML5 DnD doesn't work on touch viewports — mobile project
    // (iPhone-13 WebKit) is desktop-only for this interaction. Touch-friendly
    // reorder is tracked in the #143 follow-up issue (#168) alongside the
    // above/below drop-precision UX.
    test.skip(testInfo.project.name === "mobile", "HTML5 drag is desktop-only; touch reorder is a follow-up (#168).");
    try {
      await page.goto("/admin/inventory");

      const rowOrder = async () =>
        page.locator("tr.data-row").evaluateAll((els) =>
          els.map((el) => (el as HTMLElement).dataset.rowName),
        );
      // Baseline assertion guards against fixture leak from another spec.
      await expect.poll(rowOrder).toEqual(["Kale", "Eggs", "Honey"]);

      // Arm the drag on Honey's grip, then drag the row onto Kale's row.
      // Playwright's dragTo dispatches dragstart/dragover/drop in sequence —
      // exactly what the armed-handle pattern expects.
      const honeyRow = rowByName(page, TEST_PRODUCTS.honey.name);
      const kaleRow = rowByName(page, TEST_PRODUCTS.kale.name);
      await honeyRow.locator(".row-handle-grip").dispatchEvent("mousedown");
      await honeyRow.dragTo(kaleRow);
      await honeyRow.dispatchEvent("dragend");

      await expect.poll(rowOrder).toEqual(["Honey", "Kale", "Eggs"]);
      // "Save 3 changes" is correct — every row's sort_order shifted to a
      // new (10, 20, 30, …) slot. The "3 changes" copy is technically right
      // but reads oddly for a one-row drag; follow-up issue tracks tightening
      // the dirty copy for reorders.
      await expect(saveButton(page, 3)).toBeEnabled();

      await saveButton(page, 3).click();
      await expect(page.getByRole("button", { name: /^Saved$/ })).toBeVisible();

      await page.reload();
      await expect.poll(rowOrder).toEqual(["Honey", "Kale", "Eggs"]);
    } finally {
      await resetProductSortOrder();
    }
  });
});

test.describe("admin inventory — open-for-orders meta pill", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  // Restore the singleton row to the post-seed default — is_open=true with
  // weekly fields null — so other specs (admin-settings, customer-closed)
  // start from the same state they normally do. Tests below opt into a
  // weekly schedule explicitly when they need one.
  const DEFAULT_SCHEDULE = {
    is_open: true,
    weekly_open_day: null,
    weekly_open_time: null,
    weekly_close_day: null,
    weekly_close_time: null,
  };

  test.afterEach(async () => {
    await setOrderingSchedule(DEFAULT_SCHEDULE);
  });

  const pill = (page: Page) =>
    page.locator(".meta-row .meta-pill", { hasText: "Open for orders" });

  test("renders 'Open · {open} – {close}' when is_open + schedule set", async ({ page }) => {
    await setOrderingSchedule({
      is_open: true,
      weekly_open_day: 0,
      weekly_open_time: "08:00:00",
      weekly_close_day: 2,
      weekly_close_time: "18:00:00",
    });
    await page.goto("/admin/inventory");
    await expect(pill(page)).toContainText("Open · Sun 8am – Tue 6pm");
    await expect(pill(page).locator(".status-dot.is-open")).toBeVisible();
  });

  test("renders 'Open · manual' when is_open but no weekly schedule", async ({ page }) => {
    await setOrderingSchedule({
      is_open: true,
      weekly_open_day: null,
      weekly_open_time: null,
      weekly_close_day: null,
      weekly_close_time: null,
    });
    await page.goto("/admin/inventory");
    await expect(pill(page)).toContainText("Open · manual");
    await expect(pill(page).locator(".status-dot.is-open")).toBeVisible();
  });

  test("renders 'Closed' when is_open=false (with red dot)", async ({ page }) => {
    await setOrderingSchedule({ is_open: false });
    await page.goto("/admin/inventory");
    await expect(pill(page)).toContainText("Closed");
    await expect(pill(page).locator(".status-dot.is-open")).toHaveCount(0);
    await expect(pill(page).locator(".status-dot")).toBeVisible();
  });
});
