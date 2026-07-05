/**
 * Admin self-serve login codes (DEC-047) — muster's src/auth/login-code.ts
 * ported onto bushel's direct-pg data layer (the muster Repository port becomes
 * inline SQL against the `admins` + `login_codes` tables from 0002).
 *
 *   request → match an email to an admin, mint a 6-digit code, store only its
 *             hash (one live code per admin — re-request upserts).
 *   verify  → re-hash a presented code, find the admin's live code, check it's
 *             live and under the attempt cap, and CONSUME it atomically (CAS) so
 *             a code can't be redeemed twice.
 *
 * Security rests on the CAP, not the entropy: 6 digits + a 5-attempt ceiling +
 * a 10-minute TTL is a ~1-in-200k shot per code — the throttle does the work.
 *
 * Clockless/deterministic like muster's core: `now` and `mintCode` are injected
 * (defaults cover production). Hashing is sha256 (pure), so only the hash ever
 * touches storage.
 */

import { createHash, randomInt } from "node:crypto";
import { query } from "@/lib/db";
import type { Subject } from "./session";

/** How long a code stays redeemable. Short by design. */
export const CODE_TTL_MS = 10 * 60_000;
/**
 * Failed guesses before the code is dead — the brute-force ceiling PER CODE. A
 * re-mint after the cooldown writes a fresh row with attempts:0, so the sustained
 * rate is MAX_ATTEMPTS per RESEND_COOLDOWN_MS. Accepted posture at this scale.
 */
export const MAX_ATTEMPTS = 5;
/** Suppress a fresh re-mint within this window — anti-spam + dedup. */
export const RESEND_COOLDOWN_MS = 60_000;

/** sha256(code) as hex — the only form of the code that's ever stored. */
export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Production code generator: a uniform 6-digit string, zero-padded. */
export function randomCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Trim + lowercase — the canonical form both sides compare on. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

type AdminRow = { id: string; email: string; name: string };

/** Resolve an entered email to a single active admin, or null. */
async function matchAdminByEmail(email: string): Promise<AdminRow | null> {
  const rows = await query<AdminRow>(
    `select id::text as id, email, name
       from admins
      where is_active = true and lower(email) = $1
      order by id
      limit 1`,
    [normalizeEmail(email)],
  );
  return rows[0] ?? null;
}

export type RequestResult =
  | {
      outcome: "deliver";
      subject: Subject;
      recipientEmail: string;
      recipientName: string;
      code: string;
    }
  | { outcome: "skip" };

export interface RequestDeps {
  now?: Date;
  /** Returns a fresh 6-digit code. Defaults to crypto-random. */
  mintCode?: () => string;
}

/**
 * Mint a login code for a matching email and tell the caller to deliver it.
 *
 * No-enumeration: the caller shows the SAME screen on `deliver` and `skip`, and
 * the mint+hash CPU work runs on both paths. Only `deliver` actually sends —
 * which the requester can't observe, provided the send is off the hot path (the
 * action schedules it via `after()`), so a match isn't a timing oracle.
 *
 * A live code younger than the cooldown suppresses a re-mint (anti-spam) but
 * still returns `skip`, indistinguishable from a non-match.
 */
export async function requestLoginCode(
  email: string,
  deps: RequestDeps = {},
): Promise<RequestResult> {
  const now = deps.now ?? new Date();
  const mintCode = deps.mintCode ?? randomCode;

  const admin = await matchAdminByEmail(email);

  // Run the mint+hash regardless — equal CPU work on match and non-match.
  const code = mintCode();
  const codeHash = hashCode(code);

  if (!admin) return { outcome: "skip" };

  // Anti-spam: a still-live code minted within the cooldown is left in place —
  // the admin already has one in their inbox. Indistinguishable from a miss.
  const existing = (
    await query<{ created_at: string; expires_at: string; consumed_at: string | null }>(
      `select created_at, expires_at, consumed_at
         from login_codes
        where subject_kind = 'admin' and subject_id = $1`,
      [admin.id],
    )
  )[0];
  if (
    existing &&
    !existing.consumed_at &&
    now.getTime() < Date.parse(existing.expires_at) &&
    now.getTime() - Date.parse(existing.created_at) < RESEND_COOLDOWN_MS
  ) {
    return { outcome: "skip" };
  }

  const expiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
  await query(
    `insert into login_codes
       (subject_kind, subject_id, code_hash, created_at, expires_at, attempts, consumed_at)
     values ('admin', $1, $2, $3, $4, 0, null)
     on conflict (subject_kind, subject_id) do update
       set code_hash = excluded.code_hash,
           created_at = excluded.created_at,
           expires_at = excluded.expires_at,
           attempts = 0,
           consumed_at = null`,
    [admin.id, codeHash, now.toISOString(), expiresAt],
  );

  return {
    outcome: "deliver",
    subject: { kind: "admin", id: admin.id },
    recipientEmail: admin.email,
    recipientName: admin.name,
    code,
  };
}

export type VerifyFailure = "invalid" | "expired" | "locked";

export type VerifyResult =
  | { ok: true; subject: Subject }
  | { ok: false; reason: VerifyFailure };

export interface VerifyDeps {
  now?: Date;
}

/**
 * Redeem a presented code. Subject-scoped (find the code by WHO, then compare
 * the hash) so a wrong guess counts against the cap. A correct code consumes via
 * a CAS update — single-use even under two simultaneous submits. `invalid` is
 * deliberately vague (wrong code, no code, or non-matching email all look the
 * same) so nothing leaks.
 */
export async function verifyLoginCode(
  email: string,
  code: string,
  deps: VerifyDeps = {},
): Promise<VerifyResult> {
  const now = deps.now ?? new Date();

  const admin = await matchAdminByEmail(email);
  if (!admin) return { ok: false, reason: "invalid" };

  const record = (
    await query<{
      code_hash: string;
      expires_at: string;
      attempts: number;
      consumed_at: string | null;
    }>(
      `select code_hash, expires_at, attempts, consumed_at
         from login_codes
        where subject_kind = 'admin' and subject_id = $1`,
      [admin.id],
    )
  )[0];
  if (!record || record.consumed_at) return { ok: false, reason: "invalid" };
  if (now.getTime() >= Date.parse(record.expires_at)) {
    return { ok: false, reason: "expired" };
  }
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" };

  if (hashCode(code) !== record.code_hash) {
    const bumped = await query<{ attempts: number }>(
      `update login_codes set attempts = attempts + 1
        where subject_kind = 'admin' and subject_id = $1
        returning attempts`,
      [admin.id],
    );
    const attempts = bumped[0]?.attempts ?? MAX_ATTEMPTS;
    return { ok: false, reason: attempts >= MAX_ATTEMPTS ? "locked" : "invalid" };
  }

  // CAS consume — the WHERE guard makes it single-use under concurrent submits.
  const won = await query<{ subject_id: string }>(
    `update login_codes set consumed_at = $2
      where subject_kind = 'admin' and subject_id = $1 and consumed_at is null
      returning subject_id`,
    [admin.id, now.toISOString()],
  );
  if (won.length === 0) return { ok: false, reason: "invalid" };

  return { ok: true, subject: { kind: "admin", id: admin.id } };
}
