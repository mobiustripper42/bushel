# Bushel — Product Specification

> **Status:** First-pass port from `docs/review/spec-for-annabel.html` + `DECISIONS.md` + `PROJECT_PLAN.md`. Pending review by Eric.

## Overview

Bushel is Bay Branch Farm's weekly inventory and ordering system. It replaces tend.com for ~7 wholesale customers — two farm stands, one grocery store, three or four restaurants — and runs at `order.baybranchfarm.com`. The marketing site at `baybranchfarm.com` stays on Astro/Netlify, untouched.

The app is built around the existing weekly rhythm: post what's available Sun/Mon, customers order through the week, deliveries and pickups happen Wed/Thu. Bushel makes each step less manual without changing the cadence.

## Philosophy

**Vegetables to friends, not heart medicine.** Optimistic over strict. The app should feel like the existing workflow's nicer cousin, not a system that polices either side. When two customers grab the last of something, both orders land and Annabel reconciles by text. When a customer mistypes "midnight Tuesday" as a pickup time, Annabel reads it and reacts. The right friction lives in the human relationship, not the database constraint.

What Bushel is **not**: a SaaS platform for hundreds of customers, a payments processor, a CRM, a delivery routing system, a customer-facing account-management tool. Anything that smells like "scale to thousands" is the wrong instinct.

## Target Launch

- **V1 target:** Phase 6 close — see `PROJECT_PLAN.md` for sized phases (currently 106 pts all-in / 101 pts with realtime dark-flagged; ~16–37 hrs at sailbook velocity).
- **V1 critical path:** customer-side ordering live, weekly SMS deep-link send-queue working on Annabel's phone, admin order-arrival email firing, Wave CSV export functional.
- **V1.5 (Phase 6.5):** multi-unit products (DEC-032). Sized as a focused 15-pt follow-up; contingent on Annabel confirming how many V1 products genuinely need multi-unit denominations.

## Stack

- **Frontend:** Next.js 16 (App Router), TypeScript strict, sailbook-style CSS in `src/styles/app.css` (DEC-021). No Tailwind in customer/admin pages.
- **Backend:** Supabase (PostgreSQL + Auth + Row Level Security). No separate API server.
- **Notifications:**
  - Customer outbound: operator-sent SMS via native `sms:` deep links — no third-party SMS provider (DEC-026).
  - Admin order-arrival alert: transactional email (DEC-027); PWA push as stretch upgrade.
- **Hosting:** Vercel (frontend), Supabase Cloud (database).
- **Domain:** `order.baybranchfarm.com` (CNAME → Vercel); apex stays Astro/Netlify.
- **Dev environment:** Local Supabase via Docker; dev server reachable at `http://mill-dev:3001` over Tailscale (DEC-025).
- **Testing:** pgTAP (RLS), Playwright (integration; mobile/tablet/desktop), axe-core (a11y). Heavy integration, light unit (DEC-023).

## Roles

- **Admin** — Annabel. One person. Manages inventory weekly, customers as needed, watches orders land, sends weekly text + reminders + confirmations from her phone, reconciles oversells, exports to Wave for invoicing.
- **B2B customer** — buyer at a farm stand, the grocery store buyer, restaurant chefs. Receives a weekly SMS with their personal link, taps through, places an order on their phone. No login, no password, no app to install.

## Core Concepts

- **Tokenized customer URL** — every customer has a durable, regeneratable token; their order page lives at `/c/<token>`. Authentication is the URL itself (DEC-004). Sharable in practice; risk is bounded by who customers SMS-forward to.
- **Operator-sent SMS** — Bushel does not send customer SMS. The send-queue page generates `sms:` URIs and surfaces per-customer "Send" buttons; the operator's native Messages app opens with the recipient + body pre-filled, she taps Send. ~21 messages/week sits inside the P2P regulatory perimeter (DEC-026). Trip-wire to revisit: ~50/week.
- **Optimistic order placement** — orders + decrements run in a transaction; quantities can go negative; `orders.needs_reconciliation` flag fires on oversold lines and the row gets highlighted in admin (DEC-012).
- **Free-text fulfillment** — `orders.pickup_note` and `orders.delivery_preference` replace structured pickup windows (DEC-029). Delivery preference pre-fills from the customer's most recent prior delivery order; pickup note starts empty each week. At 7 customers, prose beats a picker.
- **Weekly cycle** — orders are scoped to a week (`orders.week_of date`, Monday of the ISO week). One order per customer per week. Inventory is reset/refreshed each Sun/Mon by Annabel using "Pre-fill from last week."
- **Send-queue priority** — `customers.priority` orders the weekly send list. Lower goes first; 100 is the neutral default. Annabel sets priority customers to receive the week's link before others.
- **Always-open by default** — `ordering_schedule.is_open` defaults to `true` (DEC-030). The practical traffic gate is whether Annabel sent the weekly SMS, not the toggle. Manual close is for explicit refuse-orders moments (vacation, broken equipment).

## V1 Scope

### Phase 0 — Bootstrap
Empty deployable Next.js app at `order.baybranchfarm.com`, Supabase wired with Google OAuth + customer token column, Playwright + pgTAP test scaffolding, GitHub Actions CI, BRAND.md filled, `ui-reviewer` agent customized.

### Phase 1 — Data model + admin shell
Schema design + migrations (`products`, `customers`, `orders`, `order_items`, `ordering_schedule`); RLS policies with pgTAP tests; admin route group with Google OAuth flow; empty admin shell with nav.

### Phase 2 — Inventory editing
Spreadsheet-style inventory editor (one row per item; qty/unit/price; dirty state + sticky save bar); "Pre-fill from last week" action.

### Phase 3 — Customer side
Customer CRUD with priority; durable tokens + admin Regenerate; `/c/[token]` route validates + sets cookie; customer inventory page + order form (running total, delivery/pickup toggle, address pre-fill, free-text pickup-note OR delivery-preference, optional notes); optimistic order placement with `needs_reconciliation`; manual open/close toggle + optional scheduled cutoff; closed/sold-out states (DEC-031); realtime inventory subscription (dark-flagged, ship-or-skip).

### Phase 4 — Notifications
`sms:` deep-link builder; send-queue page with weekly-update / order-confirmation / pickup-reminder modes ordered by priority + per-customer Send button + mark-as-sent state; transactional email for order-arrival admin alert. Stretch: PWA push for the order-arrival alert.

### Phase 5 — Order management
Order list (column sort + week filter; oversold rows always highlighted); status update UI; Wave CSV export (download + clipboard TSV).

### Phase 6 — Polish + go-live
Customer-side responsive sweep + brand polish + `ui-reviewer` pass; production env (Vercel env vars, transactional email service configured, DNS); UAT with Annabel.

### Phase 6.5 — V1.5: Multi-unit products
Per-product unit denominations (lb, pint, flat) with per-unit pricing; inventory tracked in base units; customer picks unit at order; conversion at decrement (DEC-032). Independent of per-customer pricing (DEC-007 still defers that to V2).

## Not V1

This is the scope guardrail. Check before adding anything.

- **Payments / invoicing** — Wave still bills. Bushel exports the order list.
- **Public signup** — wholesale-only is the product, not a V1 limitation. Never building.
- **Per-customer pricing** — single price list (DEC-007). Phase 7 backlog (#137).
- **Customer-side order edits / cancellations** — text Annabel (DEC-015). Phase 7 candidate (no issue yet).
- **Order history for customers** — current week only in V1. Phase 7 (#136).
- **Customer email channel** — customers get SMS only; the order-arrival email is admin-only (DEC-027).
- **Delivery fees / minimum order** — Phase 7 (#138 minimum delivery; fee logic separate).
- **Delivery zone validation** — customer list is the implicit zone (DEC-009).
- **Inventory snapshots / week-by-week comparisons** — "Pre-fill from last week" is the only history.
- **Wave API direct integration** — not building. CSV/TSV is the workflow (DEC-016); eric is switching off Wave in October.
- **Strict rejection on oversell** — optimistic stays. May stay forever (DEC-012). Phase 7+ if it ever causes real pain.
- **Bushel-branded SMS sender ID** — operator's personal number is the sender. A2P registration is the trip-wire at ~50 messages/week (DEC-026).
- **Per-customer reminder preferences (incl. expanding to email)** — single channel in V1.
- **PWA "next-customer nudge" during send batches** — depends on PWA push proving reliable for the order-arrival alert first.
- **Multi-unit products** — V1.5 (Phase 6.5), unless Annabel confirms most products need it (DEC-032).
