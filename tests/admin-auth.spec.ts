import { test, expect } from "@playwright/test";

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
