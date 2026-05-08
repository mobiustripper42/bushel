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

Fibonacci scale: 2, 3, 5, 8. No 1s. Avoid 13s (break down).

---

## v1 Total

- **108 pts all-in** (with realtime live)
- **103 pts** with 3.8 (realtime) shipped behind a dark flag

**Time projection:**
- Best case (0.15 hrs/pt): **~16.2 hrs** all-in / **~15.5 hrs** dark realtime
- Conservative (0.35 hrs/pt): **~37.8 hrs** all-in / **~36 hrs** dark realtime

**Re-baselined 2026-05-08:** SMS pivot (DEC-026/027) reshaped the notifications phase from a 12pt Twilio-integration phase into the new 11pt Phase 4 (deep-link + email), removing the multi-week carrier-approval risk from the critical path. The prior Phase 3 (customers + tokens) and Phase 4 (public ordering) were combined into a single customer-side Phase 3, with a new 3.0 priority-column migration. Phases 6 and 7 renumbered to 5 and 6. Net: +1 pt, materially less schedule risk.

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
| 1.1a | Schema design (sketched in plan; finalize tweaks) | 3 | [#16](https://github.com/mobiustripper42/bushel/issues/16) |
| 1.1b | Schema migrations + indexes (`products`, `customers`, `orders` w/ `needs_reconciliation`, `order_items`, `pickup_windows`, `ordering_schedule`) | 5 | [#17](https://github.com/mobiustripper42/bushel/issues/17) |
| 1.2 | RLS policies + pgTAP tests; service-role-as-gate, RLS-as-backstop | 3 | [#18](https://github.com/mobiustripper42/bushel/issues/18) |
| 1.3 | Admin route group; Google OAuth flow; admin guard middleware | 3 | [#19](https://github.com/mobiustripper42/bushel/issues/19) |
| 1.4 | Empty admin shell with nav; auth-required Playwright spec | 2 | [#20](https://github.com/mobiustripper42/bushel/issues/20) |

---

## Phase 2 — Inventory editing (7 pts → ~1.05–2.45 hrs)

| # | Task | Pts | Status |
|---|---|---|---|
| 2.1 | Inventory editor (spreadsheet-style row form); Playwright spec rolled in | 5 | TBD |
| 2.2 | "Pre-populate from last week" action (simple reset, no snapshots in v1) | 2 | TBD |

---

## Phase 3 — Customer side (37 pts all-in / 32 pts with 3.8 dark → ~5.55–12.95 hrs)

Customer management, tokenized URL access, and the public ordering experience. Combined from the prior Phase 3 (customers + tokens, 11 pts) and Phase 4 (public ordering, 24 pts), plus a new 3.0 priority-column migration. Both prior phases were small and coherent as one customer-side surface.

| # | Task | Pts | Status |
|---|---|---|---|
| 3.0 | Customer `priority` column migration + types regenerated | 2 | TBD |
| 3.1 | Manual customer CRUD UI (admin); priority field; email/phone OR validation | 3 | TBD |
| 3.2 | Token generation, durable per-customer URL, regenerate button + thorough testing | 5 | TBD |
| 3.3 | `/c/[token]` route validates token, sets cookie, identifies customer; thorough session testing | 3 | TBD |
| 3.4 | Customer inventory page; order form (running total, qty steppers, delivery/pickup toggle, address pre-fill, pickup window picker) | 8 | TBD |
| 3.5 | Optimistic order placement: insert + decrement (allow negative), set `needs_reconciliation` flag if oversold | 3 | TBD |
| 3.6 | Open/close toggle + scheduled cutoff + "open for N hours" override; Vercel Cron + TZ math | 5 | TBD (pending PO discussion) |
| 3.7 | Closed/sold-out states; Playwright specs (golden, closed-mid-order race, oversold-flags-for-admin) | 3 | TBD |
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
- **No open/close time?** Drop the toggle entirely (always open)? Major scope reduction — eliminates 3.6 (~5 pts) and most of 3.7. Needs deeper discussion before committing.
- Specific Sun/Mon send time → Annabel fills in once cadence stabilizes
- Specific four pickup window times → Annabel fills in
- Final SMS copy → drafted in Phase 4 with feedback in preview UI
- sailbook's exact CSS approach → confirm at start of Phase 0 (DEC-021)
- GitHub Actions CI scope → revisit in Phase 6
- Split admin into `admin.baybranchfarm.com` if surface grows → revisit at end of Phase 3
- Realtime live or dark → decide at end of Phase 3
