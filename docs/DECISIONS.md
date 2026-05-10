# bushel — Architectural Decisions

Locked during planning + poker. New decisions append. Superseded notes stay.

---

## DEC-001 — Stack

**Decision:** Next.js 16 + TypeScript strict + Supabase + Vercel + transactional email (provider TBD). No third-party SMS — customer outbound is operator-sent via native `sms:` deep links. baybranchfarm.com stays Astro on Netlify, untouched.

**Why:** User is fluent in Next.js. Supabase bundles Postgres + RLS + auth + realtime. Vercel is already paid. Twilio dropped — see DEC-026. Email/PWA-push admin alert — see DEC-027.

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

**Why:** "Vegetables to friends, not heart medicine." May stay this way forever. Strict-rejection moved to Phase 7+ if needed.

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

## DEC-020 — Notifications channel: SMS-only in v1 [SUPERSEDED]

**Status:** Superseded 2026-05-08 by DEC-026 (customer outbound via operator-sent `sms:` deep links) and DEC-027 (admin order-arrival alert via email, with PWA push as upgrade).

**Original decision:** Resend dropped from stack. `notification_preference` enum on `customers` retained for v2 expansion to email. Admin alerts are SMS to Annabel's number.

**Why superseded:** Twilio's 10DLC compliance overhead (brand registration, campaign vetting, multi-week approval queue, ongoing fees) is disproportionate at ~21 messages/week. Pivoting customer outbound to operator-sent deep links keeps the work in the P2P regulatory perimeter at $0/mo. Admin order alerts move to transactional email since the operator-in-the-loop pattern doesn't apply to automated machine-to-Annabel messages.

---

## DEC-021 — CSS approach

**Decision:** Match sailbook's CSS approach (specifics confirmed at start of Phase 0 execution).

---

## DEC-022 — Order list filters

**Decision:** Sort by column + filter by week. Highlight `needs_reconciliation` rows in red regardless of sort/filter state.

---

## DEC-023 — Testing philosophy

**Decision:** Two principles for test discipline in bushel:

1. **Test the user, not the function.** Coverage weighted toward integration (Playwright + API + RLS via pgTAP) over unit tests. Unit tests reserved for genuinely stable utilities (date math, validation, parsing). Avoids brittle implementation-coupled tests that break on every refactor.

2. **Test-first when behavior changes.** When a feature's behavior changes, update the test FIRST (it goes red), then change the code (it goes green). If the test is hard to write, the new behavior isn't decided yet — think before coding. Lagging tests (chasing code changes) become a record of what code does, not what we want; they stop catching real regressions.

**Why:** Pre-bushel pattern was whole sessions spent fixing tests that broke from implementation shifts. Both principles attack that root cause directly. The second is the higher-leverage one — it's the discipline that prevents the pattern from re-emerging.

**Operational implications:**
- Local: fast unit + critical-path integration only. Sub-10-second feedback.
- CI (Vercel): full integration, E2E across browser matrix, lint, types, security. `workers: 1` on CI to mute parallel-state flakiness; revisit when CI time becomes painful.
- Browser matrix: Chromium on every PR (fast feedback). Full matrix incl. WebKit on main / release. WebKit included on PR for the customer-side mobile component (DEC-019).

---

## DEC-024 — Project management workflow

**Decision:** Hybrid PROJECT_PLAN.md + GitHub Issues + Project board.

- `docs/PROJECT_PLAN.md` is a **phase-boundary document**: read at planning, written at retro. Untouched mid-phase. Holds phase narratives, scope, velocity table.
- The **current phase's tasks materialize as GitHub Issues** with labels `phase:N` and `points:X`. Closed via PR's `closes #N`.
- A GitHub Project board (Projects v2) gives kanban visibility for multi-dev work.
- Per-session files under `sessions/` (`YYYY-MM-DD-HHMM-<dev>-<slug>.md`) replace the legacy monolithic `session-log.md`.

**Why:** Solo + scaling-to-2-devs (Josh joins for stewardship). Single PROJECT_PLAN.md was a merge bomb at >1 dev. Issues give per-task assignee + comment thread + mobile review. Phase-boundary writes eliminate plan-file contention.

**Rituals:**
- `/start-phase` materializes a phase: reads tasks from PROJECT_PLAN.md, creates Issues, writes `#N` references back into the plan, adds to board.
- `/retro` closes a phase: marks `[x]`, reconciles drift (mid-phase additions), computes phase velocity, writes to RETROSPECTIVES.md.

**Trade-off accepted:** mid-phase scope changes create temporary drift between Issues (truth) and PROJECT_PLAN.md (read-only until retro). Reconciliation at retro restores alignment, with inline annotations preserving the story.

---

## DEC-025 — Dev server access pattern

**Decision:** Dev server runs on `mill-dev:3001`, bound to `0.0.0.0`, reached over Tailscale only. No public exposure (Hetzner firewall blocks 3001). VS Code's auto-port-forwarding to `localhost` is allowed but not the canonical path — laptop, phone, and iPad all hit `http://mill-dev:3001`.

**Why:**
- **Mobile-first.** Customer-side must work at 375px (DEC-019); phone testing has to be a primary path, not an afterthought. Phone can't use VS Code's `localhost` tunnel — only Tailscale-direct works for it. Committing to one path means we don't keep two configurations healthy.
- **OAuth simplicity.** Google OAuth redirect URIs hardcode host:port. One canonical URL = one redirect URI to maintain (`http://mill-dev:3001/auth/callback`).
- **Same URL everywhere.** Avoids "works on laptop, broken on phone" bugs caused by origin-mismatched configs (sailbook hit this — silent hydration failures when `allowedDevOrigins` was incomplete).
- **Port pinned to 3001** because sailbook holds 3000. Both projects can run their dev servers simultaneously on the same box.

**Operational implications:**
- `package.json` dev script: `next dev -p 3001 -H 0.0.0.0`.
- `next.config.ts` `allowedDevOrigins` + `serverActions.allowedOrigins` include `mill-dev`, `mill-dev:3001`, and the tailnet IP `100.118.147.49:3001` (IP fallback for when MagicDNS hiccups).
- README, OAuth redirect URIs, and Playwright `baseURL` (for local-server runs) all reference `http://mill-dev:3001`.
- If the box gets renamed again (it happens — `sailbook-dev` → `mill-dev` was V1), this decision's references become a single grep target.

**Trade-off accepted:** if Tailscale or MagicDNS breaks, dev access is gone until it's restored. The tailnet IP fallback in `allowedDevOrigins` mitigates partially (IP works even when MagicDNS doesn't). VS Code's port forwarding remains as an undocumented backup for laptop-only debugging.

---

## DEC-026 — Customer outbound SMS: operator-sent native deep links

**Decision:** Bushel does not send customer SMS itself. The admin UI generates `sms:+1XXXXXXXXXX?body=<encoded>` URIs and surfaces them as per-customer "Send" buttons. Operator taps a button → her native Messages app opens with the recipient and message body pre-filled → she taps Send. The send-queue UI tracks which customers have been marked sent for the current cycle (weekly update, order confirmation, pickup reminder).

**Why:**
- ~21 messages/week across 7 customers — Twilio's 10DLC compliance overhead (brand registration, campaign vetting, ~10–15 business-day approval, ongoing fees) is disproportionate.
- Operator-sent from a personal handset is P2P, sitting outside the A2P regulatory perimeter (TCR, TCPA, carrier review).
- Operator already does this manually today. The deep-link approach speeds up an existing behavior; it doesn't change who sends or how.
- Customer replies route to the operator's cell directly, matching current behavior.

**Trade-offs accepted:**
- Manual send required per message. ~21 taps/week is fine; not viable at 50+ customers.
- No carrier delivery receipts. Sent-status is "operator marked sent," not "carrier confirmed delivered."
- Operator's personal number is the sender. If the operator ever wants Bushel-branded sender ID, that triggers A2P registration.

**Send queue ordering:** Customers carry a `priority` column; the send queue lists customers in priority order so high-priority customers receive each cycle's message first. No enforced delay between sends — manual pacing diffuses the inventory-page load naturally.

**Trigger to revisit:** ~50 messages/week, or operator wants automated unattended sends. At that point, register a Bushel 10DLC brand under the farm's EIN and migrate to A2P. Deferred to Phase 7+.

**Supersedes:** DEC-020 (customer-outbound SMS path).

---

## DEC-027 — Admin order-arrival alert: email primary, PWA push as upgrade

**Decision:** When a customer submits an order, Bushel sends a transactional email to the operator's address. Email push notifications on her phone deliver the buzz. Provider TBD (Resend or similar) — single recipient, low volume, no marketing.

PWA push notification is a stretch upgrade: if reliable on Android (the operator's platform), wire it as the primary alert path with email as fallback.

**Why:**
- Order alert is application-to-person and automated — DEC-026's operator-in-the-loop pattern does not apply.
- Email is the cheapest reliable path with no carrier or compliance overhead, and admin-only outbound keeps the customer side untouched.
- One outbound recipient, volume measured in dozens per week — well under any free-tier limit.
- PWA push is desirable (immediacy, no email-app dependence) and Android push is solid; worth attempting once the admin shell is a PWA install.

**Trade-offs accepted:**
- Email push latency depends on the operator's mail provider — typically seconds, occasionally a minute.
- Re-introduces a transactional-email dependency the project had previously dropped (DEC-020). Limited in scope to admin-only.

**Stretch upgrade:** PWA push for order alerts. If proven reliable, opens the door to a v2 "next-customer nudge" during send batches (Phase 7+).

**Supersedes (in part):** DEC-020 (the "admin alerts are SMS" portion).

---

## DEC-028 — Customer send opt-in: send_weekly_link boolean (replaces notification_preference)

**Decision:** Replace `customers.notification_preference text CHECK ('sms','email','none')` with `customers.send_weekly_link boolean NOT NULL DEFAULT true`.

**Why:** `notification_preference` was scoped for a multi-channel world (SMS, email, both) that DEC-026 eliminated. With operator-sent SMS deep links as the only customer channel, the meaningful choice collapses to one bit: does this customer receive the weekly order link? A boolean named `send_weekly_link` is unambiguous and requires no enum gymnastics. `false` replaces `'none'`; `true` replaces `'sms'`. The `'email'` and `'both'` values are dropped with no v1 replacement.

**Trade-offs accepted:** If a v2 email channel is added (Phase 7+), a new column will be needed rather than reusing this one. That's the right trade — v2 scope shouldn't constrain the v1 schema.

**Migration:** `20260510050945_replace_notification_preference.sql`. Existing `'none'` rows → `false`; all others → `true`. Safe on an empty table at this stage of development.

---

## Open / Pending Product Owner Discussion

- **Minimum delivery amount (in dollars).** Threshold below which delivery is unavailable, or above which delivery is free. Phase 7+ candidate.
- **No open/close time?** Possibility of dropping the open/close toggle entirely (always open). Major scope reduction (eliminates 3.6 + race specs in 3.7). Needs deeper discussion before committing.
