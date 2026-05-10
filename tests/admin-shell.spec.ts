import { test, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./helpers";

test.describe("admin shell — unauthenticated", () => {
  test("unauthenticated /admin redirects to /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page renders sign-in button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});

test.describe("admin shell — authenticated", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test("sidebar and nav render for authenticated admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("Bay Branch Farm")).toBeVisible();
    await expect(page.getByRole("navigation", { name: /admin navigation/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /inventory/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /customers/i })).toBeVisible();
  });

  test("nav link marks active page with aria-current", async ({ page }) => {
    await page.goto("/admin/inventory");
    const inventoryLink = page.getByRole("link", { name: /inventory/i });
    await expect(inventoryLink).toHaveAttribute("aria-current", "page");
    const customersLink = page.getByRole("link", { name: /customers/i });
    await expect(customersLink).not.toHaveAttribute("aria-current");
  });
});

// Isolated from the shared-session block — sign-out invalidates the refresh
// token server-side (scope: global), which would corrupt retries of sibling tests.
test.describe("admin shell — sign-out", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test("sign-out redirects to /login", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
