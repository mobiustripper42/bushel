import { expect, test } from "@playwright/test";

import { buildSmsUrl, normalizePhone } from "@/lib/notifications/sms-deep-link";

// Pure-function unit tests. No browser, no page, no network.
// Bushel doesn't carry vitest/jest — Playwright's runner is the only test
// harness in the repo (DEC-023: light unit / heavy integration), so unit tests
// for pure libs ride here. Project tablet/mobile inherit and run the same
// assertions; harmless duplication for a 2-pt utility.

test.describe("buildSmsUrl", () => {
  test("basic ASCII body", () => {
    expect(buildSmsUrl({ phone: "+12162025718", body: "Hello" })).toBe(
      "sms:+12162025718?body=Hello",
    );
  });

  test("spaces encode as %20 (not +)", () => {
    expect(buildSmsUrl({ phone: "+12162025718", body: "Hello world" })).toBe(
      "sms:+12162025718?body=Hello%20world",
    );
  });

  test("newlines encode as %0A", () => {
    expect(
      buildSmsUrl({ phone: "+12162025718", body: "Line one\nLine two" }),
    ).toBe("sms:+12162025718?body=Line%20one%0ALine%20two");
  });

  test("URL-reserved characters are percent-encoded", () => {
    expect(
      buildSmsUrl({ phone: "+12162025718", body: "a&b?c=d#e+f/g" }),
    ).toBe("sms:+12162025718?body=a%26b%3Fc%3Dd%23e%2Bf%2Fg");
  });

  test("multi-byte UTF-8 emoji encoded", () => {
    // 🌱 (U+1F331) → F0 9F 8C B1
    expect(buildSmsUrl({ phone: "+12162025718", body: "Order ready 🌱" })).toBe(
      "sms:+12162025718?body=Order%20ready%20%F0%9F%8C%B1",
    );
  });

  test("empty body still produces ?body= (consistent shape)", () => {
    expect(buildSmsUrl({ phone: "+12162025718", body: "" })).toBe(
      "sms:+12162025718?body=",
    );
  });

  test("normalizes phone formatting in the URL", () => {
    expect(buildSmsUrl({ phone: "(216) 202-5718", body: "hi" })).toBe(
      "sms:2162025718?body=hi",
    );
  });
});

test.describe("normalizePhone", () => {
  test("strips parens, dashes, dots, and whitespace", () => {
    expect(normalizePhone("(216) 202-5718")).toBe("2162025718");
    expect(normalizePhone("216-202-5718")).toBe("2162025718");
    expect(normalizePhone("216.202.5718")).toBe("2162025718");
    expect(normalizePhone(" 216 202 5718 ")).toBe("2162025718");
  });

  test("preserves a leading +", () => {
    expect(normalizePhone("+1 216-202-5718")).toBe("+12162025718");
    expect(normalizePhone("+1 (216) 202-5718")).toBe("+12162025718");
  });

  test("a + only counts when it leads — interior + chars are stripped", () => {
    // No legitimate phone format has a non-leading +, but we don't want to
    // silently pass one through and have the device do something weird.
    expect(normalizePhone("216+202+5718")).toBe("2162025718");
  });

  test("empty input → empty output (no throw)", () => {
    expect(normalizePhone("")).toBe("");
  });

  test("leading whitespace before + is tolerated", () => {
    expect(normalizePhone(" +1 216-202-5718")).toBe("+12162025718");
    expect(normalizePhone("\t+12162025718")).toBe("+12162025718");
  });

  test("extension digits glue onto the main number (pinned behavior, V1)", () => {
    // We strip all non-digit chars wholesale, so `x123` becomes `123` and
    // concatenates to produce a wrong number. Annabel does not enter
    // extensions today; if she ever does, this test documents the gotcha
    // and we add ext-aware parsing then.
    expect(normalizePhone("216-202-5718 x123")).toBe("2162025718123");
  });
});
