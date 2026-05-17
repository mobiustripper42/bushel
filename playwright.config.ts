import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local" });

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "tablet",
      // Admin is desktop-only (DEC-019); admin specs run on desktop project only.
      // notifications-flow.spec.ts + orders-flow.spec.ts exercise admin pages,
      // so they belong in the same admin-desktop-only bucket.
      testIgnore: [
        "**/admin*.spec.ts",
        "**/notifications-flow.spec.ts",
        "**/orders-flow.spec.ts",
      ],
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "mobile",
      // DEC-034 amends DEC-019: admin is mobile-responsive. Specs migrate off
      // this ignore list as each /admin/* page ships its mobile pass:
      //   Phase 6.4 (#109) — /admin/send + notifications-flow now mobile.
      //   Phase 6.5/6.6/6.7 — remaining admin pages still desktop-only.
      testIgnore: [
        "**/admin-alert-template.spec.ts",
        "**/admin-auth.spec.ts",
        "**/admin-customers.spec.ts",
        "**/admin-inventory.spec.ts",
        "**/admin-orders.spec.ts",
        "**/admin-orders-export.spec.ts",
        "**/admin-prepopulate.spec.ts",
        "**/admin-settings.spec.ts",
        "**/admin-shell.spec.ts",
        "**/orders-flow.spec.ts",
      ],
      use: { ...devices["iPhone 13"], browserName: "webkit", viewport: { width: 375, height: 812 } },
    },
  ],
});
