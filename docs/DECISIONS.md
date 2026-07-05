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

**Amended by DEC-030** — default mode is now always-open, manually closed; scheduled close is opt-in.

---

## DEC-012 — Order placement: optimistic

**Decision:** No strict rejection. Insert order + items in a transaction, decrement product qty (allow negative), set `needs_reconciliation` flag if any line went oversold. Admin sees flagged orders highlighted; reconciles via text.

**Why:** "Vegetables to friends, not heart medicine." May stay this way forever. Strict-rejection moved to Phase 7+ if needed.

---

## DEC-013 — Pickup windows

**Decision:** 4 fixed windows per week, configurable but set-once. Customer chooses one at checkout when picking up.

**Superseded by DEC-029.**

---

## DEC-014 — Reminders

**Decision:** Morning-of pickup reminder to pickup customers only. No delivery reminders (B2B locations are staffed).

**Amended 2026-06-04 (#193):** delivery reminders are now sent too — per-order, operator-initiated from the Orders-page action stack, using a distinct `delivery_reminder` send mode + `deliveryReminderBody` template. Annabel wanted parity with pickup reminders. The original "staffed locations don't need it" rationale held until she asked; sending one is cheap (operator-initiated `sms:` deep link, no automation) and harmless.

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
- `workers: 1` everywhere (revised — see DEC-023 for the rationale; flake-resistance dominated theoretical parallel-speed benefit at this scale), 2 retries, `forbidOnly: true` in CI
- `tests/helpers.ts` for shared auth/fixtures
- `supabase/seed.sql` for pre-seeded test data
- GitHub Actions CI runs both `playwright test` and `supabase test db`

---

## DEC-019 — Viewport scope

**Decision:** Admin desktop-only in v1. Customer order pages responsive across mobile/tablet/desktop, mobile-prioritized (95% of customer traffic via SMS link).

---

## DEC-020 — Notifications channel: SMS-only in v1 [SUPERSEDED]

**Status:** Superseded 2026-05-08 by DEC-026 (customer outbound via operator-sent `sms:` deep links) and DEC-027 (admin order-arrival alert via email, with PWA push as upgrade). Further amended 2026-05-10 by DEC-028 — `notification_preference` column was dropped entirely in favor of `customers.send_weekly_link boolean`.

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

## DEC-027 — Admin order-arrival alert: email primary, PWA push as upgrade [SUPERSEDED]

**Status:** Superseded 2026-05-15 by DEC-033 — admin alert pivoted from transactional email to Telegram bot push. PWA-push-as-upgrade framing is preserved in DEC-033. Original text retained below for context.

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

## DEC-029 — Fulfillment is free-text per order; no structured pickup windows

**Decision:** Drop the `pickup_windows` table and the structured-window picker. The customer order form has two free-text fields, one per fulfillment type:

- **Pickup:** `orders.pickup_note text NULL` — labeled "When are you picking up?", starts empty every week.
- **Delivery:** `orders.delivery_preference text NULL` — labeled "Delivery preference", **prefilled with the value from this customer's most recent prior `delivery` order** (so customers who switch pickup → delivery don't get stale pickup-time prefills).

Address pre-fill is unchanged (snapshot from `customers.delivery_address` per DEC-008). `orders.fulfillment_type` remains.

**Why:**
- At 7 customers, structured pickup-window scaffolding is overhead disproportionate to value. Annabel can read prose ("Wednesday afternoon, ~3 if that works") and plan her day.
- The pickup-window picker was a meaningful chunk of task 3.4 UI; removing it drops 3.4 from 8 pts to 5 pts.
- Delivery preferences are sticky-but-tweakable info ("leave at back door, gate code 4321"). Prefill-from-prior-order lets a customer keep using the same line week after week without forcing Annabel to maintain a customer-level field.

**Trade-offs accepted:**
- Operator loses the sortable "3 customers in the Wed 2–4 window" view that structured pickup windows enabled. Mental aggregation across prose is fine at 7 customers; would re-earn its keep around 25+.
- Free-text is unconstrained — a customer could type "midnight Tuesday" and it would land. Annabel reads and reacts; same as today's SMS workflow.

**Trigger to revisit:** customer count crosses ~25, or operator asks for grouped pickup-day planning. Migration back to structured windows is straightforward (text fields stay as a fallback "other").

**Supersedes:** DEC-013.

---

## DEC-030 — Default mode: always open, manually closed; scheduled close opt-in

**Decision:** Amends DEC-011. `ordering_schedule.is_open` default flips `false` → `true`. The default seeded row has `is_open = true` and all schedule columns (`weekly_open_day`, `weekly_open_time`, `weekly_close_day`, `weekly_close_time`, `override_closes_at`) NULL. The Phase 3.6 cron treats NULL schedule columns as "no schedule configured" and leaves `is_open` alone; it only acts when schedule columns are populated.

**Why:**
- The practical traffic gate for customer orders is the weekly SMS link, not the open/closed toggle. Customers don't browse `/c/[token]` on their own — they tap the link from Annabel's text. "Always open" doesn't mean 24/7 traffic; it means "when a customer does tap their link, the form works."
- The closed state is reserved for explicit refuse-new-orders moments (vacation, bad week, broken equipment, end-of-season wind-down). Those are rare and deliberate — making them manual matches their nature.
- The cron infrastructure from DEC-011 / Phase 3.6 still ships, just as opt-in. Annabel can configure a weekly auto-close later if she finds she wants one.

**Trade-offs accepted:**
- Customers can theoretically order at any hour if Annabel never closes the store. Acceptable per DEC-012 — vegetables to friends, not heart medicine.
- Forgotten "close before vacation" is on Annabel. Mitigated by the SMS-as-traffic-gate insight: no new weekly link = effectively no new orders.

**Supersedes/amends:** DEC-011 (the "single open/close toggle + configurable weekly schedule" part stands; the implicit "closed-by-default" assumption is inverted).

**Resolves:** PROJECT_PLAN.md open question "No open/close time? — drop entirely?" Answer: no, keep, but invert default.

---

## DEC-031 — Sold-out display: per-item disabled at qty=0; page-level empty state when all visible items are sold out

**Decision:** The customer inventory page renders four distinct states, depending on the combination of `ordering_schedule.is_open` and `products.qty_available`:

| Store toggle | Inventory | Customer sees |
|---|---|---|
| Closed (manual) | any | "Orders are closed this week" message; no form |
| Open | all visible items qty > 0 | Normal order form |
| Open | some items qty = 0 (or qty < smallest active unit's `conversion_to_base` once DEC-032 lands) | Form renders; those rows greyed out with "Sold out" in place of the qty stepper |
| Open | no visible item is orderable | "Everything sold out — check back next week" empty state; no form |

**Why:**
- Disabled-not-hidden gives customers visibility into what *was* on offer this week, which informs their ordering rhythm ("kale moves fast — I'll order Monday next time").
- If Annabel restocks mid-week, the same row re-enables — no row-add/row-remove churn.
- `is_available = false` rows stay filtered out entirely. "Not on the menu this week" is a separate concept from "ran out." Both the per-item disable and the all-sold-out empty state ignore `is_available = false` rows.

**Interaction with DEC-012 (optimistic placement):** The disable is a soft UI hint, not enforcement. A customer who loaded the page when qty=1 and submits after someone else bought the last one still has their order accepted; `needs_reconciliation` fires and Annabel texts to resolve. This is intentional and unchanged. Realtime inventory subscription (Phase 3.8, dark-flagged) would tighten this further if shipped.

---

## DEC-032 — Multi-unit products in V1.5 (per-unit pricing; inventory in base units)

**Decision:** Multi-unit products are not in V1. V1 ships with one unit per product. **V1.5** is a focused follow-up phase (Phase 6.5 in PROJECT_PLAN.md) that adds multi-unit support. Reverses neither DEC-007 (per-customer pricing stays deferred to V2) nor any other prior decision.

**Model when V1.5 ships:**

- Each product has a `base_unit` (e.g. "lb") and `qty_available numeric(10,2)` tracked in base units.
- New table `product_units (id, product_id, unit text, conversion_to_base numeric(10,4), price_cents integer, sort_order integer, is_active boolean)`. Each product has at least one row (the base unit, conversion=1.0). Cherry tomatoes might have three: lb (1.0), pint (0.83), flat (10.0).
- `order_items` gains `product_unit_id` FK. `unit_price_cents` continues to snapshot, now from the chosen unit's price.
- Decrement at order time: `products.qty_available -= order_items.qty * product_units.conversion_to_base`. No rounding — fractional decrements are honest and `numeric(10,2)` handles them cleanly.
- Per-unit pricing is **independent**, not auto-computed from the conversion factor. Annabel sets pint=$5.00, lb=$4.50, flat=$40.00 directly. Conversion factors govern inventory math only.
- Per-unit sold-out check: a unit's radio is greyed out when `qty_available < conversion_to_base`. Whole-product sold-out when no active unit is orderable.
- Customer-side UI: radio-button picker when a product has 2+ active units, no picker when only 1. Switching the radio resets qty to 0 (carrying "6 pints" across to "6 flats" is a recipe for accidental $240 orders).

**Explicit non-coupling to DEC-007:** Per-unit pricing is *not* per-customer pricing. All customers see the same pint price, the same lb price, the same flat price.

**Why V1.5 and not V1:**
- V1 ships sooner. Real customer usage informs whether multi-unit needs to land in week 2 or month 2 after launch.
- Multi-unit roughly doubles Phase 2 scope and adds meaningful surface to Phase 3 (admin inventory editor, customer form, sold-out logic, pre-fill behavior). Slotting it as its own phase keeps the V1 plan coherent.

**Why not V2:**
- Selling the same physical product in different denominations is core wholesale produce behavior, not a "nice to have." Deferring to V2 means an indeterminate slip; V1.5 is a committed follow-up with a sized scope.

**Known V1 kludge:** for products that genuinely need multiple units in V1 (Annabel will identify these), create them as separate products: "Cherry tomatoes (lb)" and "Cherry tomatoes (pint)" with separately-managed `qty_available`. Annabel reconciles harvest-to-inventory split mentally. Tolerable for ~3 products for ~weeks. If the count is higher, this DEC's V1/V1.5 split should be revisited and multi-unit pulled forward into V1.

**Trigger to validate now:** Annabel-facing question — *"How many of the products you sell need to be sold in different units to different customers?"* If answer is 2–3, V1.5 framing holds. If "most of them," pull forward into V1.

---

## DEC-033 — Admin order-arrival alert: Telegram bot (supersedes DEC-027 email-first)

**Decision:** When a customer submits an order, Bushel POSTs a plain-text message to Annabel's Telegram via the Telegram Bot API. Single recipient (her personal chat_id with the dedicated bot). Server-side `fetch` to `https://api.telegram.org/bot<TOKEN>/sendMessage`. Best-effort: any failure is logged and swallowed so order placement never blocks on a notification miss.

PWA push notification remains the stretch upgrade per DEC-027's framing.

**Why (preferred over DEC-027's email path):**
- Lower perceived latency. Telegram push lands on the lock screen in 1–3 seconds; email push is typically seconds but sometimes a minute, and the alert hides inside the inbox.
- No DNS or sender-domain verification. Resend would have required CNAME records on a domain we control + a verified from-address; Telegram requires a one-time `/newbot` exchange in the app.
- No SDK dep. One `fetch` POST to a single REST endpoint vs. pulling in the Resend SDK.
- No transactional-email service to onboard or pay. Telegram bot API is free with no published volume cap relevant to our scale.
- Operator already has the Telegram app open on her Android device for other purposes.

**Trade-offs accepted:**
- Operator dependency: if Annabel ever drops Telegram, the alert path breaks. (Mitigation: alert wrapper logs every miss; she'd notice within hours that confirmations stopped arriving and we'd switch providers.)
- Bot token is a long-lived secret; rotation requires `/newbot` again or BotFather's `/revoke`. Same rotation discipline as any other API key.
- No delivery receipts. We get a 200 from the Telegram API and trust it landed. Same as email.

**Pre-launch one-time setup (Annabel + dev, ~5 min):**
1. Annabel opens Telegram → messages `@BotFather` → `/newbot` → picks a name + username → BotFather returns a bot token.
2. Annabel sends any message to the new bot (Telegram won't deliver until she initiates).
3. Dev: `curl "https://api.telegram.org/bot<TOKEN>/getUpdates"` → reads `result[0].message.chat.id`.
4. Vercel Production env vars: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_CHAT_ID`. Optionally `NOTIFICATIONS_ENABLED=false` in any env where alerts should be silenced (test, staging if added).

**Failure mode:** if either env var is unset, `sendAdminOrderAlert` no-ops and logs `[admin-alert] skipped (not configured)`. Order placement proceeds normally. The log line in production is the canary for misconfiguration.

**Stretch upgrade still on the table:** PWA push. If reliable on Annabel's Android once the admin shell is installed, push can run primary with Telegram as fallback — same pattern DEC-027 sketched for email.

**Supersedes:** DEC-027 (the "email primary" portion). DEC-027's PWA-push-as-upgrade framing is preserved.

---

## DEC-034 — Admin is mobile-responsive (amends DEC-019)

*Reserved.* Referenced across `PROJECT_PLAN.md`, `RETROSPECTIVES.md`, `app.css`, and `playwright.config.ts` (Phase 6.4–6.7): `/admin/*` is mobile-responsive because operator-sent `sms:` deep links only resolve on a phone — Annabel runs ops from her phone. The full write-up is still pending a retro pass; the number is held here so the log stays contiguous and DEC-035 doesn't collide.

---

## DEC-035 — "Confirmed" order status (amends DEC-010)

**Decision:** "Confirmed" is a real order status between New and Ready. The flow is **new → [confirmed] → ready → (picked-up | delivered)**, where `confirmed` is **optional**:
- `new → confirmed` — set when Annabel sends the order-confirmation text (auto-advance), or manually.
- `new → ready` — kept. Annabel may pack an order before texting, so confirmed can be skipped.
- `confirmed → ready`, then `ready → picked-up | delivered` (fulfillment-pinned terminal).

**No-regress guard:** sending the confirmation text auto-advances a `new` order to `confirmed`, but must **never** regress a `ready`/terminal order. The rule is the pure helper `statusAfterConfirmSend(s) = s === "new" ? "confirmed" : s` (`src/lib/admin/orders-queries.ts`), wired to the confirm-send button in the Orders-page action stack (#192).

**Why:**
- The order-status redesign (design PR #187) needs a confirmation state distinct from "packed and ready." Confirmed = "we've acknowledged the order to the customer"; ready = "it's physically packed."
- Optional, not mandatory, because the farm's real workflow sometimes packs first. Forcing confirm-before-ready would fight how Annabel works.

**Implementation:**
- `codes` gains `('order_status','confirmed','Confirmed',2)`; `ready`/`picked_up`/`delivered` renumber to 3/4/5 (migration `20260604200000_order_status_confirmed.sql`).
- `orders.status` stays app-enforced text (no FK/constraint) per DEC-010. The transition table lives in TS (`isValidTransition`, `orders-queries.ts`), not the DB.

**Foundation for:** the Orders redesign — #191 (shared SendAction), #192 (per-order action stack), #193 (delivery reminder) build on this status.

---

## DEC-036 — Optimistic oversell (DEC-012) does not extend to qty=0 (#132)

**Decision:** `place_order` rejects any line item whose product has `qty_available = 0` at submit time. DEC-012's optimistic placement — let the "last few" oversell and flag `needs_reconciliation` — applies **only while `qty_available > 0`**. Zero means truly unavailable (DEC-031), so an order against it is refused, not driven negative.

**Why:**
- UAT (#132) surfaced an order for qty=4 against `qty_available = 0`. The customer form already greys sold-out rows and pins the stepper to 0 (DEC-031), so this was only reachable via the stale-tab race: page loaded with stock → inventory hit 0 (admin edit or another order) → customer submitted the stale cart. DEC-012's unconditional decrement then drove the product to −4 and flagged reconciliation — a "successful" oversell of something with nothing left.
- DEC-031 says qty=0 is uneditable "period." Honoring that only in the client (load-time) but not the server (submit-time) left the race open. DEC-036 closes it server-side.

**Implementation:**
- The decrement becomes `UPDATE products SET qty_available = qty_available - n WHERE id = ? AND qty_available > 0` plus `IF NOT FOUND THEN RAISE … sold out` (migration `20260611213000_place_order_reject_soldout.sql`). The `qty_available > 0` guard is part of the write, so the check is race-free; a raise mid-loop rolls back the whole order (atomic — no partial order, no orphaned decrement).
- `place-order.ts` maps the raise to a friendly "Some items sold out — reload" message; reloading re-fetches inventory and greys the rows.
- Unchanged: `qty_available > 0` but insufficient still oversells into the negative and flags `needs_reconciliation` — the intended DEC-012 "last few" behavior.

---

## DEC-037 — `product_units` strictly authoritative; mirror columns dropped (#212, closes the DEC-032 transition)

`products.unit` and `products.price_cents` are dropped, along with the bidirectional mirror triggers (20260526) and the `products_spawn_default_unit` safety net (20260522). The base unit's label/price live only in `product_units` (base = `conversion_to_base = 1.0`). `saveInventory` owns the base-unit row lifecycle: inserts it on product creation (slug `<name-slug>-<id8>`), updates label/price on inline edit, and surfaces `unique (product_id, label)` collisions as row errors instead of the old trigger's silent skip. The inline inventory editor's unit/price fields are unchanged UX — only their write target moved. Base-unit re-designation (changing which unit is base) remains #208 and out of scope here.

---

## DEC-038 — Base-unit change is an atomic, invariant-preserving rebase (#208)

**Decision:** changing which `product_units` row is a product's base unit is a single server-side operation (`set_base_unit` RPC, migration `20260612153000`) that divides EVERY unit's `conversion_to_base` AND `products.qty_available` by the new base's old conversion, then renumbers `sort_order` so the new base sorts first. Making a unit the base also makes it the customer's default-selected unit — one deliberate action, both effects. Unit prices are untouched.

**Why:**
- `qty_available` is stored in base units and `order_items` read conversion live from `product_units` (no per-line conversion snapshot), so a line's footprint is `qty * live_conv`. Rescaling all conversions and the stock figure by the same factor leaves every historical comparison physically unchanged — oversold state and `needs_reconciliation` can't flip. Doing it as anything other than one transaction (e.g. folding it into the drawer's staged Save) would open a window where conversions and stock disagree.
- Prices are per-unit truths ("$6 per lb" holds regardless of what stock is counted in), so they don't participate in the rescale.
- The customer form defaults to `units[0]` (sorted by `sort_order nulls last, created_at`); renumbering with the new base at 0 is how "make base" doubles as "make default" without a new column.

**Guard rails:** the drawer's "Make base" affordance only appears on saved, active, non-base rows; it's disabled while the drawer has unsaved edits (the post-rebase reload would clobber them); and it confirms via modal before calling the RPC. The RPC raises on cross-product, missing, or inactive units and no-ops when the unit is already base.

---

## DEC-039 — Additive orders: append to the week's single order (#211)

**Decision:** A customer can submit additional items while ordering is open. Additions append `order_items` to the existing `(customer, week)` order — the `unique (customer_id, week_of)` constraint stays. Appends inherit the order's fulfillment unchanged (the add-mode form shows it read-only; change = text Annabel, DEC-015). An append resets a `confirmed`/`ready` order to `new` (re-enters Annabel's pipeline; the existing Re-send affordance covers the now-stale confirmation SMS) and is refused when terminal (`picked-up`/`delivered` — the box is gone).

**Idempotency:** `place_order`'s on-conflict no-op is replaced by a client-generated `order_items.submission_id` — replaying an already-applied submission returns the existing order with no second decrement. It doubles as a per-submission audit trail (which submit attempt created each line). The RPC now returns `table(order_id, appended)` so the action can pick "new order" vs "added N items" alert copy.

**Rejected:** multiple order rows per customer-week — breaks `customer_sends` keying (`(customer_id, week_of, mode)` PK), `getCurrentWeekOrder`'s `maybeSingle()`, the 1:1 admin sends join, and doubles Annabel's per-customer fulfillment steps.
---

## DEC-040 — Store is always-open; scheduled-close cron disabled (amends DEC-030)

**Decision:** `ordering_schedule.is_open` is operated **only** by the manual `toggleOrdering` button. The scheduled-close cron is **disabled** — the `crons` entry is removed from `vercel.json` so `/api/cron/check-schedule` never fires. The machinery (`save-schedule.ts`, the cron route, `SettingsScheduleCard`, and the `weekly_*` / `override_closes_at` columns) is **left in place, dormant** — removable anytime.

**Why:** The farm wants continuous open, closed only by deliberate action. The cron is the *only* schedule-driven writer of `is_open` (the order page treats `is_open` as a soft UI hint; `toggle-ordering.ts` is the only other writer), so disabling it makes open/closed a manual-only decision and neutralizes the cron's UTC `getDay()`/`getHours()` timezone-edge bugs — without ripping out code.

**Revised from the planning memo:** the original DEC-040 proposed *deleting* the machinery + dropping 5 schedule columns. Softened to disable-the-cron — it's built and harmless, removal can happen later. Saves a migration.

**Accepted limitation:** `SettingsScheduleCard` stays settable but inert (no cron acts on a set schedule). Harmless; hiding it is deferred to whenever the machinery is fully removed.

**Supersedes (DEC-030):** "scheduled close opt-in" — there is no scheduled close now, only the manual toggle.

---

## DEC-041 — Order identity is the open order, not the week

**Decision:** Replace `orders`' `UNIQUE (customer_id, week_of)` with a **partial unique index**:

```sql
CREATE UNIQUE INDEX orders_one_open_per_customer
  ON public.orders (customer_id)
  WHERE status IN ('new', 'confirmed', 'ready');
```

A customer has at most one **non-terminal** order; fulfilled orders (`picked_up`/`delivered`) drop out, freeing a new one. `week_of` is **demoted to an informational stamp** — still set at insert, still feeds the fulfillment sheet + Wave export, no longer identity. `place_order`'s find-existing clause (from #218/DEC-039) re-keys week → open-status; the `submission_id` replay guard is untouched.

**Why:** "Always open + edit until fulfilled + new one after" is exactly "one row per (customer, non-terminal-status)." Postgres expresses it natively; no `week_of` arithmetic in the hot path. Demoting rather than dropping `week_of` keeps the weekly reports working.

**The RPC re-key is NOT a one-clause change.** `week_of` is load-bearing in four spots in #218's `place_order`: the `ON CONFLICT` arbiter (must infer the partial index — the concurrency linchpin), the `FOR UPDATE` existing-order lock, the outside-lock replay join, and the in-lock re-check (order-keyed, fine). Three are concurrency-critical; sized 5pt accordingly (architect pass, 2026-06-22).

**Cutover (hard cutover):** at go-live, wipe `orders` / `order_items` / `customer_sends`; keep `products` / `product_units` / `customers`. No history, no backfill. The old `UNIQUE (customer_id, week_of)` is dropped **in** the cutover, **not deferred** — it cannot coexist with the partial index through live traffic (it forbids the very second-same-week order the index allows). A brief quiet-minute outage is accepted.

---

## DEC-042 — Open-order edits: additive, terminal-only lock; send-state stays weekly

**Decision:** Adopt #218's append semantics unchanged. A customer may append items to a non-terminal order (`new`/`confirmed`/`ready`); appending a `confirmed`/`ready` order resets it to `new` and re-enters the send pipeline (existing Re-send covers the stale SMS); appending a terminal order is refused server-side. Editing is **add/increase only** — no removal or decrease ("remove an item" = text Annabel, DEC-015).

**Why:** Add-only keeps the `qty_available` decrement monotonic; allowing removal means re-incrementing, which races other carts and reopens the DEC-012 oversell window from the wrong side. The earlier "lock at `ready`" idea is dropped for #218's already-UAT'd through-`ready` behavior — a stray late append is a text-Annabel fix.

**Send-state stays week-keyed (decided against re-keying).** `customer_sends` keeps PK `(customer_id, week_of, mode)`. Considered re-keying to `(order_id, mode)` to handle a same-week re-order after fulfillment, but **rejected**: the weekly blast (`weekly_update`) is sent *before* any order exists, so order-keying it is wrong, and a habitual always-has-an-open-order customer would be mishandled. The weekly reset is the correct operator model — Annabel sends once a week. **Accepted limitation:** in the rare case a customer is fulfilled mid-week and re-orders before the Sunday reset, their second order inherits the first's send-state (no re-send nudge) — the same text-Annabel escape hatch.

---

## DEC-043 — Per-unit editable SKU; `description` leaves the Wave export

**Decision:** Add editable `sku text` (nullable) to **`product_units`**, exposed in the units drawer labeled **"SKU."** Repoint the Wave export: Item Number ← the line's `product_units.sku`, falling back to `product_units.slug`, then blank. Remove `products.description` from the export entirely — it reverts to its sole purpose, the customer-facing long description.

**Why:** `description` is conflicted — the inventory editor presents it as the customer-facing long description while `export-orders.ts` emits it as Wave's Item Number, so a customer note silently becomes an invoice item number. Under multi-unit, SKU is a **per-unit** truth (one product → multiple Wave line items). Editable (not the auto `slug`) lets Annabel match Bushel's SKUs to her existing Wave item catalog.

**Migration:** add `product_units.sku`; backfill NULL (Annabel fills as needed); `slug` stays as fallback.

---

## DEC-044 — Canonicalize `order_status` to snake_case (`picked_up`) — BUG

**Decision:** `picked_up` (underscore) is canonical everywhere. Migrate the TS layer — `ORDER_STATUSES`, transition guards, `narrowStatus`, `order-actions.tsx`, `order-row.tsx`, `report.ts` — from the hyphen form to underscore. No data backfill: `orders` is wiped at cutover.

**Why / symptom:** DB `codes` stores `picked_up`; the TS layer uses `picked-up`. `narrowStatus(s)` returns `"new"` for any DB value not in the hyphen-keyed `ORDER_STATUSES`, so a `picked_up` row reads back as **new** — fulfilled orders resurface as new in the admin list, and `report.ts`'s `o.status !== "picked-up"` exclusion misses them, so fulfilled orders keep printing on the harvest sheet. Underscore matches the DB convention (`needs_reconciliation`, `is_active`).

---

## DEC-045 — Admin orders list keyed to the open-order model (follows DEC-041)

**Decision:** `/admin/orders` drops its current-week filter (`listOrders`' `.eq("week_of", weekOf)`) and defaults to **active (non-terminal)** orders, with a way to browse fulfilled/past orders. The stale `customer_sends` sends-join comment + logic ("one order per customer per week → `customer_id` maps 1:1 to an order") is corrected — the join stays week-keyed per DEC-042; only the broken 1:1 assumption is fixed.

**Why:** Under DEC-041 orders are no longer week-aligned, so a week-filtered list silently drops orders that stay open across a week boundary. Fulfilled orders persist as rows (the open-order model only removes them from the partial index + the editable view), so "view past orders" is a read/UI feature — and this is its natural home.

**Scope:** admin-only. Customer-facing history (#136, `/c/[token]/history`) stays in the backlog.

---

---

## DEC-046 — Off Supabase to Neon; `pg` + hand-rolled SQL migration runner

**Decision:** Bushel moves Postgres from Supabase Cloud to Neon (free tier). Data access is `pg` (node-postgres) `Pool` via `DATABASE_URL` — no ORM, no query builder. Migrations are plain SQL files `db/migrations/NNNN_name.sql` applied by a ~70-line runner ported from muster (`db/migrate.ts`: `_migrations` tracking table, each file in its own transaction). Local + CI test against docker Postgres; Neon hosts dev/preview + prod only.

**Why:** Consolidates billing off Supabase; aligns bushel with muster (same stack, one maintenance surface for a solo dev); muster already runs this on Neon, so it's a proven path, not a spike. `pg` + plain SQL clears the dependency bar where Drizzle/Prisma do not — the queries are hand-written already and "migrations are source of truth" stays literally true.

**Rejected:** Drizzle/Prisma (new paradigm + tooling for no gain at this scale); drizzle-kit (the SQL runner is portable and understood); replaying the 27 Supabase migrations (a third are RLS/mirror churn that gets deleted — author a clean `0001_init.sql` baseline instead, validated by the surviving pgTAP function tests). Also consciously rejected: staying on Supabase with just code-auth + one project — satisfies OAuth/billing goals without a DB move, but leaves bushel and muster on divergent stacks forever; the muster-alignment dividend is the tie-breaker.

**Migration:** fresh baseline schema on Neon; `place_order` plpgsql + `order_items` trigger port unchanged (pure Postgres). Data crosses via targeted `pg_dump -t products -t product_units -t customers` (orders/order_items/customer_sends are wiped by DEC-041's cutover, so they don't move).

**Sequencing:** the Neon data move happens in the SAME quiet-minute as the pending DEC-041 production cutover — one outage on the live tool, not two.

---

## DEC-047 — Admin auth: email → login code + self-rolled HMAC session via Resend (drops Google OAuth / Supabase Auth)

**Decision:** Admin login is muster's full flow, ported verbatim: admin enters their email, a short-lived one-time code lands in their inbox via **Resend**, and verifying it mints a stateless HMAC-SHA256 session token stored in an httpOnly cookie. The port covers muster's `src/auth/session.ts` (pure node:crypto, zero dependencies) plus its `login_codes` table (TTL + attempt cap) and code-email sending. Admin identities live in a 3-row `admins` table (Emma, Eric, Annabel) — only listed emails can request a code. Google OAuth and `@supabase/ssr` are removed. The session token is **dual-consumable** — cookie for the browser, bearer header for the Phase 11 native client — so Phase 11 needs no re-auth work.

**Why:** The first draft of this DEC used a shared access code in an env var, reasoning that DEC-033's "no mail provider" stance made muster's email machinery not worth it. Rejected as hacky: a shared static secret has no per-user attribution, rotates only via redeploy, and saves very little — the Resend wire-up is trivial and the rest of the flow ports from muster unchanged. Per-user attribution now comes free. Removing OAuth still unblocks headless admin Playwright auth (long a sore point — Phase 1's authenticated admin tests were deferred to #27 over exactly this): global-setup mints the session directly (the same HMAC secret the app verifies with), and the login-flow specs drive the real request→verify path by overwriting the stored code's hash with a known value — only `sha256(code)` is ever stored, so no plaintext is read from the DB. Either way, no inbox in the loop. (The 10.6 headless helper uses the same overwrite-hash trick.)

**Resend scope:** auth-only. It amends DEC-033's rationale (a mail provider now exists) but not its outcome — alerting does not move to email. Telegram remains today's alert channel only until DEC-050's push replaces it; Eric wants off Telegram, and push is that path, not email.

**Sending account (10.3):** the code-email sends through the existing **brewcle** Resend account rather than a bushel-owned domain — chosen for expedience at 2–3 admins / a handful of auth emails a month, not worth standing up and DKIM-verifying a bushel domain. `RESEND_FROM` must be on the **exact verified domain** — that's the root `brewcle.com`, e.g. `Bay Branch Farm <bushel-auth@brewcle.com>` (a bushel-identifiable local-part keeps sends greppable in brewcle's logs). **NB:** Resend verifies an exact domain, so the `crew-tips.brewcle.com` subdomain is NOT covered by the root verification and 403s ("domain is not verified") — use `@brewcle.com`. `RESEND_API_KEY` is that account's key. **Accepted tradeoffs:** (a) bushel admin login depends on the brewcle account/domain staying live — reversible by repointing two env vars, no code; (b) these sends meter on brewcle's Resend usage, crossing the otherwise-separate per-project billing line.

**Supersedes:** DEC-003 (single admin via Google OAuth / Supabase Auth). **Unaffected:** DEC-004 customer token auth — customers never used Supabase Auth; the `bbf_customer_token` cookie → `customers.token` path is untouched.

---

## DEC-048 — RLS deleted; the service layer IS the access boundary (formalizes existing reality; untangles auth.users)

**Decision:** All RLS policies are dropped, not translated. The auth boundary is already the service layer — customer reads resolve `bbf_customer_token` → `customers.token` then query with full DB privilege (documented in `src/lib/customer/queries.ts`); admin reads sit behind the DEC-047 session. RLS was belt-and-suspenders, tested by pgTAP, never the app's access path.

**Schema untangle** (Supabase-auth tendrils that can't exist on Neon): drop `public.users` + its `auth.users` mirror trigger; `send_queue.sent_by_user_id` (FK → auth.users) drops the FK and either repoints to the DEC-047 `admins` table or is removed; all `auth.uid()` policies removed with RLS.

**pgTAP disposition:** the RLS-only files (`customers_rls`, `fulfillment_link_rls`, `rls_tables`) are deleted; the FUNCTION/DATA tests (`place_order_additive`, `place_order_units`, `product_units`, `set_base_unit`, `order_status_codes`, `customer_sends_modes`) stay and keep running against docker Postgres — they're the regression net for the concurrency-sensitive `place_order` path. **Superseded by DEC-051:** those 6 are ported to vitest pg-integration tests (not pgTAP-on-docker), pgTAP is retired, and `supabase/tests/` is deleted.

**Why now:** with the DB moving anyway, keeping RLS would mean re-authoring every policy against a role model Neon doesn't share, to protect a path the app never uses. Deleting is both simpler and honest about how access actually works.

---

## DEC-049 — Environment model: Neon branches replace the two-project split; prod-write protection via connection-string discipline

**Decision:** One Neon project, two branches — `main` (dev/preview) and `production`. Vercel Production → Neon `production` branch URL; Vercel Preview/Development + `.env.local` → Neon `main` branch URL. CI/local tests run docker Postgres (unchanged). No per-PR ephemeral-branch automation.

**Production-write protection** (replaces DEC-S009's Supabase relink dance): production `DATABASE_URL` lives ONLY in Vercel and a separate, deliberately-sourced `.envrc.production` — never the shell default. `db/migrate.ts` takes the connection string as an arg, so a prod migration is an explicit `tsx db/migrate.ts "$PROD_DATABASE_URL"`, not a lingering link state. Strictly safer than the "link to prod for a few seconds, always relink back" ritual — there is no default-prod state to forget out of.

**Supersedes:** DEC-S009 mechanics (the two-Supabase-project split + link discipline) and the Supabase↔Vercel env-sync section — replaced by two Neon branch URLs and the same "both Vercel scopes must stay coherent" diff-check.

---

## DEC-050 — Expo native app: muster rehearsal, push-first, thin scope

**Decision:** A separate-repo Expo (React Native) app, `bushel-mobile`, whose v1 scope is exactly: (a) receive Expo push notifications, (b) a read-only active-orders list, (c) one mutation — mark-fulfilled. It authenticates to bushel's Next.js `/api/*` routes with the DEC-047 HMAC session as a bearer token — never direct DB access from the phone. Not an admin port.

**Why:** bushel is the rehearsal for muster, where native + background-sync are real requirements — and long-term, in-app push is the path off SMS/carrier costs for users who don't want texts. Bushel's only alert channel today is Telegram (DEC-033; the PWA push idea #170 was closed *parked*, never built), so the app also replaces that hack for Annabel — but the scope stays thin because the rehearsal is the point.

**Net-new API surface:** bushel mutations are Server Actions (uncallable from native), so Phase 11 builds the first real `/api/*` routes — list orders, mark-fulfilled, register push token, order-arrival push fan-out. The DEC-047 session is bearer-consumable specifically to serve these.

**iOS scope reset:** remote push to iOS requires an APNs key, which requires paid Apple Developer Program membership ($99/yr, deferred). Free 7-day personal-team signing installs and runs on Emma's iPhone but does NOT grant remote push. So **v1 push is ANDROID-ONLY (Annabel)**; iPhone push is explicitly gated behind the $99 enrollment. Android proves the Expo push loop for the muster rehearsal.

**Repo shape:** separate repo, not in-repo `apps/mobile` — a monorepo root collides with the seeds-template sync (root-file-oriented, single-app-root assumption). This sets no precedent for muster's repo layout — muster makes its own monorepo-vs-separate call when it builds its app.

**Web↔app parity:** the two surfaces need to stay close, not 1:1. Two mechanisms: (1) admin mutations are implemented as service-layer functions first, with the Server Action (web) and `/api/*` route (app) as thin wrappers over the same function — parity is then a wrapper, not a reimplementation; (2) each phase retro includes a parity pass — which admin capabilities added that phase should the app pick up, and which diverge deliberately. Divergence is fine when named; drift is not.

**Build/signing:** Android via EAS free tier → sideloaded APK ($0). iOS via free-signed 7-day EAS builds for install/run only (no push) until $99 lands. No Mac in the loop for Android.

---

## DEC-051 — Test stack: vitest (unit + pg-integration) + Playwright (E2E-only); pgTAP retired with Supabase

**Decision:** Two layers. **vitest** owns unit tests (pure logic — HMAC session, login-code, conversion math) and **DB-integration** tests (the plpgsql functions + constraints + triggers, driven through the app's own `src/lib/db` pool against docker Postgres). **Playwright** owns end-to-end user flows only. pgTAP is retired.

**Why:** pgTAP was only ever viable because Supabase ships the extension and `supabase test db` ran it in one command. Off Supabase (DEC-046/047), keeping it means baking a test-only extension into the Postgres image and running a Perl TAP harness — infrastructure that exists solely to preserve a Supabase-era format. The concurrency-critical logic (atomic `place_order`) correctly stays in plpgsql; only the *harness* was Supabase-shaped. Testing those functions through the pg driver from TypeScript is the canonical "integration test against a real DB" pattern — same runtime + assertions as the rest of the code, no extension, no pg_prove — and it's where muster landed too. It also finally gives bushel a unit layer (10.3's HMAC/login-code logic had none).

**Shape:** vitest owns `*.test.ts` under `src/` (pure) and `db/tests/` (pg-integration; skips cleanly when no DB is reachable, so `npm run test:unit` stays docker-free for the pure units). Playwright keeps `tests/*.spec.ts`. Different suffix + dir → zero overlap. Integration files run non-parallel (`fileParallelism: false`) since they share one DB and truncate between tests. CI runs `npm run test:unit` where `supabase test db` used to be.

**Amends DEC-048:** its "keep the 6 function/data pgTAP files green on docker Postgres" becomes "port the 6 to vitest pg-integration tests"; the 3 RLS-only pgTAP files are deleted (RLS is gone). `supabase/tests/` is removed entirely.

---

## Open / Pending Product Owner Discussion

- **Minimum delivery amount (in dollars).** Threshold below which delivery is unavailable, or above which delivery is free. Phase 7+ candidate.
- **Multi-unit product count (DEC-032).** Confirm with Annabel how many V1 products need multi-unit. If small (~3), V1.5 framing holds; if large, pull DEC-032 forward into V1.
