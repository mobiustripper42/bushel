/**
 * Login-code request/verify logic (DEC-047/DEC-051) — the coverage 10.3 shipped
 * without: `src/lib/auth/login-code.ts` was exercised only by admin-auth.spec's
 * handful of E2E assertions. This drives the branches directly against docker
 * Postgres + the real admins/login_codes tables, with injected clock + code
 * generator (deterministic, no email, no browser). Ported from muster's
 * login-code.test.ts.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  hashCode,
  normalizeEmail,
  randomCode,
  requestLoginCode,
  verifyLoginCode,
} from "@/lib/auth/login-code";
import { canConnect, closePool, migrateTestDb, resetData } from "./helpers";

const EMAIL = "Login.Code@Bushel.test"; // stored mixed-case on purpose
const ADMIN_ID = "b0000000-0000-0000-0000-000000000001";
const BASE = Date.parse("2026-07-05T12:00:00Z");
const at = (ms = 0) => new Date(BASE + ms);
const fixed = (code: string) => () => code;

// Pure helpers — always run, no DB needed.
describe("login-code helpers", () => {
  it("normalizeEmail trims + lowercases", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
  it("randomCode is always a 6-digit string", () => {
    for (let i = 0; i < 50; i++) expect(randomCode()).toMatch(/^\d{6}$/);
  });
});

const d = (await canConnect()) ? describe : describe.skip;

d("login codes (pg-integration)", () => {
  beforeAll(async () => {
    await migrateTestDb();
    // A dedicated test admin (admins isn't in resetData's truncate list, so this
    // persists across tests; the 3 seeded real admins are untouched).
    await query(
      `insert into admins (id, email, name) values ($1, $2, 'Login Code Test')
       on conflict (email) do update set id = excluded.id, name = excluded.name, is_active = true`,
      [ADMIN_ID, EMAIL],
    );
  });
  afterAll(closePool);
  beforeEach(resetData); // clears login_codes; admins persist

  /** Drive request → return the minted code (fails if it didn't deliver). */
  async function mint(code = "123456", now = at()): Promise<string> {
    const r = await requestLoginCode(EMAIL, { now, mintCode: fixed(code) });
    if (r.outcome !== "deliver") throw new Error("expected delivery");
    return r.code;
  }

  async function storedHash(): Promise<string | undefined> {
    const rows = await query<{ code_hash: string }>(
      `select code_hash from login_codes where subject_kind='admin' and subject_id=$1`,
      [ADMIN_ID],
    );
    return rows[0]?.code_hash;
  }

  describe("requestLoginCode", () => {
    it("mints + asks to deliver for a matching email", async () => {
      const r = await requestLoginCode(EMAIL, { now: at(), mintCode: fixed("123456") });
      expect(r).toMatchObject({
        outcome: "deliver",
        recipientEmail: EMAIL,
        recipientName: "Login Code Test",
        code: "123456",
        subject: { kind: "admin", id: ADMIN_ID },
      });
      const [row] = await query<{ code_hash: string; attempts: number }>(
        `select code_hash, attempts from login_codes where subject_kind='admin' and subject_id=$1`,
        [ADMIN_ID],
      );
      expect(row.code_hash).toBe(hashCode("123456"));
      expect(row.attempts).toBe(0);
    });

    it("matches case-insensitively and trims whitespace", async () => {
      const r = await requestLoginCode("  login.code@bushel.test  ", {
        now: at(),
        mintCode: fixed("123456"),
      });
      expect(r.outcome).toBe("deliver");
    });

    it("skips (no leak, no persist) for an unknown email", async () => {
      const r = await requestLoginCode("stranger@nope.test", { now: at(), mintCode: fixed("123456") });
      expect(r.outcome).toBe("skip");
      expect(await storedHash()).toBeUndefined();
    });

    it("skips for a deactivated admin", async () => {
      await query(`update admins set is_active=false where id=$1`, [ADMIN_ID]);
      try {
        const r = await requestLoginCode(EMAIL, { now: at(), mintCode: fixed("123456") });
        expect(r.outcome).toBe("skip");
      } finally {
        await query(`update admins set is_active=true where id=$1`, [ADMIN_ID]);
      }
    });

    it("suppresses a re-mint inside the cooldown, then re-mints after it", async () => {
      await mint("111111", at(0));
      const within = await requestLoginCode(EMAIL, { now: at(30_000), mintCode: fixed("222222") });
      expect(within.outcome).toBe("skip");
      // The original code is left in place — the cooldown one was discarded.
      expect(await storedHash()).toBe(hashCode("111111"));
      // ...and still functionally redeemable (the no-op path didn't corrupt the
      // row). This consumes it, so the re-mint below now also has a spent code.
      expect((await verifyLoginCode(EMAIL, "111111", { now: at(31_000) })).ok).toBe(true);

      const after = await requestLoginCode(EMAIL, { now: at(120_000), mintCode: fixed("333333") });
      expect(after.outcome).toBe("deliver");
      expect(await storedHash()).toBe(hashCode("333333"));
    });
  });

  describe("verifyLoginCode", () => {
    it("accepts the right code once, then refuses the replay (single-use CAS)", async () => {
      const code = await mint();
      expect(await verifyLoginCode(EMAIL, code, { now: at(1000) })).toEqual({
        ok: true,
        subject: { kind: "admin", id: ADMIN_ID },
      });
      expect(await verifyLoginCode(EMAIL, code, { now: at(2000) })).toEqual({
        ok: false,
        reason: "invalid",
      });
    });

    it("rejects a wrong code and counts it against the cap", async () => {
      await mint("123456");
      expect(await verifyLoginCode(EMAIL, "000000", { now: at(1000) })).toEqual({
        ok: false,
        reason: "invalid",
      });
      const [{ attempts }] = await query<{ attempts: number }>(
        `select attempts from login_codes where subject_kind='admin' and subject_id=$1`,
        [ADMIN_ID],
      );
      expect(attempts).toBe(1);
    });

    it("locks after the attempt ceiling — even a correct code can't redeem", async () => {
      const code = await mint("123456");
      let last;
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        last = await verifyLoginCode(EMAIL, "000000", { now: at(1000 + i) });
      }
      expect(last).toEqual({ ok: false, reason: "locked" });
      // The real code is dead too.
      expect(await verifyLoginCode(EMAIL, code, { now: at(2000) })).toEqual({
        ok: false,
        reason: "locked",
      });
    });

    it("treats an expired code as expired", async () => {
      const code = await mint("123456", at(0));
      expect(await verifyLoginCode(EMAIL, code, { now: at(CODE_TTL_MS + 60_000) })).toEqual({
        ok: false,
        reason: "expired",
      });
    });

    it("is invalid for a non-matching email (no code exists)", async () => {
      expect(await verifyLoginCode("stranger@nope.test", "123456", { now: at(1000) })).toEqual({
        ok: false,
        reason: "invalid",
      });
    });
  });
});
