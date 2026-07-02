# bushel — Project Plan

Bay Branch Farm Inventory & Order System. Replaces tend.com for ~7 B2B
customers (2 farm stands, 1 grocery store, 3–4 restaurants) on a weekly
Sun/Mon → Wed/Thu cadence.

See also:
- `docs/review/spec-for-annabel.html` — high-level review doc for the product owner (post-pivot)
- `docs/SPEC.md` — product spec (first-pass port from HTML; pending review)
- `docs/DECISIONS.md` — architectural decisions (DEC-001…DEC-032)
- `docs/SCHEMA.md` — finalized table shapes
- `docs/USER_STORIES.md` — flows by role, B2B-reframed (first pass; pending review)
- `docs/BRAND.md` — voice, type, color

---

## Velocity Assumptions

Derived from sailbook (the user's reference Next.js + Supabase project):

- **Best feature-work pace:** **0.15 hrs/pt** (Session 89)
- **Typical feature pace:** **0.15–0.20 hrs/pt** (Sessions 89, 93, 94)
- **Conservative planning band:** **0.35 hrs/pt** (Phase 1 baseline + buffer)

| Sessions | Points completed | Hours | Hours/point |
|---|---|---|---|
| 5 (Phase 0) | 17 (issues) + 3 (0.1 pre-issue) = 20 | 11.28 | 0.66 |
| 3 (Phase 1) | 16 | 18.0 | 1.13 |
| 3 (Phase 2) | 10 (labeled) + #27 admin-shell carry-over | 17.87 | 1.79 |
| 9 (Phase 3) | 56 (29 plan + 7 polish + 20 non-labeled) | 49.25 wall / 19.42 active / 8.67 dev | 0.88 wall / 0.35 active / 0.15 dev |
| 1 (Phase 4) | 11 (labeled, 100% delivery) | 13.7 wall / 3.0 active / 0.3 dev¹ | 1.24 wall / 0.27 active / 0.024 dev¹ |
| 1 (Phase 5) | 11 (8 labeled + 3 unplanned bug fix #102/PR #103) | 9.17 wall / 3.84 active / 0.65 dev¹ | 0.83 wall / 0.35 active / 0.06 dev¹ |
| 2 (Phase 6) | 20 (10 phase-6 PRs + bonus scope; 12 of 32 planned affirmatively cut) | 17.92 wall / 4.92 active / 0.67 dev¹ | 0.90 wall / **0.25 active** / 0.035 dev¹ |
| 7 (Phase 7) | 45 (catch-all; 7 parking-lot issues closed-not-built, 4 moved to Phase 8) | 126.75 wall / 36.17 active / 12.83 dev¹ | 2.82 wall / **0.80 active** / 0.29 dev¹ |

Fibonacci scale: 2, 3, 5, 8. No 1s. Avoid 13s (break down).

¹ Phase 4 + Phase 5 dev_time/dev-velocity numbers are artifacts of DEC-013's single-PR formula. Multiple PRs in one session attribute most coding to "review_time"; the honest forecast number is the active-time velocity (0.27–0.35 h/pt). Issue worth resolving at seeds-template level — multi-PR session math is unsolved.

**From Phase 8 on (DEC-S026):** velocity = throughput (points per calendar week) + estimate calibration, straight from GitHub issue dates + `points:` labels. The h/pt rows above are a retired metric on a different denominator — don't blend.

| Phase | Points | Span (d) | Throughput | Re-est'd | Net drift | Sessions |
|-------|--------|----------|------------|----------|-----------|----------|
| 8     | 31²    | 25.5     | 8.5 pts/wk (2 active wks ≈ 15.5) | 0 | 0 | 4 |
| 9     | 25     | 9.2      | 19.1 pts/wk (1 active wk) | 0 | 0 (+2 tasks/+4 pts added mid-phase) | 3 |

² #195/#200 (harvest sheet pair) carried no `points:` label — not counted.

---

## v1 Total

- **106 pts all-in** (with realtime live)
- **101 pts** with 3.8 (realtime) shipped behind a dark flag

**Time projection:**
- Best case (0.15 hrs/pt): **~15.9 hrs** all-in / **~15.2 hrs** dark realtime
- Conservative (0.35 hrs/pt): **~37.1 hrs** all-in / **~35.4 hrs** dark realtime

**V1.5 (Phase 6.5):** **15 pts** for multi-unit products (DEC-032). Sized as a focused follow-up phase; not counted in V1 totals.

**Re-baselined 2026-05-10:** Phase 2 +1 pt (2.0b migration to drop pickup_windows + flip is_open default per DEC-029/DEC-030). Phase 3.4 8→5 pts (DEC-029 simplification of order form: free-text fulfillment replaces pickup-window picker). Net: −2 pts in V1; +15 pts in new V1.5 phase. See DEC-029, DEC-030, DEC-031, DEC-032.

**Re-baselined 2026-05-08:** SMS pivot (DEC-026/027) reshaped the old Phase 5 (Notifications, 12 pt Twilio integration) into the new Phase 4 (Notifications, 11 pt deep-link + email), removing the multi-week carrier-approval risk from the critical path. The old Phase 3 (customers + tokens) and Phase 4 (public ordering) were combined into a single customer-side Phase 3, with a new 3.0 priority-column migration. Old Phases 6 and 7 renumbered to 5 and 6. Net: +1 pt, materially less schedule risk.

---

## Phase 0 — Bootstrap (19 pts → ~2.85–6.65 hrs)

Goal: deployable empty Next.js app at `order.baybranchfarm.com` with Supabase, Playwright, and CI green.

| # | Task | Pts | Status |
|---|---|---|---|
| 0.1 | Init `bushel`, copy `seeds` → `.claude/`, `docs/`, fill placeholders | 3 | [x] <!-- completed 2026-05-03 in seeds session 15: copied skills/agents/settings, populated docs (SPEC, USER_STORIES, BRAND, AGENTS, VELOCITY_AND_POKER_GUIDE), wrote bushel CLAUDE.md, added DEC-023 (testing) + DEC-024 (PM workflow), created sessions/ dir --> |
| 0.2 | Next.js 16 + TS strict + sailbook-style CSS scaffold; Vercel project; CNAME for `order` | 3 | [x] [#3](https://github.com/mobiustripper42/bushel/issues/3) |
| 0.3 | Supabase project; Google OAuth + customer token column | 2 | [x] [#4](https://github.com/mobiustripper42/bushel/issues/4) |
| 0.5 | Test scaffolding: Playwright (3-device), `tests/helpers.ts`, pgTAP harness, `supabase/seed.sql` with test users | 3 | [x] [#5](https://github.com/mobiustripper42/bushel/issues/5) |
| 0.6 | GitHub Actions CI: Supabase Docker, `playwright test`, `supabase test db` (from-scratch; high-priority `seeds` backport) | 5 | [x] [#6](https://github.com/mobiustripper42/bushel/issues/6) |
| 0.7 | `BRAND.md` filled, B2B-warm voice rules, color/type matched to baybranchfarm.com, `ui-reviewer` agent customized | 3 | [x] [#7](https://github.com/mobiustripper42/bushel/issues/7) |

---

## Phase 1 — Data model + admin shell (16 pts → ~2.4–5.6 hrs)

| # | Task | Pts | Status |
|---|---|---|---|
| 1.1a | Schema design (sketched in plan; finalize tweaks) | 3 | [x] [#16](https://github.com/mobiustripper42/bushel/issues/16) |
| 1.1b | Schema migrations + indexes (`products`, `customers`, `orders` w/ `needs_reconciliation`, `order_items`, ~~`pickup_windows`~~ [dropped in 2.0b per DEC-029], `ordering_schedule`) | 5 | [x] [#17](https://github.com/mobiustripper42/bushel/issues/17) |
| 1.2 | RLS policies + pgTAP tests; service-role-as-gate, RLS-as-backstop | 3 | [x] [#18](https://github.com/mobiustripper42/bushel/issues/18) |
| 1.3 | Admin route group; Google OAuth flow; admin guard middleware | 3 | [x] [#19](https://github.com/mobiustripper42/bushel/issues/19) |
| 1.4 | Empty admin shell with nav; auth-required Playwright spec | 2 | [x] [#20](https://github.com/mobiustripper42/bushel/issues/20) |
| — | Authenticated admin Playwright tests (blocked on headless auth) | — | Moved to Phase 2 [#27](https://github.com/mobiustripper42/bushel/issues/27) |

---

## Phase 2 — Inventory editing (10 pts → ~1.5–3.5 hrs)

| # | Task | Pts | Status |
|---|---|---|---|
| 2.0a | UX screen vs schema + decision audit: close gaps found (products.category, notification_preference cleanup, delivery window decision) | 2 | [x] [#35](https://github.com/mobiustripper42/bushel/issues/35) |
| 2.0b | Schema migration: drop `pickup_windows` table + `orders.pickup_window_id`; add `orders.pickup_note`, `orders.delivery_preference`; flip `ordering_schedule.is_open` default to `true`; regenerate types (DEC-029, DEC-030) | 1 | [x] [#41](https://github.com/mobiustripper42/bushel/issues/41) |
| 2.1 | Inventory editor (spreadsheet-style row form); Playwright spec rolled in. **Shipped twice — first attempt (PR #44) missed `design/admin-inventory.jsx`, rebuilt in PR #57 with app-wide design system stood up alongside.** | 5 | [x] [#32](https://github.com/mobiustripper42/bushel/issues/32) |
| 2.2 | "Pre-populate from last week" action (simple reset, no snapshots in v1) | 2 | [x] [#33](https://github.com/mobiustripper42/bushel/issues/33) |

---

## Phase 3 — Customer side (34 pts all-in / 29 pts with 3.8 dark → ~5.1–11.9 hrs)

Customer management, tokenized URL access, and the public ordering experience. Combined from the prior Phase 3 (customers + tokens, 11 pts) and Phase 4 (public ordering, 24 pts), plus a new 3.0 priority-column migration. Both prior phases were small and coherent as one customer-side surface.

| # | Task | Pts | Status |
|---|---|---|---|
| 3.0 | Customer `priority` column migration + types regenerated | 2 | [x] [#45](https://github.com/mobiustripper42/bushel/issues/45) |
| 3.1 | Manual customer CRUD UI (admin); priority field; email/phone OR validation | 3 | [x] [#46](https://github.com/mobiustripper42/bushel/issues/46) |
| 3.2 | Token generation, durable per-customer URL, regenerate button + thorough testing | 5 | [x] [#47](https://github.com/mobiustripper42/bushel/issues/47) |
| 3.3 | `/c/[token]` route validates token, sets cookie, identifies customer; thorough session testing | 3 | [x] [#48](https://github.com/mobiustripper42/bushel/issues/48) |
| 3.4 | Customer inventory page; order form (running total, qty steppers, delivery/pickup toggle, address pre-fill, free-text pickup-note OR delivery-preference per DEC-029, optional customer-notes textarea) | 5 | [x] [#49](https://github.com/mobiustripper42/bushel/issues/49) |
| 3.5 | Optimistic order placement: insert + decrement (allow negative), set `needs_reconciliation` flag if oversold | 3 | [x] [#50](https://github.com/mobiustripper42/bushel/issues/50) |
| 3.6 | Manual open/close toggle (default open per DEC-030); optional scheduled cutoff + "open for N hours" override; Vercel Cron + TZ math kicks in only when schedule columns are set | 5 | [x] [#51](https://github.com/mobiustripper42/bushel/issues/51) |
| 3.7 | Closed state + per-item sold-out (disabled row at qty=0) + all-sold-out empty state (DEC-031); Playwright specs (golden, closed-mid-order race, oversold-flags-for-admin) | 3 | [x] [#52](https://github.com/mobiustripper42/bushel/issues/52) |
| 3.8 | Realtime inventory subscription, behind `NEXT_PUBLIC_REALTIME_INVENTORY` flag, ship-or-skip at end of Phase 3 | 5 | Moved to Phase 6 [#53](https://github.com/mobiustripper42/bushel/issues/53) |
| polish | Admin shell top bar + sidebar footer + nav badges | 5 | [x] [#66](https://github.com/mobiustripper42/bushel/issues/66) <!-- Added during P3 retro --> |
| polish | pgTAP coverage for DEC-029 + DEC-030 columns | 2 | [x] [#67](https://github.com/mobiustripper42/bushel/issues/67) <!-- Added during P3 retro --> |

---

## Phase 4 — Notifications (11 pts → ~1.65–3.85 hrs)

Operator-sent SMS via native deep links (DEC-026); admin order-arrival alert via transactional email (DEC-027). No third-party SMS provider — no carrier compliance, no provisioning, no approval queue.

| # | Task | Pts | Status |
|---|---|---|---|
| 4.1 | `sms:` deep-link builder utility (URL-encode body + token, iOS/Android verified) | 2 | [x] [#87](https://github.com/mobiustripper42/bushel/issues/87) |
| 4.2 | Send-queue page: weekly update + order confirmation + pickup reminder modes; priority-ordered customer list (DEC-026); per-customer Send button + mark-as-sent state | 5 | [x] [#88](https://github.com/mobiustripper42/bushel/issues/88) |
| 4.3 | Order-arrival admin alert: transactional send on order create. **Pivoted to Telegram bot push (DEC-033)** during planning — supersedes DEC-027's email-first decision. | 2 | [x] [#89](https://github.com/mobiustripper42/bushel/issues/89) |
| 4.4 | Playwright spec: deep-link generation, customer ordering, mark-as-sent flow | 2 | [x] [#90](https://github.com/mobiustripper42/bushel/issues/90) |

**Stretch:** PWA push for the order-arrival alert (DEC-033 upgrade path; original framing in DEC-027). Wire if Android push proves reliable; Telegram is the v1 path.

---

## Phase 5 — Order management (8 pts → ~1.2–2.8 hrs)

| # | Task | Pts | Status |
|---|---|---|---|
| 5.1 | Order list (column sort + week filter); status update UI; `needs_reconciliation` rows highlighted regardless of sort | 3 | [x] [#97](https://github.com/mobiustripper42/bushel/issues/97) |
| 5.2 | Export to Wave: CSV download + copy-to-clipboard (TSV) | 3 | [x] [#98](https://github.com/mobiustripper42/bushel/issues/98) |
| 5.3 | Playwright spec: status transitions + export (clipboard read) | 2 | [x] [#99](https://github.com/mobiustripper42/bushel/issues/99) |

---

## Phase 6 — Polish + go-live (36 pts → ~5.4–12.6 hrs)

DEC-034 amends DEC-019: admin is fully mobile-responsive; desktop is the primary surface. Annabel runs the farm from her phone during ops hours.

| # | Task | Pts | Status |
|---|---|---|---|
| 6.1 | Customer-side responsive sweep + brand polish + `ui-reviewer` pass + optional Claude design tooling pass | 5 | [x] [#106](https://github.com/mobiustripper42/bushel/issues/106) → [PR #128](https://github.com/mobiustripper42/bushel/pull/128) |
| 6.2 | Production env: Vercel env vars, DNS for `order` confirmed, secrets; Wave production data imported (11 customers, 12 products) | 2 | [x] [#107](https://github.com/mobiustripper42/bushel/issues/107) — no PR (manual config) |
| 6.3 | UAT with Annabel; final fixes; structural issues defer to Phase 7 | 3 | [x] [#108](https://github.com/mobiustripper42/bushel/issues/108) — UAT complete; 6 follow-up issues filed as Phase 7 |
| 6.4 | `/admin/send` mobile-responsive (queue list at 375px; touch-friendly Send buttons) | 3 | [x] [#109](https://github.com/mobiustripper42/bushel/issues/109) → [PR #116](https://github.com/mobiustripper42/bushel/pull/116) |
| 6.5 | `/admin/orders` mobile-responsive (table → card stack at 375px; export split-button stays usable on touch) | 3 | [x] [#110](https://github.com/mobiustripper42/bushel/issues/110) → [PR #117](https://github.com/mobiustripper42/bushel/pull/117) |
| 6.6 | Admin shell responsive + /admin/inventory + /admin/customers mobile card-stack | 5 | [x] [#111](https://github.com/mobiustripper42/bushel/issues/111) → [PR #118](https://github.com/mobiustripper42/bushel/pull/118) |
| 6.7 | Desktop SMS relay via copy-clipboard + messages.google.com (operator path when on desktop) | 2 | [x] [#112](https://github.com/mobiustripper42/bushel/issues/112) → [PR #119](https://github.com/mobiustripper42/bushel/pull/119) |
| 6.8 | Extract `admin()` / `customerIds()` / `seedOrder()` / `clearOrdersForWeek()` into `tests/helpers.ts` — six spec files have drifted copies | 2 | [x] [#113](https://github.com/mobiustripper42/bushel/issues/113) → [PR #121](https://github.com/mobiustripper42/bushel/pull/121) |
| 6.9 | Realtime inventory subscription, behind `NEXT_PUBLIC_REALTIME_INVENTORY` flag (ship-or-skip) | 5 | [~] [#53](https://github.com/mobiustripper42/bushel/issues/53) — moved to V2 (labeled `v2`) |
| 6.10 | Admin customers — show deactivated customers (toggle/filter) | 2 | [~] [#61](https://github.com/mobiustripper42/bushel/issues/61) — moved to V2 (labeled `v2`) |
| 6.11 | Standardize admin-only auth guard across server actions | 2 | [x] [#63](https://github.com/mobiustripper42/bushel/issues/63) — closed as won't-do (RLS already covers it) |
| 6.12 | Infra — auto-rebind preview.baybranchfarm.com at branch cut | 2 | [x] [#69](https://github.com/mobiustripper42/bushel/issues/69) — closed as won't-do (manual click is fine for 1-dev project) |
| 6.13 | Phase 6 polish — Add favicon (source from baybranchfarm.com). *Added during P6 retro — actually shipped in S23.* | 1 | [x] [#79](https://github.com/mobiustripper42/bushel/issues/79) → [PR #85](https://github.com/mobiustripper42/bushel/pull/85) |
| 6.14 | Bug — Phase 5 close regression: re-land #103/#104/#105 code lost in stacked-PR merge. *Added during P6 retro.* | 2 | [x] [#114](https://github.com/mobiustripper42/bushel/issues/114) → [PR #115](https://github.com/mobiustripper42/bushel/pull/115) |
| 6.15 | Tidy — collapse test-helper aliases (`adminClient`/`testCustomerIds`/`clearWeek`) to one canonical name. *Added mid-phase from PR #121 code review.* | 1 | [x] [#122](https://github.com/mobiustripper42/bushel/issues/122) → [PR #125](https://github.com/mobiustripper42/bushel/pull/125) |
| 6.16 | Bug — customer-place-order pollutes notifications-flow spec when run in alphabetical order. *Added mid-phase.* | 1 | [x] [#123](https://github.com/mobiustripper42/bushel/issues/123) → [PR #127](https://github.com/mobiustripper42/bushel/pull/127) |
| 6.17 | Redirect root URL `/` → `/admin`; move VersionTag to login footer. *Added during P6.2 prod-env work — no issue.* | 1 | [x] [PR #126](https://github.com/mobiustripper42/bushel/pull/126) |

**V1 shipped 2026-05-18 (`order.baybranchfarm.com` live).** Phase 7 = rolling feature backlog post-go-live (issues #129–#134 filed from Annabel's UAT, 12 pts).

---

## Phase 6.5 — V1.5: Multi-unit products (15 pts → ~2.25–5.25 hrs)

Adds multi-unit denomination per product (DEC-032). Inventory in base units; customer picks unit at order; conversion happens at decrement. Pricing is independent per unit (does NOT revive per-customer pricing — DEC-007 still defers that to V2).

Contingent on Annabel confirming the V1 multi-unit product count is small (~3); if "most products," pull DEC-032 forward into V1.

| # | Task | Pts | Status |
|---|---|---|---|
| 6.5a | Migration: add `product_units` table; move `products.unit`/`price_cents` semantics into rows there; convert `products.qty_available` to `numeric(10,2)`; add `order_items.product_unit_id` FK; backfill existing single-unit products as one `product_units` row each; backfill existing `order_items.product_unit_id` to the corresponding new row | 3 | TBD |
| 6.5b | Inventory editor: per-product "Units" sub-sheet (add/remove/edit unit rows with label, conversion-to-base, price, active flag); base-unit row protected | 5 | TBD |
| 6.5c | Customer order form: radio-button unit picker (2+ active units only); qty resets on radio change; sold-out per-unit (disable radio when `qty_available < conversion_to_base`) | 2 | TBD |
| 6.5d | Order placement: fractional decrement (`qty * conversion_to_base`), per-unit `unit_price_cents` snapshot, whole-product-sold-out logic ignoring `is_available=false` rows | 2 | TBD |
| 6.5e | Pre-fill from last week: pre-fills the unit set per product, not just qty | 1 | TBD |
| 6.5f | Playwright + pgTAP: conversion math, per-unit sold-out, oversell-by-unit reconciliation, order-detail display strings | 2 | TBD |

---

## Phase 7 — Post-go-live feature backlog

V1 shipped 2026-05-18. Phase 7 = one rolling phase of features, no fixed scope, no end date. The GitHub issue list (label `phase:7`) is the canonical backlog; this section is the prose summary.

**Filed as issues** (sized; see GitHub for full text):
- UAT punch-list from Annabel: #129 unsaved-changes guard, #130 unsubscribed-customer block, #131 Telegram chat swap, #132 oversold-at-qty=0 bug, #133 `products.slug` column, #134 pre-populate UAT.
- Carry-overs from prior phases: #53 realtime inventory, #61 deactivated-customers toggle, #63 *(closed won't-do)*, #69 *(closed won't-do)*.
- Future-features: #135 multi-unit products epic (DEC-032), #136 customer order history, #137 per-customer pricing, #138 minimum delivery amount, #139 10DLC brand registration *(trigger-gated)*, #140 native Android app for Annabel push, #120 Messages-for-Web Chrome extension.

**Explicitly not building** (was in old "Phase 7+" list; removed):
- ~~Wave API direct integration~~ — eric is switching off Wave in October; CSV export workflow is sufficient until then, and the replacement accounting system's API will dictate the new shape.
- ~~Public signup for individuals~~ — wholesale-only is the product, not a V1 limitation.

**Open-ended ideas** — see [`docs/FUTURE_IDEAS.md`](FUTURE_IDEAS.md). Wishlist that hasn't earned an issue yet; promote when the trigger fires.

**Closed 2026-05-28 (retro):** 45 pts shipped across 7 sessions (S28–S34), 0.80 active h/pt. Multi-unit products epic (6.5a–f, #151–156, #135) landed; UAT punch-list cleared (#129–134 except #132/#134); admin polish (#143 drag-reorder, #61 deactivated toggle, #129 unsaved-guard); Messages-for-Web extension (#120). Seven parking-lot issues closed-not-built (trigger-gated wishlist: #53, #136, #137, #138, #139, #146, #174). **4 issues moved to Phase 8:** #170 PWA admin install/push, #149 cart-cleared-on-rotation (non-repro), #134 prepopulate UAT, #132 oversell-at-qty=0 bug. Full retro in [`RETROSPECTIVES.md`](RETROSPECTIVES.md).

---

## Phase 8 — Post-go-live feature backlog (continued)

Rolling phase, continuation of the Phase 7 model: no fixed scope, no end date. The GitHub issue list (label `phase:8`) is the canonical backlog; this section is the prose summary. Materialized 2026-05-29 from the four Phase 7 carry-overs (no new issues created — they already existed).

**Starting backlog (8 pts):**
- [#170](https://github.com/mobiustripper42/bushel/issues/170) PWA admin: home-screen install + push notifications (3)
- [#149](https://github.com/mobiustripper42/bushel/issues/149) Cart cleared on phone rotation (Brave/Android) — non-reproducible, recheck (2) — *watch: non-repro expands on contact*
- [#134](https://github.com/mobiustripper42/bushel/issues/134) Proper UAT of 'Pre-populate from last week' inventory action (1)
- [#132](https://github.com/mobiustripper42/bushel/issues/132) Bug: order placed for qty=4 against qty=0 inventory (2) — *watch: correctness bug*

Forecast at 0.80 active h/pt (Phase 7 headline) → ~6.4h active for the opening backlog. New work lands as `phase:8` issues; promote from [`docs/FUTURE_IDEAS.md`](FUTURE_IDEAS.md) when triggers fire.

**Closed 2026-06-12 (retro run late, 2026-07-02, alongside Phase 9's — the phase ended without ceremony when Phase 9 planning started).** 14 issues closed, 31 labeled pts (+#195/#200 unlabeled — harvest sheet, pointed nowhere): Send-Texts rework + Confirmed status + per-order action stack (#188–#193), Harvest & Pack Sheet (#195/#200), hide/show inventory #207, DEC-036 sold-out reject #132, cart persistence #149, product_units authoritative #212, changeable base unit #208, PWA install #170, prepopulate UAT #134. Throughput 8.5 pts/calendar-wk over 25.5d (bursty: everything closed in 2 ISO weeks ≈ 15.5 pts/active-wk). 23 PRs merged. Full retro in [`RETROSPECTIVES.md`](RETROSPECTIVES.md).

---

## Phase 9 — Open-Order Pivot (21 pts → ~17 h active @ 0.80 h/pt)

Re-keys order identity from the week to the open order, kills the scheduled-close cron, fixes the SKU/`description` export landmine and the `picked_up` status split, and reworks the admin orders list for the new model. Design locked in the planning memo + an `@architect` pass (2026-06-22, Opus — Fable unavailable). DEC-040–045.

**Hard cutover** at go-live: wipe `orders`/`order_items`/`customer_sends`, keep `products`/`product_units`/`customers` — no history, no backfill, brief quiet-minute outage accepted (DEC-041).

**Step 0 (infra gate, not a task):** bootstrap the `production` deploy branch (`git checkout -b production main && git push -u origin production`) + repoint Vercel's Production Branch to `production` **before** `main` takes Phase 9 work — else WIP auto-deploys to prod (DEC-S022).

**Sequencing:** 9.1 (merge #218) before 9.3a (`CREATE OR REPLACE` of #218's `place_order`); 9.3a before 9.3b; 9.5 before 9.3b (shared `report.ts` lines).

| # | Task | Pts | Status |
|---|---|---|---|
| 9.1 | Merge #211/#218 additive orders + whole-order summary + "Update order" copy | 2 | [x] [#224](https://github.com/mobiustripper42/bushel/issues/224) |
| 9.2 | Disable scheduled-close cron — always-open (DEC-040) | 1 | [x] [#225](https://github.com/mobiustripper42/bushel/issues/225) |
| 9.3a | Open-order identity — partial unique index + `place_order` re-key (DEC-041) | 5 | [x] [#226](https://github.com/mobiustripper42/bushel/issues/226) |
| 9.3b | Customer open-order UX — editable open order, terminal read-only (DEC-042) | 3 | [x] [#227](https://github.com/mobiustripper42/bushel/issues/227) |
| 9.4 | Per-unit editable SKU; remove `description` from Wave export (DEC-043) | 3 | [x] [#228](https://github.com/mobiustripper42/bushel/issues/228) |
| 9.5 | BUG: canonicalize `order_status` to `picked_up` (DEC-044) | 2 | [x] [#229](https://github.com/mobiustripper42/bushel/issues/229) |
| 9.6 | Inventory hidden-state visual — "Hidden" pill + accent bar | 2 | [x] [#230](https://github.com/mobiustripper42/bushel/issues/230) |
| 9.7 | Harvest & Pack Sheet — print readability (added during P9, pre-retro) | 2 | [x] [#235](https://github.com/mobiustripper42/bushel/issues/235) |
| 9.8 | Admin orders list — drop week filter, active + past-orders view (DEC-045) | 3 | [x] [#231](https://github.com/mobiustripper42/bushel/issues/231) |
| — | Consolidate duplicate order lines across all views (DEC-039 appends) — *Added during P9 retro* | 2 | [x] [#241](https://github.com/mobiustripper42/bushel/issues/241) |

**Closed 2026-07-02 (retro):** 25 pts, 10 issues, span 9.2d — throughput 19.1 pts/calendar-wk (single active ISO week). 13 PRs merged in-window. Hard cutover applied to dev/preview; **production cutover pending** (Eric's quiet-minute call: prod `db push` → `/promote-production`, DB before code).

DEC-039 (#218's additive-orders decision) lands in `DECISIONS.md` when 9.1 merges; DEC-040–045 are already written. Customer-facing order history (#136) stays in the backlog.

---

## `seeds` Backports (track via `/sync-config`)

1. **Test scaffolding** — Playwright config, pgTAP layout, `supabase/seed.sql`, GitHub Actions workflow. Coordinate with parallel session.
2. **Tech-stack DECISIONS.md template entry** — make stack call explicit on day one.
3. **`BRAND.md` fields the `ui-reviewer` agent expects.**
4. **Phase 0 recipe** — concrete Next.js + Supabase bootstrap steps.
5. **`domain/` stub** — flesh out or remove.

---

## Open Questions (pending product-owner discussion)

- **Minimum delivery amount (dollars):** threshold for delivery, or free-delivery cutoff? Phase 7+ candidate.
- **Multi-unit product count (DEC-032):** confirm with Annabel how many V1 products genuinely need multi-unit. If small (~3), V1.5 framing in Phase 6.5 holds; if large, pull DEC-032 forward into V1.
- Specific Sun/Mon send time → Annabel fills in once cadence stabilizes
- Final SMS copy → drafted in Phase 4 with feedback in preview UI
- sailbook's exact CSS approach → confirm at start of Phase 0 (DEC-021)
- GitHub Actions CI scope → revisit in Phase 6
- Split admin into `admin.baybranchfarm.com` if surface grows → revisit at end of Phase 3
- Realtime live or dark → decide at end of Phase 3
