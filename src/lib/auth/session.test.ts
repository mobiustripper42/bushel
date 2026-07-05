/**
 * HMAC session unit tests (DEC-047/DEC-051) — the coverage 10.3 deferred for
 * lack of a unit runner. Pure: no DB, no framework, injected clock.
 */
import { describe, expect, it } from "vitest";
import {
  shouldRenew,
  signSession,
  verifySession,
  type Session,
} from "./session";

const SECRET = "unit-test-secret";
const now = (ms = 0) => new Date(Date.parse("2026-07-05T12:00:00Z") + ms);

function make(expiresMs: number): Session {
  return {
    subjectKind: "admin",
    subjectId: "a0000000-0000-0000-0000-000000000001",
    expiresAt: now(expiresMs).toISOString(),
  };
}

describe("signSession / verifySession", () => {
  it("round-trips a valid token to its subject", () => {
    const token = signSession(make(60_000), SECRET);
    const result = verifySession(token, SECRET, now());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.subject).toEqual({
        kind: "admin",
        id: "a0000000-0000-0000-0000-000000000001",
      });
    }
  });

  it("rejects a tampered payload (bad_signature)", () => {
    const token = signSession(make(60_000), SECRET);
    // Flip a byte in the payload half.
    const [payload, sig] = token.split(".");
    const tampered = `${payload.slice(0, -1)}${payload.slice(-1) === "A" ? "B" : "A"}.${sig}`;
    expect(verifySession(tampered, SECRET, now())).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSession(make(60_000), "other-secret");
    expect(verifySession(token, SECRET, now())).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects an expired token", () => {
    const token = signSession(make(1_000), SECRET);
    expect(verifySession(token, SECRET, now(2_000))).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("treats the expiry instant as dead (>= is expired)", () => {
    const token = signSession(make(1_000), SECRET);
    expect(verifySession(token, SECRET, now(1_000)).ok).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(verifySession("not-a-token", SECRET, now())).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(verifySession("", SECRET, now())).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects a payload with a non-admin subjectKind (malformed)", () => {
    const forged = {
      subjectKind: "crew",
      subjectId: "x",
      expiresAt: now(60_000).toISOString(),
    };
    // Re-sign with the real secret so it clears the HMAC and only the shape check catches it.
    const token = signSession(forged as unknown as Session, SECRET);
    expect(verifySession(token, SECRET, now())).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});

describe("shouldRenew", () => {
  it("is true inside the renewal window", () => {
    expect(shouldRenew(make(1_000), now(), 3_000)).toBe(true);
  });

  it("is false when the token has plenty of life left", () => {
    expect(shouldRenew(make(10_000), now(), 3_000)).toBe(false);
  });
});
