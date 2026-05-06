# bushel — Project Plan

Bay Branch Farm Inventory & Order System. Replaces tend.com for ~7 B2B
customers (2 farm stands, 1 grocery store, 3–4 restaurants) on a weekly
Sun/Mon → Wed/Thu cadence.

See also:
- `docs/PROJECT_PLAN.html` — shiny version for the product owner
- `docs/SPEC.md` — original product spec (TODO: port from HTML)
- `docs/DECISIONS.md` — architectural decisions (DEC-001…DEC-022)
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
| _none yet_ | — | — | — |

Fibonacci scale: 2, 3, 5, 8. No 1s. Avoid 13s (break down).

---

## v1 Total

- **107 pts all-in** (with realtime live)
- **102 pts** with 4c.1 (realtime) shipped behind a dark flag

**Time projection:**
- Best case (0.15 hrs/pt): **~16 hrs** all-in / **~15 hrs** dark realtime
- Conservative (0.35 hrs/pt): **~37 hrs** all-in / **~36 hrs** dark realtime

---

## Phase 0 — Bootstrap (19 pts → ~2.85–6.65 hrs)

Goal: deployable empty Next.js app at `order.baybranchfarm.com` with Supabase, Playwright, and CI green.

| # | Task | Pts | Status |
|---|---|---|---|
| 0.1 | Init `bushel`, copy `seeds` → `.claude/`, `docs/`, fill placeholders | 3 | [x] <!-- completed 2026-05-03 in seeds session 15: copied skills/agents/settings, populated docs (SPEC, USER_STORIES, BRAND, AGENTS, VELOCITY_AND_POKER_GUIDE), wrote bushel CLAUDE.md, added DEC-023 (testing) + DEC-024 (PM workflow), created sessions/ dir --> |
| 0.2 | Next.js 16 + TS strict + sailbook-style CSS scaffold; Vercel project; CNAME for `order` | 3 | [#3](https://github.com/mobiustripper42/bushel/issues/3) |
| 0.3 | Supabase project; Google OAuth + customer token column | 2 | [#4](https://github.com/mobiustripper42/bushel/issues/4) |
| 0.5 | Test scaffolding: Playwright (3-device), `tests/helpers.ts`, pgTAP harness, `supabase/seed.sql` with test users | 3 | [#5](https://github.com/mobiustripper42/bushel/issues/5) |
| 0.6 | GitHub Actions CI: Supabase Docker, `playwright test`, `supabase test db` (from-scratch; high-priority `seeds` backport) | 5 | [#6](https://github.com/mobiustripper42/bushel/issues/6) |
| 0.7 | `BRAND.md` filled, B2B-warm voice rules, color/type matched to baybranchfarm.com, `ui-reviewer` agent customized | 3 | [#7](https://github.com/mobiustripper42/bushel/issues/7) |

---

## Phase 1 — Data model + admin shell (16 pts → ~2.4–5.6 hrs)

| # | Task | Pts | Status |
|---|---|---|---|
| 1.1a | Schema design (sketched in plan; finalize tweaks) | 3 | TBD |
| 1.1b | Schema migrations + indexes (`products`, `customers`, `orders` w/ `needs_reconciliation`, `order_items`, `pickup_windows`, `ordering_schedule`) | 5 | TBD |
| 1.2 | RLS policies + pgTAP tests; service-role-as-gate, RLS-as-backstop | 3 | TBD |
| 1.3 | Admin route group; Google OAuth flow; admin guard middleware | 3 | TBD |
| 1.4 | Empty admin shell with nav; auth-required Playwright spec | 2 | TBD |

---

## Phase 2 — Inventory editing (7 pts → ~1.05–2.45 hrs)

| # | Task | Pts | Status |
|---|---|---|---|
| 2.1 | Inventory editor (spreadsheet-style row form); Playwright spec rolled in | 5 | TBD |
| 2.2 | "Pre-populate from last week" action (simple reset, no snapshots in v1) | 2 | TBD |

---

## Phase 3 — Customer management + tokens (11 pts → ~1.65–3.85 hrs)

| # | Task | Pts | Status |
|---|---|---|---|
| 3.1 | Manual customer CRUD UI (admin); email/phone OR validation | 3 | TBD |
| 3.2 | Token generation, durable per-customer URL, regenerate button + thorough testing | 5 | TBD |
| 3.3 | `/c/[token]` route validates token, sets cookie, identifies customer; thorough session testing | 3 | TBD |

---

## Phase 4 — Public ordering (24 pts all-in / 19 pts with 4c.1 dark → ~3.6–8.4 hrs)

| # | Task | Pts | Status |
|---|---|---|---|
| 4a.1 | Customer inventory page; order form (running total, qty steppers, delivery/pickup toggle, address pre-fill, pickup window picker) | 8 | TBD |
| 4a.2 | Optimistic order placement: insert + decrement (allow negative), set `needs_reconciliation` flag if oversold | 3 | TBD |
| 4b.1 | Open/close toggle + scheduled cutoff + "open for N hours" override; Vercel Cron + TZ math | 5 | TBD (pending PO discussion) |
| 4b.2 | Closed/sold-out states; Playwright specs (golden, closed-mid-order race, oversold-flags-for-admin) | 3 | TBD |
| 4c.1 | Realtime inventory subscription, behind `NEXT_PUBLIC_REALTIME_INVENTORY` flag, ship-or-skip at end of Phase 4 | 5 | TBD |

---

## Phase 5 — Notifications (12 pts → ~1.8–4.2 hrs)

SMS-only in v1 (DEC-020). Resend dropped.

| # | Task | Pts | Status |
|---|---|---|---|
| 5.2 | SMS templates (weekly update, order confirmation, pickup reminder) via Twilio | 3 | TBD |
| 5.3 | Send flow with preview + dispatch + history log | 3 | TBD |
| 5.4 | Order confirmation + admin SMS alert: auto-send on order create | 2 | TBD |
| 5.5 | Pickup reminder Vercel Cron: morning-of dispatch | 2 | TBD |
| 5.6 | Playwright spec covering preview + send (boundary-mocked outbound) | 2 | TBD |

---

## Phase 6 — Order management (8 pts → ~1.2–2.8 hrs)

| # | Task | Pts | Status |
|---|---|---|---|
| 6.1 | Order list (column sort + week filter); status update UI; `needs_reconciliation` rows highlighted regardless of sort | 3 | TBD |
| 6.2 | Export to Wave: CSV download + copy-to-clipboard (TSV) | 3 | TBD |
| 6.3 | Playwright spec: status transitions + export (clipboard read) | 2 | TBD |

---

## Phase 7 — Polish + go-live (10 pts → ~1.5–3.5 hrs)

| # | Task | Pts | Status |
|---|---|---|---|
| 7.1 | Customer-side responsive sweep + brand polish + `ui-reviewer` pass + optional Claude design tooling pass | 5 | TBD |
| 7.2 | Production env: Vercel env vars, Twilio toll-free verified, DNS for `order` confirmed, secrets | 2 | TBD |
| 7.3 | UAT with Annabel; final fixes; structural issues defer to Phase 8+ | 3 | TBD |

---

## Phase 8+ (deferred / optional)

- Wave API direct integration
- Per-customer pricing
- Public signup for individuals
- Self-serve order edits/cancellations
- Per-customer reminder preferences (incl. expanding `notification_preference` to email)
- **Minimum delivery amount** (dollar threshold) — product owner discussion item
- Delivery fee logic
- Order history page for repeat customers
- Strict-decrement / hard rejection (only if optimistic causes real pain)
- Realtime inventory subscription (if 4c.1 shipped dark)
- Weekly inventory snapshots / history

---

## `seeds` Backports (track via `/sync-config`)

1. **Test scaffolding** — Playwright config, pgTAP layout, `supabase/seed.sql`, GitHub Actions workflow. Coordinate with parallel session.
2. **Tech-stack DECISIONS.md template entry** — make stack call explicit on day one.
3. **`BRAND.md` fields the `ui-reviewer` agent expects.**
4. **Phase 0 recipe** — concrete Next.js + Supabase bootstrap steps.
5. **`domain/` stub** — flesh out or remove.

---

## Open Questions (pending product-owner discussion)

- **Minimum delivery amount (dollars):** threshold for delivery, or free-delivery cutoff? Phase 8+ candidate.
- **No open/close time?** Drop the toggle entirely (always open)? Major scope reduction — eliminates 4b.1 (~5 pts) and most of 4b.2. Needs deeper discussion before committing.
- Specific Sun/Mon send time → Annabel fills in once cadence stabilizes
- Specific four pickup window times → Annabel fills in
- Final SMS copy → drafted in Phase 5 with feedback in preview UI
- sailbook's exact CSS approach → confirm at start of Phase 0 (DEC-021)
- GitHub Actions CI scope → revisit in Phase 7
- Split admin into `admin.baybranchfarm.com` if surface grows → revisit at end of Phase 4
- Realtime live or dark → decide at end of Phase 4
