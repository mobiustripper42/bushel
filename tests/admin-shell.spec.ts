import { test, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./helpers";
import { writeAdminStorageState } from "./global-setup";

test.describe("admin shell — unauthenticated", () => {
  test("unauthenticated /admin redirects to /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page renders the email-code request form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /email me a code/i })).toBeVisible();
  });
});

test.describe("admin shell — authenticated", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test("sidebar and nav render for authenticated admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("navigation", { name: /admin navigation/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /inventory/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /customers/i })).toBeVisible();
  });

  test("send nav reads 'Send Texts' and sits between Customers and Orders (#188)", async ({ page }) => {
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: /admin navigation/i });
    await expect(nav.getByRole("link", { name: /send texts/i })).toBeVisible();
    // Old label is gone from the nav.
    await expect(nav.getByText("Send Update")).toHaveCount(0);
    // DOM order: Customers → Send Texts → Orders.
    const labels = await nav.locator(".admin-nav-label").allTextContents();
    expect(labels.indexOf("Customers")).toBeLessThan(labels.indexOf("Send Texts"));
    expect(labels.indexOf("Send Texts")).toBeLessThan(labels.indexOf("Orders"));
  });

  test("nav link marks active page with aria-current", async ({ page }) => {
    await page.goto("/admin/inventory");
    const inventoryLink = page.getByRole("link", { name: /inventory/i });
    await expect(inventoryLink).toHaveAttribute("aria-current", "page");
    const customersLink = page.getByRole("link", { name: /customers/i });
    await expect(customersLink).not.toHaveAttribute("aria-current");
  });

  test("top bar shows breadcrumb + week pill", async ({ page }) => {
    await page.goto("/admin/inventory");
    const top = page.locator(".admin-top");
    await expect(top).toBeVisible();
    await expect(top.locator(".admin-crumb")).toContainText("Admin");
    await expect(top.locator(".admin-crumb-active")).toHaveText("Inventory");
    await expect(top.locator(".admin-week-key")).toHaveText(/Week of/i);
    // Pattern: "Sun, May 3" / "Tue, Jul 14" — weekday, comma, space, month, day.
    await expect(top.locator(".admin-week-val")).toHaveText(
      /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), [A-Z][a-z]{2} \d{1,2}$/,
    );
  });

  test("breadcrumb updates as you navigate", async ({ page }) => {
    await page.goto("/admin/customers");
    await expect(page.locator(".admin-crumb-active")).toHaveText("Customers");
    await page.goto("/admin/settings");
    await expect(page.locator(".admin-crumb-active")).toHaveText("Settings");
  });

  test("sidebar footer shows current-week range + status pill", async ({ page }) => {
    await page.goto("/admin");
    const foot = page.locator(".admin-side-foot");
    await expect(foot).toBeVisible();
    await expect(foot).toContainText(/This week/i);
    // Range: "May 3 – May 9" / "Jun 28 – Jul 4" — accept both same-month and
    // cross-month formats.
    await expect(foot).toContainText(
      /[A-Z][a-z]{2} \d{1,2} – ([A-Z][a-z]{2} )?\d{1,2}/,
    );
    await expect(foot.locator(".status-dot")).toBeVisible();
  });

  test("inventory nav has a badge with the listed-product count", async ({ page }) => {
    await page.goto("/admin");
    const badge = page.getByRole("link", { name: /inventory/i }).locator(".admin-nav-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/^\d+ listed$/);
  });

  test("sidebar shows the build version tag below the status row", async ({ page }) => {
    await page.goto("/admin");
    const version = page.locator(".admin-side [data-testid='version-tag']");
    await expect(version).toBeVisible();
    await expect(version).toHaveText(/^v\d+\.\d+\.\d+/);
  });
});

// Isolated from the shared-session block. The session is a stateless HMAC cookie
// (DEC-047), so sign-out only clears THIS context's cookie — the shared
// storageState file on disk is untouched. The afterAll re-mint is belt-and-
// suspenders, keeping the shared state fresh for later specs regardless.
test.describe("admin shell — sign-out", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test.afterAll(async () => {
    await writeAdminStorageState();
  });

  test("sign-out redirects to /login", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
