# bushel — Architectural Decisions

Locked during planning + poker. New decisions append. Superseded notes stay.

---

## Index

### Stack, platform & environments
- DEC-001 — Stack
- DEC-002 — Domain
- DEC-025 — Dev server access pattern
- DEC-046 — Off Supabase to Neon; `pg` + hand-rolled SQL migration runner
- DEC-049 — Environment model: Neon branches replace the two-project split; prod-write protection via connection-string discipline
- DEC-050 — Expo native app: muster rehearsal, push-first, thin scope
- DEC-052 — bushel-mobile is an independent seeds project; a phase never spans repos

### Auth & access boundary
- DEC-003 — Admin auth
- DEC-004 — Customer auth
- DEC-005 — Token reset
- DEC-006 — Customer onboarding
- DEC-047 — Admin auth: email → login code + self-rolled HMAC session via Resend (drops Google OAuth / Supabase Auth)
- DEC-048 — RLS deleted; the service layer IS the access boundary (formalizes existing reality; untangles auth.users) _(amended by DEC-051 — the pgTAP disposition only — the RLS-deleted, service-layer-is-the-boundary holding stands)_

### Catalog, pricing & units
- DEC-007 — Pricing
- DEC-031 — Sold-out display: per-item disabled at qty=0; page-level empty state when all visible items are sold out
- DEC-032 — Multi-unit products in V1.5 (per-unit pricing; inventory in base units)
- DEC-037 — `product_units` strictly authoritative; mirror columns dropped (#212, closes the DEC-032 transition)
- DEC-038 — Base-unit change is an atomic, invariant-preserving rebase (#208)
- DEC-043 — Per-unit editable SKU; `description` leaves the Wave export

### Ordering, orders & statuses
- DEC-010 — Order statuses _(amended by DEC-035 — adds the Confirmed status; the rest of the status set stands)_
- DEC-012 — Order placement: optimistic
- DEC-015 — Order edits/cancellations
- DEC-035 — "Confirmed" order status (amends DEC-010)
- DEC-036 — Optimistic oversell (DEC-012) does not extend to qty=0 (#132)
- DEC-039 — Additive orders: append to the week's single order (#211)
- DEC-041 — Order identity is the open order, not the week
- DEC-042 — Open-order edits: additive, terminal-only lock; send-state stays weekly
- DEC-044 — Canonicalize `order_status` to snake_case (`picked_up`) — BUG

### Store hours & availability
- DEC-011 — Ordering window _(amended by DEC-030 — the is_open default flips false to true; the window mechanism stands)_
- DEC-030 — Default mode: always open, manually closed; scheduled close opt-in _(amended by DEC-040 — the scheduled-close cron is disabled; always-open stands)_
- DEC-040 — Store is always-open; scheduled-close cron disabled (amends DEC-030)

### Fulfillment & invoicing
- DEC-008 — Fulfillment
- DEC-009 — No delivery zone validation; no delivery fee in v1
- ~~DEC-013 — Pickup windows~~ → superseded by DEC-029
- DEC-016 — Wave invoicing
- DEC-029 — Fulfillment is free-text per order; no structured pickup windows

### Notifications & alerting
- DEC-014 — Reminders
- ~~DEC-020 — Notifications channel: SMS-only in v1~~ → superseded by DEC-026 — the customer-outbound leg — operator-sent sms: deep links replace automated SMS; superseded by DEC-027 — the admin-alert leg — transactional email replaces SMS to the operator _(also amended by DEC-028 — the notification_preference column, dropped for customers.send_weekly_link)_
- DEC-026 — Customer outbound SMS: operator-sent native deep links
- ~~DEC-027 — Admin order-arrival alert: email primary, PWA push as upgrade~~ → superseded by DEC-033 — the channel — Telegram replaces email-first for the admin order-arrival alert
- DEC-028 — Customer send opt-in: send_weekly_link boolean (replaces notification_preference)
- DEC-033 — Admin order-arrival alert: Telegram bot (supersedes DEC-027 email-first) _(amended by DEC-047 — the rationale only — a mail provider now exists, but alerting does not move to email)_

### Admin surface & UI
- DEC-017 — Tone
- DEC-019 — Viewport scope _(amended by DEC-034 — admin gains a mobile-responsive requirement; the customer viewport scope stands)_
- DEC-021 — CSS approach
- DEC-022 — Order list filters
- DEC-034 — Admin is mobile-responsive (amends DEC-019)
- DEC-045 — Admin orders list keyed to the open-order model (follows DEC-041)

### Testing
- DEC-018 — Testing
- DEC-023 — Testing philosophy
- DEC-051 — Test stack: vitest (unit + pg-integration) + Playwright (E2E-only); pgTAP retired with Supabase

### Workflow & process
- DEC-024 — Project management workflow

_**This file is GENERATED** by `npm run gen:decisions` —
edit `docs/decisions/DEC-*.md`, not this file. `npm run check:decisions` fails on a stale index, a
duplicate id, an unknown topic, an unknown relation, a forward-pointing amendment, or a
reference to a decision that does not exist._
