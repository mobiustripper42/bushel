# bushel — Project Plan

Bay Branch Farm Inventory & Order System. Replaces tend.com for ~7 B2B
customers (2 farm stands, 1 grocery store, 3–4 restaurants) on a weekly
Sun/Mon → Wed/Thu cadence.

See also:
- `docs/SPEC.md` — original product spec (TODO: port from HTML)
- `docs/DECISIONS.md` — architectural decisions (DEC-001…DEC-018)
- `docs/USER_STORIES.md` — flows A/B/C, B2B-reframed (TODO)
- `docs/BRAND.md` — voice, type, color (TODO)

---

## Velocity

| Sessions | Points completed | Hours | Hours/point |
|---|---|---|---|
| _none yet_ | — | — | — |

Fibonacci scale: 2, 3, 5, 8. No 1s (just do it). Avoid 13s (break down).

---

## Phase 0 — Bootstrap (~17 pts)

Goal: a deployable empty Next.js app at `order.baybranchfarm.com` with
Supabase, Playwright, and CI green.

| # | Task | Pts | Status |
|---|---|---|---|
| 0.1 | Init `bushel`, copy `seeds` → `.claude/`, `docs/`, fill placeholders | 3 | locked |
| 0.2 | Next.js 16 + TS strict + Tailwind scaffold; Vercel project | 3 | TBD |
| 0.3 | Supabase project; Google OAuth + custom token table | 2 | TBD |
| 0.4 | DNS: CNAME `order` → Vercel | (rolled into 0.2) | — |
| 0.5 | Test scaffolding: Playwright (3-device), `tests/helpers.ts`, pgTAP harness, `supabase/seed.sql` with test users | 3 | TBD |
| 0.6 | GitHub Actions CI: Supabase Docker, `playwright test`, `supabase test db` | 3 | TBD |
| 0.7 | `BRAND.md` filled; B2B-warm voice rules; color/type baseline matched to baybranchfarm.com | 3 | TBD |

---

## Phase 1 — Data model + admin shell (~12 pts)

| # | Task | Pts | Status |
|---|---|---|---|
| 1.1 | Schema migrations: `products`, `customers`, `orders`, `order_items`, `pickup_windows`, `ordering_schedule` | 5 | TBD |
| 1.2 | RLS policies + pgTAP tests for each table | 3 | TBD |
| 1.3 | Admin route group; Google OAuth flow; admin guard middleware | 2 | TBD |
| 1.4 | Empty admin shell with nav; auth-required Playwright spec | 2 | TBD |

---

## Phase 2 — Inventory editing (~8 pts)

| # | Task | Pts | Status |
|---|---|---|---|
| 2.1 | Inventory editor (spreadsheet-style row form): availability toggle, unit label, qty | 5 | TBD |
| 2.2 | "Pre-populate from last week" action | 2 | TBD |
| 2.3 | Playwright spec: edit inventory, toggle availability | (rolled into 2.1) | — |

---

## Phase 3 — Customer management + tokens (~8 pts)

| # | Task | Pts | Status |
|---|---|---|---|
| 3.1 | Manual customer CRUD UI (admin): email, phone, address, notification preference | 3 | TBD |
| 3.2 | Token generation, durable per-customer URL, regenerate button | 3 | TBD |
| 3.3 | `/c/[token]` route validates token, sets cookie, identifies customer | 2 | TBD |

---

## Phase 4 — Public ordering (~21 pts, split 4a/4b)

### Phase 4a (~13)
| # | Task | Pts | Status |
|---|---|---|---|
| 4a.1 | Customer inventory page; order form (running total, qty steppers, delivery/pickup toggle, address pre-fill, pickup window picker) | 8 | TBD |
| 4a.2 | Atomic decrement transaction; oversold-line rejection UX | 5 | TBD |

### Phase 4b (~8)
| # | Task | Pts | Status |
|---|---|---|---|
| 4b.1 | Open/close toggle + scheduled cutoff + "open for N hours" override | 5 | TBD |
| 4b.2 | Closed-state and sold-out states; Playwright specs (golden, race, closed-window) | 3 | TBD |

---

## Phase 5 — Notifications (~15 pts)

| # | Task | Pts | Status |
|---|---|---|---|
| 5.1 | Resend templates: weekly update, order confirmation, pickup reminder, admin alert | 3 | TBD |
| 5.2 | Twilio toll-free SMS variants of weekly update, order confirmation, pickup reminder | 3 | TBD |
| 5.3 | Weekly update send flow with preview, dispatch, history log | 3 | TBD |
| 5.4 | Order confirmation + admin alert: auto-send on order create | 2 | TBD |
| 5.5 | Pickup reminder Vercel Cron: morning-of dispatch | 2 | TBD |
| 5.6 | Playwright spec covering preview + send (boundary-mocked outbound) | 2 | TBD |

---

## Phase 6 — Order management (~7 pts)

| # | Task | Pts | Status |
|---|---|---|---|
| 6.1 | Order list + filters (status, week); status update UI | 3 | TBD |
| 6.2 | CSV export (download + clipboard) — Wave-compatible columns | 2 | TBD |
| 6.3 | Playwright spec: status transitions + export | 2 | TBD |

---

## Phase 7 — Polish + go-live (~9 pts)

| # | Task | Pts | Status |
|---|---|---|---|
| 7.1 | Mobile responsive sweep across all customer + admin surfaces | 3 | TBD |
| 7.2 | Brand polish: typography, color, voice review across emails/SMS/UI | 2 | TBD |
| 7.3 | Production env: secrets, Vercel env vars, Twilio toll-free verified, Resend domain auth | 2 | TBD |
| 7.4 | UAT with Annabel; final fixes | 2 | TBD |

---

## Phase 8+ (deferred / optional)

- Wave API direct integration
- Per-customer pricing
- Public signup for individuals
- Self-serve order edits/cancellations
- Per-customer reminder preferences
- Delivery fee logic
- Order history page for repeat customers

---

**v1 total: ~97 points across phases 0–7.**

---

## `seeds` Backports (track via `/sync-config`)

1. Test scaffolding (Playwright config template, pgTAP layout, `supabase/seed.sql`, GitHub Actions workflow). Another session is already in flight on this — coordinate at merge.
2. Tech-stack DECISIONS.md template entry — make the stack call explicit on day one.
3. BRAND.md fields the `ui-reviewer` agent expects.
4. Phase 0 recipe — concrete "Next.js + Supabase project bootstrap" steps.
5. `domain/` stub — flesh out for `bushel`'s domain logic or remove.

---

## Open / TBD

- Specific Sun/Mon send time → user fills in once cadence stabilizes
- Specific four pickup window times → user fills in
- Final SMS/email copy → drafted in Phase 5 with user feedback in preview UI
- Tailwind vs alternative CSS approach → confirm in Phase 0
- Whether to split admin into a separate Next.js app at `admin.baybranchfarm.com` if surface grows → revisit at end of Phase 4
