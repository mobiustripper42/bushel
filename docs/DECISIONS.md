# bushel — Architectural Decisions

Locked during planning + poker. New decisions append. Superseded notes stay.

---

## DEC-001 — Stack

**Decision:** Next.js 16 + TypeScript strict + Supabase + Twilio (toll-free SMS) + Vercel. baybranchfarm.com stays Astro on Netlify, untouched.

**Why:** User is fluent in Next.js. Supabase bundles Postgres + RLS + auth + realtime. Vercel is already paid. Resend dropped — see DEC-020.

---

## DEC-002 — Domain

**Decision:** `order.baybranchfarm.com` (CNAME → Vercel); apex stays on Netlify.

**Why:** Cleanly isolates the auth/DB/serverless app from the static marketing site.

---

## DEC-003 — Admin auth

**Decision:** Single admin via Google OAuth (Supabase Auth). Sharable.

**Why:** Annabel runs the system. Google OAuth is easier across the board.

---

## DEC-004 — Customer auth

**Decision:** Tokenized per-customer URL — `/c/<token>`. No email-verify round-trip. Each customer has a durable, regeneratable token.

**Why:** ~7 known B2B customers; magic-link is friction without security gain.

**Trade-off accepted:** SMS forwarding could let an unintended recipient order. Low risk at this scale.

---

## DEC-005 — Token reset

**Decision:** Admin "Regenerate link" button per customer; old token invalidated, new one auto-included in next send.

---

## DEC-006 — Customer onboarding

**Decision:** Manual entry only. No public signup form in v1.

---

## DEC-007 — Pricing

**Decision:** Single price list in v1. Per-customer pricing deferred to v2.

---

## DEC-008 — Fulfillment

**Decision:** Both delivery (primary) and pickup (secondary). Per-order checkbox at checkout. Customer record stores fixed delivery address.

---

## DEC-009 — No delivery zone validation; no delivery fee in v1

**Why:** All customers are inside the implicit zone (the customer list itself). Delivery fee revisits in v2.

---

## DEC-010 — Order statuses

**Decision:** New → Ready → (Picked Up | Delivered).

---

## DEC-011 — Ordering window

**Decision:** Single open/close toggle (source of truth) + configurable weekly schedule + manual "open for N hours" override that auto-closes.

**Note:** product owner discussion is open about whether to drop the open/close concept entirely. See Open Questions.

---

## DEC-012 — Order placement: optimistic

**Decision:** No strict rejection. Insert order + items in a transaction, decrement product qty (allow negative), set `needs_reconciliation` flag if any line went oversold. Admin sees flagged orders highlighted; reconciles via text.

**Why:** "Vegetables to friends, not heart medicine." May stay this way forever. Strict-rejection moved to Phase 8+ if needed.

---

## DEC-013 — Pickup windows

**Decision:** 4 fixed windows per week, configurable but set-once. Customer chooses one at checkout when picking up.

---

## DEC-014 — Reminders

**Decision:** Morning-of pickup reminder to pickup customers only. No delivery reminders (B2B locations are staffed).

---

## DEC-015 — Order edits/cancellations

**Decision:** Manual via Annabel in v1. Confirmation says "text Annabel to change."

---

## DEC-016 — Wave invoicing

**Decision:** CSV export (download + clipboard TSV). Wave's existing Sheets import is the workflow. Wave API direct integration deferred to v2.

---

## DEC-017 — Tone

**Decision:** B2B-professional but warm. Less "you're on the list!", more "this week's availability — order by Tuesday 9pm."

---

## DEC-018 — Testing

**Decision:** Mirror sailbook patterns:
- Playwright-only E2E (no Vitest unit suite)
- pgTAP RLS tests via `supabase test db`
- Local Supabase via Docker
- Three Playwright projects: mobile (375×667), tablet (768×1024), desktop (1440×900)
- 4 workers locally, 1 in CI, 2 retries, `forbidOnly: true` in CI
- `tests/helpers.ts` for shared auth/fixtures
- `supabase/seed.sql` for pre-seeded test data
- GitHub Actions CI runs both `playwright test` and `supabase test db`

---

## DEC-019 — Viewport scope

**Decision:** Admin desktop-only in v1. Customer order pages responsive across mobile/tablet/desktop, mobile-prioritized (95% of customer traffic via SMS link).

---

## DEC-020 — Notifications channel: SMS-only in v1

**Decision:** Resend dropped from stack. `notification_preference` enum on `customers` retained for v2 expansion to email. Admin alerts are SMS to Annabel's number.

---

## DEC-021 — CSS approach

**Decision:** Match sailbook's CSS approach (specifics confirmed at start of Phase 0 execution).

---

## DEC-022 — Order list filters

**Decision:** Sort by column + filter by week. Highlight `needs_reconciliation` rows in red regardless of sort/filter state.

---

## Open / Pending Product Owner Discussion

- **Minimum delivery amount (in dollars).** Threshold below which delivery is unavailable, or above which delivery is free. Phase 8+ candidate.
- **No open/close time?** Possibility of dropping the open/close toggle entirely (always open). Major scope reduction (eliminates 4b.1 + race specs in 4b.2). Needs deeper discussion before committing.
