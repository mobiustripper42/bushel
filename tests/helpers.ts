const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

export const ADMIN_STORAGE_STATE = "playwright/.auth/admin.json";

export function customerOrderUrl(token: string): string {
  return `${BASE_URL}/c/${token}`;
}

// Admin session is pre-loaded via storageState from global-setup.ts.
// Use `test.use({ storageState: ADMIN_STORAGE_STATE })` in authenticated test blocks.

export const TEST_CUSTOMERS = {
  farmStand: {
    name: "Test Farm Stand",
    token: "testtoken-farmstand-0001",
  },
  restaurant: {
    name: "Test Restaurant",
    token: "testtoken-restaurant-0001",
  },
} as const;

export const TEST_PRODUCTS = {
  kale:  { id: "cccccccc-0000-0000-0000-000000000001", name: "Kale",  unit: "bunch", price_cents: 300,  qty_available: 10 },
  eggs:  { id: "cccccccc-0000-0000-0000-000000000002", name: "Eggs",  unit: "dozen", price_cents: 600,  qty_available: 5  },
  honey: { id: "cccccccc-0000-0000-0000-000000000003", name: "Honey", unit: "jar",   price_cents: 1200, qty_available: 8  },
} as const;
