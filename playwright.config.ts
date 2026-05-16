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
      // Admin is desktop-only (DEC-019); admin specs run on desktop project only.
      // notifications-flow.spec.ts + orders-flow.spec.ts exercise admin pages,
      // so they belong in the same admin-desktop-only bucket.
      testIgnore: [
        "**/admin*.spec.ts",
        "**/notifications-flow.spec.ts",
        "**/orders-flow.spec.ts",
      ],
      use: { ...devices["iPhone 13"], browserName: "webkit", viewport: { width: 375, height: 812 } },
    },
  ],
});
