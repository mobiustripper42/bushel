# Changelog

## [0.10.14] - 2026-07-02
- PR #243: #231 Admin orders: Active/Fulfilled views replace the week filter (DEC-045)

## [0.10.13] - 2026-07-01
- PR #242: #241 Consolidate duplicate order lines across all order views

## [0.10.12] - 2026-07-01
- PR #240: Admin orders: action stack into the detail grid (row-height fix)

## [0.10.11] - 2026-07-01
- PR #239: Open-order pivot core: 9.2 + 9.5 + 9.3a + 9.3b (DEC-040/041/042/044)

## [0.10.10] - 2026-07-01
- PR #238: Clear tsc + eslint debt (restore zero-error typecheck/lint)

## [0.10.9] - 2026-07-01
- PR #237: Show build VersionTag at the bottom of the admin sidebar

## [0.10.8] - 2026-07-01
- PR #236: 9.1 (#224): whole-order summary in add mode + Update order copy

## [0.10.7] - 2026-06-27
- PR #234: auto-sync downstream — 2026-06-27

## [0.10.6] - 2026-06-25
- PR #218: #211 Additive orders — append to the week's order (DEC-039)

## [0.10.5] - 2026-06-23
- PR #232: Phase 9 setup: open-order pivot — DEC-040–045 + plan + issues

## [0.10.4] - 2026-06-22
- PR #223: Drop @architect Fable pin → Opus (seeds DEC-S029)

## [0.10.3] - 2026-06-15
- PR #222: Keep @architect on Fable 5 in Model Selection prose

## [0.10.2] - 2026-06-15
- PR #221: auto-sync downstream — 2026-06-15

## [0.10.1] - 2026-06-13
- PR #219: auto-sync downstream — 2026-06-13

## [0.10.0] - 2026-06-12 — Phase 8
- 31 pts shipped across 4 sessions (throughput 8.5 pts/calendar-wk)
- Retro run late (2026-07-02); see `docs/RETROSPECTIVES.md`

## [0.9.23] - 2026-06-12
- PR #217: #208 changeable base unit — atomic invariant-preserving rebase (DEC-038)

## [0.9.22] - 2026-06-12
- PR #216: #212 product_units strictly authoritative — drop mirror columns (DEC-037)

## [0.9.21] - 2026-06-12
- PR #215: #149 persist cart draft to sessionStorage (survive reload / phone rotation)

## [0.9.20] - 2026-06-11
- PR #214: #132 reject orders against sold-out (qty=0) products (DEC-036)

## [0.9.19] - 2026-06-11
- PR #213: #207 Hide/Show inventory items: soft-delete for products

## [0.9.18] - 2026-06-10
- PR #210: DEC-S019 extraction: CLAUDE.md → shell + .claude/CLAUDE-context.md

## [0.9.17] - 2026-06-10
- PR #209: auto-sync downstream — 2026-06-10

## [0.9.16] - 2026-06-07
- PR #206: DEC-S namespace sweep (seeds#101)

## [0.9.15] - 2026-06-06
- PR #205: auto-sync downstream — 2026-06-06

## [0.9.14] - 2026-06-05
- PR #204: Add delivery reminder send mode + template (#193, amends DEC-014)

## [0.9.13] - 2026-06-04
- PR #203: Orders page: per-order action stack in expanded detail (#192)

## [0.9.12] - 2026-06-04
- PR #202: Extract shared SendAction component from send-row (#191)

## [0.9.11] - 2026-06-04
- PR #201: Harvest sheet: exclude picked-up / delivered orders (#200)

## [0.9.10] - 2026-06-04
- PR #199: Add Confirmed order status + flow (#190, DEC-035)

## [0.9.9] - 2026-06-04
- PR #198: Send Texts page: rename, drop mode tabs, reword (#189)

## [0.9.8] - 2026-06-04
- PR #197: Rename Send Update → Send Texts nav item, reorder (#188)

## [0.9.7] - 2026-06-04
- PR #196: Harvest & Pack Sheet — public tokenized fulfillment report (#195)

## [0.9.6] - 2026-06-04
- PR #194: Tiller idea: the Harvest & Pack Sheet (order-close fulfillment view)

## [0.9.5] - 2026-06-02
- PR #187: Design: Orders status section redesign (mockup)

## [0.9.4] - 2026-06-02
- PR #186: Migrate to seeds v4 — production-branch model (Phase 1: skill set + version)

## [0.9.3] - 2026-05-31
- PR #185: auto-sync downstream 2026-05-31

## [0.9.2] - 2026-05-31
- PR #184: Order page UX fixes: greeting, fulfillment copy, stepper corners

## [0.9.1] - 2026-05-29
- PR #183: auto-sync downstream — 2026-05-29

## [0.9.0] - 2026-05-28 — Phase 7
- 45 pts shipped across 7 sessions (0.80 active h/pt)
- See `docs/RETROSPECTIVES.md` for the full retro

## [0.8.20] - 2026-05-28
- PR #179: Messages-for-Web auto-fill extension (closes #120)

## [0.8.19] - 2026-05-28
- PR #182: Mobile order summary: itemized your order above submit button

## [0.8.18] - 2026-05-28
- PR #181: Customer order page: drop item thumbnail, add product description

## [0.8.17] - 2026-05-26
- PR #178: Order-detail oversold gate + Sold-this-week column on /admin/inventory

## [0.8.16] - 2026-05-26
- PR #177: Inventory qty input: accept fractional values

## [0.8.15] - 2026-05-26
- PR #176: Block paused + deactivated customers from /c/[token] (closes #130)

## [0.8.14] - 2026-05-26
- PR #175: Inline-debug bundle: triggers, prepopulate rewrite, decimal inputs, chip-tab

## [0.8.13] - 2026-05-26
- PR #172: Unsaved-changes guard on admin data-entry forms (closes #129)

## [0.8.12] - 2026-05-25
- PR #169: Drag-to-reorder inventory rows (closes #143)

## [0.8.11] - 2026-05-25
- PR #171: Admin customers — show + reactivate deactivated rows (closes #61)

## [0.8.10] - 2026-05-25
- PR #167: Consistent items count across customer, admin, Telegram (closes #159)

## [0.8.9] - 2026-05-25
- PR #166: Inventory meta pills: drop Cutoff; Open-for-orders pulls from schedule

## [0.8.8] - 2026-05-24
- PR #165: Phase 6.5f — Per-line unit label everywhere + cross-cutting e2e tests (#156)

## [0.8.7] - 2026-05-24
- PR #164: Phase 6.5e — Unit-aware pre-populate + last-week price restore (#155)

## [0.8.6] - 2026-05-24
- PR #163: Phase 6.5d — Unit-aware place_order: fractional decrement + price snapshot (#154)

## [0.8.5] - 2026-05-24
- PR #162: Phase 6.5c — Customer order form: per-product unit picker (#153)

## [0.8.4] - 2026-05-23
- PR #160: Phase 6.5b — Per-product Units sub-sheet (#152)

## [0.8.3] - 2026-05-22
- PR #157: 6.5a — product_units migration + backfill + safety-net triggers

## [0.8.2] - 2026-05-22
- PR #150: Sticky-bar button: Review → scroll to fulfillment

## [0.8.1] - 2026-05-18
- PR #142: DEC-016 — extract Bay Branch Farm design system to .claude/ui-context.md

## [0.8.0] - 2026-05-18 — Phase 6 (V1 SHIPPED)
- 20 pts shipped across 2 sessions (0.25 h/pt active — project record)
- See `docs/RETROSPECTIVES.md` for the full retro

## [0.7.10] - 2026-05-18
- PR #128: Phase 6.1 — Customer-side responsive polish (#106)

## [0.7.9] - 2026-05-18
- PR #127: Fix flake: customer-place-order leaves order that breaks notifications-flow (#123)

## [0.7.8] - 2026-05-18
- PR #125: Tidy: collapse test-helper aliases to one canonical name (#122)

## [0.7.7] - 2026-05-18
- PR #126: Redirect root URL to /admin; move VersionTag to login footer

## [0.7.6] - 2026-05-18
- PR #121: Phase 6.8 — Extract test helpers into tests/helpers.ts (#113)

## [0.7.5] - 2026-05-18
- PR #119: Phase 6.7 — Desktop SMS relay via clipboard + Messages for Web (#112)

## [0.7.4] - 2026-05-18
- PR #118: Phase 6.6 — /admin/inventory + /admin/customers mobile-responsive (#111)

## [0.7.3] - 2026-05-18
- PR #117: Phase 6.5 — /admin/orders mobile-responsive (#110)

## [0.7.2] - 2026-05-18
- PR #116: Phase 6.4 (full) — admin shell collapses to drawer at ≤768px + /admin/send page CSS mobile-responsive

## [0.7.1] - 2026-05-18
- PR #115: Phase 5 recovery — re-land #103/#104/#105 code (closes #114)

## [0.7.0] - 2026-05-16 — Phase 5
- 11 pts shipped in 1 session (0.35 h/pt active)
- See `docs/RETROSPECTIVES.md` for the full retro

## [0.6.5] - 2026-05-16
- PR #105: Phase 5.3 — Playwright cross-task spec: customer → admin → export

## [0.6.4] - 2026-05-16
- PR #104: Phase 5.2 — Export to Wave (CSV download + clipboard TSV)

## [0.6.3] - 2026-05-16
- PR #103: Fix notifications-flow CI flake — sign-out invalidates shared session (#102)

## [0.6.2] - 2026-05-16
- PR #101: Phase 5.1 — admin orders list + status UI + reconciliation pin

## [0.6.1] - 2026-05-16
- PR #100: read-the-tape session 20: settings, retro Read-before-Edit, P17

## [0.6.0] - 2026-05-16 — Phase 4
- 11 pts shipped in 1 session (0.27 h/pt active)
- See `docs/RETROSPECTIVES.md` for the full retro

## [0.5.6] - 2026-05-16
- PR #96: Phase 4.4 — Notifications cross-task spec (re-PR to main after stacked-PR misfire)

## [0.5.5] - 2026-05-16
- PR #95: Phase 4.4 — Notifications cross-task Playwright spec (#90) — merged to parent branch (stacked-PR misfire); see #96 for actual main-branch landing

## [0.5.4] - 2026-05-16
- PR #94: Phase 4.3 — Order-arrival admin alert via Telegram (#89, DEC-033)

## [0.5.3] - 2026-05-16
- PR #93: Phase 4.2 — Send-queue page (#88)

## [0.5.2] - 2026-05-15
- PR #92: Phase 4.1 — `sms:` deep-link builder utility (#87)

## [0.5.1] - 2026-05-15
- PR #91: read-the-tape session 23: stale :3001, JSON-in-Bash, worktree cd hygiene

## [0.5.0] - 2026-05-15 — Phase 3
- 36 pts labeled (56 session-counted) shipped across 9 sessions (0.35 h/pt active)
- See `docs/RETROSPECTIVES.md` for the full retro
## [0.4.14] - 2026-05-15
- PR #86: Phase 3 polish: pgTAP coverage for DEC-029 + DEC-030 columns (closes #67)
## [0.4.13] - 2026-05-15
- PR #85: Phase 6 polish: BBF leaf favicon sourced from apex (closes #79)
## [0.4.12] - 2026-05-15
- PR #84: Phase 3 polish: admin shell top bar + sidebar footer + nav badges (closes #66)
## [0.4.11] - 2026-05-15
- PR #83: Phase 3.7: closed state + all-sold-out empty state (closes #52)
## [0.4.10] - 2026-05-15
- PR #81: Phase 3.6: manual open/close toggle + weekly schedule + cron (closes #51)
## [0.4.9] - 2026-05-15
- PR #78: Phase 3.5: optimistic order placement (closes #50)
## [0.4.8] - 2026-05-15
- PR #77: CI: run job inside Playwright container (closes #65)
## [0.4.7] - 2026-05-15
- PR #76: Document two-project Supabase split (dev/preview + prod)
## [0.4.6] - 2026-05-15
- PR #75: DEC-013 + DEC-014: per-task /kill-this, time math at retro, sessions on orphan branch
## [0.4.5] - 2026-05-14
- PR #72: Phase 3.3 — /c/[token] route validates token, sets cookie, 404s on invalid
- PR #73: Phase 3.4 — Customer inventory page + order form (no submission)
- PR #74: Phase 3.4.1 — Header grid + editable stepper with press-and-hold

## [0.4.4] - 2026-05-14
- PR #70: Infra — Stable preview.baybranchfarm.com URL + OAuth callback bugfix

## [0.4.3] - 2026-05-14
- PR #68: Audit drift cleanup — docs, mockup, two app-vs-DB bound fixes

## [0.4.2] - 2026-05-13
- PR #64: Phase 3.2 — Customer token generation + regenerate

## [0.4.1] - 2026-05-13
- PR #59: Phase 3.1 — Admin customer CRUD UI with priority + email/phone OR validation

## [0.4.0] - 2026-05-12 — Phase 2

- 10 pts shipped across 3 sessions (1.79 hrs/pt)
- See `docs/RETROSPECTIVES.md` for the full retro

## [0.3.6] - 2026-05-12
- PR #44: Phase 2.1 — Inventory editor (spreadsheet-style row form) — ⚠ does not match design/admin-inventory.jsx; rebuild scheduled
- PR #54: Phase 3.0 — Add customers.priority column for SMS send-queue ordering

## [0.3.5] - 2026-05-11
- PR #42: Phase 2.0b — drop pickup_windows, add fulfillment columns, flip is_open default

## [0.3.4] - 2026-05-10
- PR #39: Phase 2/3 — capture DEC-029…032; simplify fulfillment + sold-out spec; scope V1.5 multi-unit

## [0.3.3] - 2026-05-10
- PR #34: Phase 2 / #27 — authenticated admin Playwright tests via session injection

## [0.3.2] - 2026-05-10
- PR #37: Phase 2.0a — UX/schema audit: add products.category, replace notification_preference with send_weekly_link

## [0.3.1] - 2026-05-08
- PR #29: read-the-tape session 9 — workflow improvements (P3/P10, CX1, CX2, P11)

## [0.3.0] - 2026-05-08 — Phase 1
- 16 pts shipped across 3 sessions (1.13 hrs/pt)
- See `docs/RETROSPECTIVES.md` for the full retro

## [0.2.3] - 2026-05-08
- PR #28: Phase 1.4 — Admin shell layout, sidebar nav, sign-out action
- PR #26: Phase 1.3 — Admin route group, proxy auth guard, is_admin escalation fix

## [0.2.2] - 2026-05-08
- PR #25: SMS pivot + spec-for-annabel review HTML

## [0.2.1] - 2026-05-08
- PR #23: Phase 1.2 — RLS policies + pgTAP tests (service-role-as-gate, RLS-as-backstop)

## [0.2.0] - 2026-05-07 — Phase 0
- 20 pts shipped across 5 sessions (0.66 hrs/pt)
- See `docs/RETROSPECTIVES.md` for the full retro

## [0.1.4] - 2026-05-07
- PR #15: Phase 0.7 — brand tokens, customer status pages, design archive (closes #7)

## [0.1.3] - 2026-05-07
- PR #13: Phase 0.6 — GitHub Actions CI + rename PUBLISHABLE_KEY → ANON_KEY

## [0.1.2] - 2026-05-06
- PR #12: Phase 0.5 — Playwright scaffold (3-device), smoke test, pgTAP harness, seed.sql

## [0.1.1] - 2026-05-06
- PR #10: Phase 0.3 — Supabase scaffold, Google OAuth, customers table, dev port/host pinning
