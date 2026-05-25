import { expect, test } from "@playwright/test";

import { adminOrderAlertText } from "@/lib/notifications/admin-alert-template";

// Pure-function unit tests for the Telegram message body sent to the operator
// when a customer submits an order (Phase 4.3, DEC-033).
//
// #159: items count = sum of qty across lines (5 lb basil + 10 lettuce = 15),
// labelled "items" not "lines".

test.describe("adminOrderAlertText", () => {
  test("single-item order — singular wording", () => {
    expect(
      adminOrderAlertText({
        customerName: "Hannah",
        weekOf: "2026-05-11",
        itemCount: 1,
        totalCents: 3000,
        adminOrdersUrl: "https://order.baybranchfarm.com/admin/orders",
      }),
    ).toBe(
      [
        "New order — Hannah, $30.00",
        "",
        "Customer: Hannah",
        "Week of: 2026-05-11",
        "Items: 1 item",
        "Total: $30.00",
        "",
        "https://order.baybranchfarm.com/admin/orders",
      ].join("\n"),
    );
  });

  test("multi-item order — plural wording", () => {
    const body = adminOrderAlertText({
      customerName: "Hannah",
      weekOf: "2026-05-11",
      itemCount: 15,
      totalCents: 4320,
      adminOrdersUrl: "https://order.baybranchfarm.com/admin/orders",
    });
    expect(body).toContain("Items: 15 items");
    expect(body).toContain("Total: $43.20");
    expect(body).toContain("New order — Hannah, $43.20");
  });

  test("cents formatting — pads single-digit cents", () => {
    const body = adminOrderAlertText({
      customerName: "Tom",
      weekOf: "2026-05-11",
      itemCount: 2,
      totalCents: 305,
      adminOrdersUrl: "x",
    });
    expect(body).toContain("$3.05");
  });

  test("cents formatting — zero cents", () => {
    const body = adminOrderAlertText({
      customerName: "Tom",
      weekOf: "2026-05-11",
      itemCount: 2,
      totalCents: 1000,
      adminOrdersUrl: "x",
    });
    expect(body).toContain("$10.00");
  });

  test("large totals format with thousands grouping", () => {
    const body = adminOrderAlertText({
      customerName: "Big Order Co",
      weekOf: "2026-05-11",
      itemCount: 25,
      totalCents: 123456,
      adminOrdersUrl: "x",
    });
    expect(body).toContain("$1,234.56");
  });

  test("admin orders URL appears as the last line", () => {
    const body = adminOrderAlertText({
      customerName: "Hannah",
      weekOf: "2026-05-11",
      itemCount: 1,
      totalCents: 100,
      adminOrdersUrl: "https://order.baybranchfarm.com/admin/orders",
    });
    const lines = body.split("\n");
    expect(lines[lines.length - 1]).toBe("https://order.baybranchfarm.com/admin/orders");
  });
});
