import { test, expect } from "@playwright/test";
import {
  TEST_CUSTOMERS,
  TEST_PRODUCTS,
  customerOrderUrl,
  resetCustomerOrderState,
} from "./helpers";

test.describe("/c/[token] order form", () => {
  // /c/[token] now redirects to /confirmed whenever an order exists for the
  // current week, so any prior spec that left an order behind would break
  // every form test below. Clear the slate before each.
  test.beforeEach(async () => {
    await resetCustomerOrderState();
  });

  test("renders header and the seeded products", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await expect(page.getByRole("heading", { name: /What.s available/i })).toBeVisible();
    await expect(page.getByText(/Test Farm Stand/)).toBeVisible();
    for (const p of Object.values(TEST_PRODUCTS)) {
      await expect(page.getByText(p.name, { exact: true }).first()).toBeVisible();
    }
  });

  test("stepper increments and the running total updates", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

    // Find the Kale row and tap + twice
    const kaleRow = page.locator(".item-row", { hasText: TEST_PRODUCTS.kale.name });
    await kaleRow.getByRole("button", { name: "increase" }).click();
    await kaleRow.getByRole("button", { name: "increase" }).click();
    await expect(kaleRow.locator(".stepper-val")).toHaveValue("2");

    // Sticky bar + submit-block totals reflect 2 × $3.00 = $6.00
    await expect(page.locator(".sticky-total").first()).toContainText("6.00");
    await expect(page.locator(".submit-summary .rail-row-total")).toContainText("6.00");
  });

  test("stepper value is typeable; clamps to qty_available on blur", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    const kaleRow = page.locator(".item-row", { hasText: TEST_PRODUCTS.kale.name });
    const input = kaleRow.locator(".stepper-val");

    await input.click();
    await input.press("ControlOrMeta+A");
    await input.pressSequentially("7");
    await input.blur();
    await expect(input).toHaveValue("7");
    await expect(page.locator(".submit-summary .rail-row-total")).toContainText("21.00");

    // Type a value above qty_available (10) → clamps on blur
    await input.click();
    await input.press("ControlOrMeta+A");
    await input.pressSequentially("99");
    await input.blur();
    await expect(input).toHaveValue(String(TEST_PRODUCTS.kale.qty_available));
  });

  test("submit button disabled with no items, enabled after stepping up", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    const submit = page.locator(".submit-btn");
    await expect(submit).toBeDisabled();

    const kaleRow = page.locator(".item-row", { hasText: TEST_PRODUCTS.kale.name });
    await kaleRow.getByRole("button", { name: "increase" }).click();
    await expect(submit).toBeEnabled();
  });

  test("delivery mode shows the delivery-preference textarea, prefilled from prior order", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    // Delivery is the default mode
    const pref = page.locator("#delivery-pref");
    await expect(pref).toBeVisible();
    await expect(pref).toHaveValue("Back door, gate code 4321");

    await pref.click();
    await pref.press("ControlOrMeta+A");
    await pref.press("Delete");
    await pref.pressSequentially("Leave with security desk.");
    await expect(pref).toHaveValue("Leave with security desk.");
  });

  test("pickup mode swaps to the pickup-note textarea", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await page.getByRole("tab", { name: /Pickup at farm/i }).click();

    const note = page.locator("#pickup-note");
    await expect(note).toBeVisible();
    await note.fill("Wednesday around 3pm.");
    await expect(note).toHaveValue("Wednesday around 3pm.");

    // Delivery textarea is gone
    await expect(page.locator("#delivery-pref")).toHaveCount(0);
  });

  test("notes textarea accepts input", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    const notes = page.locator(".notes textarea");
    await notes.fill("Loose bunches are fine.");
    await expect(notes).toHaveValue("Loose bunches are fine.");
  });

  test("restaurant customer has no prior order — delivery textarea starts empty", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.restaurant.token));
    await expect(page.locator("#delivery-pref")).toHaveValue("");
  });

  test("sticky-bar Review scrolls to fulfillment without submitting", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Sticky bar is mobile-only (CSS @media >= 880px hides it).");
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

    const kaleRow = page.locator(".item-row", { hasText: TEST_PRODUCTS.kale.name });
    await kaleRow.getByRole("button", { name: "increase" }).click();

    const stickyBtn = page.locator(".sticky-btn");
    await expect(stickyBtn).toHaveText("Review");

    // Scroll back to top so the click has somewhere to scroll to (test fixture
    // is short enough that fulfill can already be in view).
    await page.evaluate(() => window.scrollTo(0, 0));
    const beforeY = await page.evaluate(() => window.scrollY);

    await stickyBtn.click();

    // Fulfill section is in viewport after click, scroll position moved down,
    // and we did NOT navigate to /confirmed.
    await expect(page.locator(".fulfill")).toBeInViewport();
    const afterY = await page.evaluate(() => window.scrollY);
    expect(afterY).toBeGreaterThan(beforeY);
    expect(page.url()).not.toContain("/confirmed");
  });

  // #149 — cart draft persists to sessionStorage so a same-tab reload (the
  // Android-rotation bfcache-evict remount) doesn't wipe it.
  test("cart draft survives a same-tab reload (sessionStorage persistence)", async ({ page }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));

    const kaleRow = page.locator(".item-row", { hasText: TEST_PRODUCTS.kale.name });
    await kaleRow.getByRole("button", { name: "increase" }).click();
    await kaleRow.getByRole("button", { name: "increase" }).click();
    await expect(kaleRow.locator(".stepper-val")).toHaveValue("2");

    // Also flip mode + add a note so we cover the non-qty fields too.
    await page.getByRole("tab", { name: /pickup/i }).click();
    await page.locator("section.notes textarea").fill("leave at side door");

    await page.reload();

    // Cart + mode + note all restored from the draft.
    await expect(
      page.locator(".item-row", { hasText: TEST_PRODUCTS.kale.name }).locator(".stepper-val"),
    ).toHaveValue("2");
    await expect(page.getByRole("tab", { name: /pickup/i })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("section.notes textarea")).toHaveValue("leave at side door");
  });

  // #149 — sessionStorage is per-tab: a fresh context (reopening the SMS link
  // in a new tab/session) starts empty, not resurrected from an old draft.
  test("cart draft does NOT cross into a fresh browser context", async ({ page, browser }) => {
    await page.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    const kaleRow = page.locator(".item-row", { hasText: TEST_PRODUCTS.kale.name });
    await kaleRow.getByRole("button", { name: "increase" }).click();
    await expect(kaleRow.locator(".stepper-val")).toHaveValue("1");

    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();
    await freshPage.goto(customerOrderUrl(TEST_CUSTOMERS.farmStand.token));
    await expect(
      freshPage.locator(".item-row", { hasText: TEST_PRODUCTS.kale.name }).locator(".stepper-val"),
    ).toHaveValue("0");
    await fresh.close();
  });
});
