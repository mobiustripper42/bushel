/**
 * Bearer-guard unit tests (Phase 11.1). Pure — no DB. Exercises the header
 * parsing + the pass-through to verifySession: a good token yields the subject,
 * everything else (missing, wrong scheme, tampered, expired) yields null so the
 * route returns 401.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearerSubject } from "./bearer";
import { makeSession, signSession, type Subject } from "./session";

const SECRET = "bearer-test-secret";
const SUBJECT: Subject = { kind: "admin", id: "a0000000-0000-0000-0000-000000000009" };
const NOW = new Date("2026-07-06T12:00:00Z");

// bearerSubject reads sessionSecret() from the env; pin it for the file.
let prevSecret: string | undefined;
beforeAll(() => {
  prevSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = SECRET;
});
afterAll(() => {
  if (prevSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = prevSecret;
});

function reqWith(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request("http://bushel.test/api/mobile/orders", { headers });
}

function tokenValidAt(now: Date, ttlMs: number, secret = SECRET): string {
  return signSession(makeSession(SUBJECT, now, ttlMs), secret);
}

describe("bearerSubject", () => {
  it("returns the subject for a valid, unexpired bearer token", () => {
    const token = tokenValidAt(NOW, 60_000);
    const subject = bearerSubject(reqWith(`Bearer ${token}`), NOW);
    expect(subject).toEqual(SUBJECT);
  });

  it("is case-insensitive on the scheme", () => {
    const token = tokenValidAt(NOW, 60_000);
    expect(bearerSubject(reqWith(`bearer ${token}`), NOW)).toEqual(SUBJECT);
  });

  it("returns null when the Authorization header is absent", () => {
    expect(bearerSubject(reqWith(undefined), NOW)).toBeNull();
  });

  it("returns null for a non-Bearer scheme", () => {
    const token = tokenValidAt(NOW, 60_000);
    expect(bearerSubject(reqWith(`Basic ${token}`), NOW)).toBeNull();
  });

  it("returns null for a bare token with no scheme", () => {
    const token = tokenValidAt(NOW, 60_000);
    expect(bearerSubject(reqWith(token), NOW)).toBeNull();
  });

  it("returns null for a malformed token", () => {
    expect(bearerSubject(reqWith("Bearer not-a-token"), NOW)).toBeNull();
  });

  it("returns null for a token signed with a different secret", () => {
    const token = tokenValidAt(NOW, 60_000, "some-other-secret");
    expect(bearerSubject(reqWith(`Bearer ${token}`), NOW)).toBeNull();
  });

  it("returns null once the token has expired", () => {
    const token = tokenValidAt(NOW, 60_000);
    const later = new Date(NOW.getTime() + 120_000);
    expect(bearerSubject(reqWith(`Bearer ${token}`), later)).toBeNull();
  });
});
