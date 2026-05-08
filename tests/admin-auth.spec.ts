import { test, expect } from "@playwright/test";

// Authenticated-but-not-admin and admin-access paths are not tested here —
// Google OAuth has no headless path. Those paths are covered by the pgTAP
// RLS tests for is_admin and will be revisited once a test-mode session
// injection mechanism lands (tracked in helpers.ts loginAsAdmin stub).

test.describe("admin route guard", () => {
  test("unauthenticated /admin redirects to /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirect preserves ?next param", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/[?&]next=%2Fadmin/);
  });

  test("login page is reachable", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});
