# bushel — Project Plan

Bay Branch Farm Inventory & Order System. Replaces tend.com for ~7 B2B
customers (2 farm stands, 1 grocery store, 3–4 restaurants) on a weekly
Sun/Mon → Wed/Thu cadence.

See also:
- `docs/review/spec-for-annabel.html` — high-level review doc for the product owner (post-pivot)
- `docs/SPEC.md` — original product spec (TODO: port from HTML)
- `docs/DECISIONS.md` — architectural decisions (DEC-001…DEC-027)
- `docs/USER_STORIES.md` — flows A/B/C, B2B-reframed (TODO)
- `docs/BRAND.md` — voice, type, color (TODO)

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

Fibonacci scale: 2, 3, 5, 8. No 1s. Avoid 13s (break down).

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
| 1.1b | Schema migrations + indexes (`products`, `customers`, `orders` w/ `needs_reconciliation`, `order_items`, `pickup_windows`, `ordering_schedule`) | 5 | [x] [#17](https://github.com/mobiustripper42/bushel/issues/17) |
| 1.2 | RLS policies + pgTAP tests; service-role-as-gate, RLS-as-backstop | 3 | [x] [#18](https://github.com/mobiustripper42/bushel/issues/18) |
| 1.3 | Admin route group; Google OAuth flow; admin guard middleware | 3 | [x] [#19](https://github.com/mobiustripper42/bushel/issues/19) |
| 1.4 | Empty admin shell with nav; auth-required Playwright spec | 2 | [x] [#20](https://github.com/mobiustripper42/bushel/issues/20) |
| — | Authenticated admin Playwright tests (blocked on headless auth) | — | Moved to Phase 2 [#27](https://github.com/mobiustripper42/bushel/issues/27) |

---

## Phase 2 — Inventory editing (10 pts → ~1.5–3.5 hrs)

| # | Task | Pts | Status |
|---|---|---|---|
| 2.0a | UX screen vs schema + decision audit: close gaps found (products.category, notification_preference cleanup, delivery window decision) | 2 | [#35](https://github.com/mobiustripper42/bushel/issues/35) |
| 2.0b | Schema migration: drop `pickup_windows` table + `orders.pickup_window_id`; add `orders.pickup_note`, `orders.delivery_preference`; flip `ordering_schedule.is_open` default to `true`; regenerate types (DEC-029, DEC-030) | 1 | TBD |
| 2.1 | Inventory editor (spreadsheet-style row form); Playwright spec rolled in | 5 | [#32](https://github.com/mobiustripper42/bushel/issues/32) |
| 2.2 | "Pre-populate from last week" action (simple reset, no snapshots in v1) | 2 | [#33](https://github.com/mobiustripper42/bushel/issues/33) |

---

## Phase 3 — Customer side (34 pts all-in / 29 pts with 3.8 dark → ~5.1–11.9 hrs)

Customer management, tokenized URL access, and the public ordering experience. Combined from the prior Phase 3 (customers + tokens, 11 pts) and Phase 4 (public ordering, 24 pts), plus a new 3.0 priority-column migration. Both prior phases were small and coherent as one customer-side surface.

| # | Task | Pts | Status |
|---|---|---|---|
| 3.0 | Customer `priority` column migration + types regenerated | 2 | TBD |
| 3.1 | Manual customer CRUD UI (admin); priority field; email/phone OR validation | 3 | TBD |
| 3.2 | Token generation, durable per-customer URL, regenerate button + thorough testing | 5 | TBD |
| 3.3 | `/c/[token]` route validates token, sets cookie, identifies customer; thorough session testing | 3 | TBD |
| 3.4 | Customer inventory page; order form (running total, qty steppers, delivery/pickup toggle, address pre-fill, free-text pickup-note OR delivery-preference per DEC-029, optional customer-notes textarea) | 5 | TBD |
| 3.5 | Optimistic order placement: insert + decrement (allow negative), set `needs_reconciliation` flag if oversold | 3 | TBD |
| 3.6 | Manual open/close toggle (default open per DEC-030); optional scheduled cutoff + "open for N hours" override; Vercel Cron + TZ math kicks in only when schedule columns are set | 5 | TBD |
| 3.7 | Closed state + per-item sold-out (disabled row at qty=0) + all-sold-out empty state (DEC-031); Playwright specs (golden, closed-mid-order race, oversold-flags-for-admin) | 3 | TBD |
| 3.8 | Realtime inventory subscription, behind `NEXT_PUBLIC_REALTIME_INVENTORY` flag, ship-or-skip at end of Phase 3 | 5 | TBD |

---

## Phase 4 — Notifications (11 pts → ~1.65–3.85 hrs)

Operator-sent SMS via native deep links (DEC-026); admin order-arrival alert via transactional email (DEC-027). No third-party SMS provider — no carrier compliance, no provisioning, no approval queue.

| # | Task | Pts | Status |
|---|---|---|---|
| 4.1 | `sms:` deep-link builder utility (URL-encode body + token, iOS/Android verified) | 2 | TBD |
| 4.2 | Send-queue page: weekly update + order confirmation + pickup reminder modes; priority-ordered customer list (DEC-026); per-customer Send button + mark-as-sent state | 5 | TBD |
| 4.3 | Order-arrival admin email alert: transactional send on order create; provider config (Resend or similar) | 2 | TBD |
| 4.4 | Playwright spec: deep-link generation, customer ordering, mark-as-sent flow | 2 | TBD |

**Stretch:** PWA push for the order-arrival alert (DEC-027 upgrade path). Wire if Android push proves reliable; otherwise email is the v1 path.

---

## Phase 5 — Order management (8 pts → ~1.2–2.8 hrs)

| # | Task | Pts | Status |
|---|---|---|---|
| 5.1 | Order list (column sort + week filter); status update UI; `needs_reconciliation` rows highlighted regardless of sort | 3 | TBD |
| 5.2 | Export to Wave: CSV download + copy-to-clipboard (TSV) | 3 | TBD |
| 5.3 | Playwright spec: status transitions + export (clipboard read) | 2 | TBD |

---

## Phase 6 — Polish + go-live (10 pts → ~1.5–3.5 hrs)

| # | Task | Pts | Status |
|---|---|---|---|
| 6.1 | Customer-side responsive sweep + brand polish + `ui-reviewer` pass + optional Claude design tooling pass | 5 | TBD |
| 6.2 | Production env: Vercel env vars, transactional email service configured (provider, API key, single-recipient deny-list test), DNS for `order` confirmed, secrets | 2 | TBD |
| 6.3 | UAT with Annabel; final fixes; structural issues defer to Phase 7+ | 3 | TBD |

V1 ships at end of Phase 6.

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

## Phase 7+ (deferred / optional)

- Wave API direct integration
- Per-customer pricing
- Public signup for individuals
- Self-serve order edits/cancellations
- Per-customer reminder preferences (incl. expanding `notification_preference` to email)
- **Minimum delivery amount** (dollar threshold) — product owner discussion item
- Delivery fee logic
- Order history page for repeat customers
- Strict-decrement / hard rejection (only if optimistic causes real pain)
- Realtime inventory subscription (if 3.8 shipped dark)
- Weekly inventory snapshots / history
- **PWA push: "next-customer nudge" during send batches** — wire after PWA push proves reliable for the order-arrival alert (DEC-027). Lets Annabel walk away mid-batch and get pinged for the next send.
- **Bushel 10DLC brand registration + A2P migration** — trigger when volume crosses ~50 messages/week or operator wants automated unattended sends. Reverses DEC-026 in part; DEC-026 captures the trip-wire.

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
