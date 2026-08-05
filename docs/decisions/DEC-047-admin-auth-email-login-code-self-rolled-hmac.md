---
id: DEC-047
title: "Admin auth: email → login code + self-rolled HMAC session via Resend (drops Google OAuth / Supabase Auth)"
topic: "Auth & access boundary"
amends:
  - id: DEC-033
    relation: amends
    scope: "the rationale only — a mail provider now exists, but alerting does not move to email"
---

## DEC-047: Admin auth: email → login code + self-rolled HMAC session via Resend (drops Google OAuth / Supabase Auth)

**Decision:** Admin login is muster's full flow, ported verbatim: admin enters their email, a short-lived one-time code lands in their inbox via **Resend**, and verifying it mints a stateless HMAC-SHA256 session token stored in an httpOnly cookie. The port covers muster's `src/auth/session.ts` (pure node:crypto, zero dependencies) plus its `login_codes` table (TTL + attempt cap) and code-email sending. Admin identities live in a 3-row `admins` table (Emma, Eric, Annabel) — only listed emails can request a code. Google OAuth and `@supabase/ssr` are removed. The session token is **dual-consumable** — cookie for the browser, bearer header for the Phase 11 native client — so Phase 11 needs no re-auth work.

**Why:** The first draft of this DEC used a shared access code in an env var, reasoning that DEC-033's "no mail provider" stance made muster's email machinery not worth it. Rejected as hacky: a shared static secret has no per-user attribution, rotates only via redeploy, and saves very little — the Resend wire-up is trivial and the rest of the flow ports from muster unchanged. Per-user attribution now comes free. Removing OAuth still unblocks headless admin Playwright auth (long a sore point — Phase 1's authenticated admin tests were deferred to #27 over exactly this): global-setup mints the session directly (the same HMAC secret the app verifies with), and the login-flow specs drive the real request→verify path by overwriting the stored code's hash with a known value — only `sha256(code)` is ever stored, so no plaintext is read from the DB. Either way, no inbox in the loop. (The 10.6 headless helper uses the same overwrite-hash trick.)

**Resend scope:** auth-only. It amends DEC-033's rationale (a mail provider now exists) but not its outcome — alerting does not move to email. Telegram remains today's alert channel only until DEC-050's push replaces it; Eric wants off Telegram, and push is that path, not email.

**Sending account (10.3):** the code-email sends through the existing **brewcle** Resend account rather than a bushel-owned domain — chosen for expedience at 2–3 admins / a handful of auth emails a month, not worth standing up and DKIM-verifying a bushel domain. `RESEND_FROM` must be on the **exact verified domain** — that's the root `brewcle.com`, e.g. `Bay Branch Farm <bushel-auth@brewcle.com>` (a bushel-identifiable local-part keeps sends greppable in brewcle's logs). **NB:** Resend verifies an exact domain, so the `crew-tips.brewcle.com` subdomain is NOT covered by the root verification and 403s ("domain is not verified") — use `@brewcle.com`. `RESEND_API_KEY` is that account's key. **Accepted tradeoffs:** (a) bushel admin login depends on the brewcle account/domain staying live — reversible by repointing two env vars, no code; (b) these sends meter on brewcle's Resend usage, crossing the otherwise-separate per-project billing line.

**Supersedes:** DEC-003 (single admin via Google OAuth / Supabase Auth). **Unaffected:** DEC-004 customer token auth — customers never used Supabase Auth; the `bbf_customer_token` cookie → `customers.token` path is untouched.

---
