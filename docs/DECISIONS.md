# bushel — Architectural Decisions

Locked during the planning session that produced `docs/PROJECT_PLAN.md`.
New decisions append; superseded decisions stay in place with a note.

---

## DEC-001 — Stack

**Decision:** Next.js 16 + TypeScript strict + Supabase + Resend + Twilio (toll-free SMS) + Vercel.

**Why:** Maximum stack consistency with user fluency (was a strong Next.js dev). Supabase bundles Postgres + RLS + auth (Google OAuth, magic-link primitives) + realtime, which removes several pieces of glue. Resend and Twilio cover email/SMS at trivial cost for ~7 customers. Vercel is already paid for via another project, so $0 marginal hosting cost.

**Notes:** baybranchfarm.com stays Astro on Netlify, untouched.

---

## DEC-002 — Domain

**Decision:** `order.baybranchfarm.com` (CNAME → Vercel); apex stays on Netlify.

**Why:** Cleanly isolates the auth/DB/serverless app from the static marketing site. DNS handles cross-host pointing transparently.

---

## DEC-003 — Admin auth

**Decision:** Single admin account via Google OAuth (Supabase Auth). Sharable if needed.

**Why:** Annabel runs the system; Eric does not need a separate account at this scale. Google OAuth is easier across the board than username/password.

---

## DEC-004 — Customer auth

**Decision:** Tokenized per-customer URL — `/c/<token>`. No email-verification round-trip. Each customer has a durable, regeneratable token.

**Why:** With ~7 known B2B customers manually entered by Annabel, a real magic-link flow adds friction without security gain. The tokenized URL pattern matches the spec's "click link in SMS to order" flow exactly.

**Trade-off accepted:** SMS forwarding could let an unintended recipient order as that customer. At this scale and for B2B, low risk.

---

## DEC-005 — Token reset

**Decision:** Admin "Regenerate link" button per customer; old token invalidated, new one auto-included in next send.

**Why:** Covers the SMS-forwarded / employee-departure cases without standing up a full auth flow.

---

## DEC-006 — Customer onboarding

**Decision:** Manual entry only. No public signup form in v1.

**Why:** ~7 known customers makes a public signup page overkill. Annabel types them in once.

---

## DEC-007 — Pricing

**Decision:** Single price list in v1. Per-customer pricing deferred to v2.

**Why:** Per-customer overrides are not trivial (data model + UI). v1 ships faster without them.

---

## DEC-008 — Fulfillment

**Decision:** Both delivery (primary) and pickup (secondary). Per-order checkbox at checkout. Customer record stores fixed delivery address.

**Why:** B2B customers receive deliveries at known fixed addresses. Some occasionally pick up. Customer-chooses-per-order keeps the door open.

---

## DEC-009 — No delivery zone validation; no delivery fee in v1

**Decision:** All customers are inside the implicit zone (defined by the customer list itself). v1 delivery is free.

**Why:** "Outside the zone" customers don't exist — they wouldn't be customers. Delivery fee revisits in v2.

---

## DEC-010 — Order statuses

**Decision:** New → Ready → (Picked Up | Delivered).

**Why:** No "Out for Delivery" intermediate state. Annabel's flow doesn't need it.

---

## DEC-011 — Ordering window

**Decision:** Single open/close toggle (source of truth) backed by configurable weekly schedule + manual "open for N hours" override that auto-closes.

**Why:** Hard cutoffs are nice in theory; real life intervenes. Toggle + override = automation by default, escape hatch always available.

---

## DEC-012 — Race condition handling

**Decision:** Strict, first-come-first-served. Atomic decrement on order submit; oversold line items rejected with "X just sold out, confirm without it?" prompt.

**Why:** Standard cart behavior; no awkward reconciliation phone call. v2 may revisit if 4-hour windows produce real conflicts.

---

## DEC-013 — Pickup windows

**Decision:** 4 fixed windows per week, configurable but set-once. Customer chooses one at checkout when picking up.

**Why:** Eliminates "what time?" back-and-forth. Same-every-week keeps the data model simple.

---

## DEC-014 — Reminders

**Decision:** Morning-of pickup reminder to pickup customers only. No delivery reminders.

**Why:** Delivery destinations are staffed B2B locations — they're already there.

---

## DEC-015 — Order edits/cancellations

**Decision:** Manual via Annabel in v1. Confirmation says "text Annabel to change."

**Why:** ~7 customers; self-serve isn't worth the implementation cost. Phase 8+ if it becomes painful.

---

## DEC-016 — Wave invoicing

**Decision:** CSV export from admin (with copy-to-clipboard option). Wave's existing Sheets import is the workflow. Wave API direct integration deferred to v2.

**Why:** User has a working CSV → Sheets → Wave workflow she's used for years. Half-day of work to ship; full API integration is days.

---

## DEC-017 — Tone

**Decision:** B2B-professional but warm. Less "you're on the list!", more "this week's availability — order by Tuesday 9pm."

**Why:** Customers are produce buyers and chefs doing their jobs, not neighbors. Warmth still matches Annabel's voice (per baybranchfarm.com); register is just a notch more grown-up.

---

## DEC-018 — Testing

**Decision:** Mirror sailbook's testing patterns:
- Playwright-only E2E (no Vitest unit suite)
- pgTAP RLS tests via `supabase test db`
- Local Supabase via Docker
- Three Playwright projects: mobile (375×667), tablet (768×1024), desktop (1440×900)
- 4 workers locally, 1 in CI, 2 retries, `forbidOnly: true` in CI
- `tests/helpers.ts` for shared auth/fixtures/runId
- `supabase/seed.sql` for pre-seeded test data
- GitHub Actions CI spins up Supabase Docker, runs both `playwright test` and `supabase test db`

**Why:** sailbook is a reference Next.js + Supabase project the user has already shipped — proven patterns to copy. Avoids the choice of unit-test-framework debate.

**Trade-off accepted:** No unit tests means slightly slower feedback on pure business logic (e.g. inventory decrement math). Acceptable at this scale.
