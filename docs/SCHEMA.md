# Bushel — Schema Design

Finalized in Phase 1.1a. Gates migrations (1.1b) and RLS policies (1.2).

---

## Tables

### `users`

Admin role flag. Mirrors `auth.users` via trigger; one row per authenticated user.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | | PK; FK → auth.users(id) ON DELETE CASCADE |
| is_admin | boolean | NOT NULL | false | |
| created_at | timestamptz | NOT NULL | now() | |

Indexes: none beyond PK.

---

### `codes`

Single lookup table for all configurable reference values. Replaces per-type lookup tables. No DB FK from referencing columns — app-enforced.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| type | text | NOT NULL | | e.g. `'fulfillment_type'`, `'order_status'` |
| code | text | NOT NULL | | slug e.g. `'delivery'`, `'new'` |
| label | text | NOT NULL | | Display name e.g. "Delivery", "New" |
| sort_order | integer | NULL | | |

PK: `(type, code)`.

Seed:

| type | code | label | sort_order |
|------|------|-------|------------|
| fulfillment_type | delivery | Delivery | 1 |
| fulfillment_type | pickup | Pickup | 2 |
| order_status | new | New | 1 |
| order_status | ready | Ready | 2 |
| order_status | picked_up | Picked Up | 3 |
| order_status | delivered | Delivered | 4 |

---

### `products`

Weekly product catalog. `qty_available` is decremented on order placement (DEC-012) and reset each week by admin (Phase 2.2).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| name | text | NOT NULL | | |
| description | text | NULL | | |
| unit | text | NOT NULL | | e.g. "lb", "bunch", "head" — defines qty denomination |
| price_cents | integer | NOT NULL | | Single price list (DEC-007) |
| qty_available | integer | NOT NULL | 0 | Decremented on order; reset weekly |
| is_available | boolean | NOT NULL | true | Hide without deleting |
| sort_order | integer | NULL | | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

Indexes: none beyond PK.

---

### `customers`

B2B customers. Authenticate via tokenized URL — no Supabase Auth account (DEC-004).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| name | text | NOT NULL | | Contact name |
| business_name | text | NULL | | Farm stand / restaurant name |
| phone | text | NULL | | E.164 format; required if notification_preference = 'sms' |
| email | text | NULL | | Reserved for v2 customer email channel (DEC-020 superseded; v1 admin alerts use a separate transactional address per DEC-027) |
| notification_preference | text | NOT NULL | 'sms' | CHECK IN ('sms', 'email', 'none') |
| token | text | NOT NULL | | Secure random; regeneratable (DEC-004, DEC-005) |
| delivery_address | text | NULL | | Fixed per customer; copied to order at placement (DEC-008) |
| is_active | boolean | NOT NULL | true | Soft-delete |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

Indexes:
- UNIQUE on `token` — hit on every `/c/[token]` page load.

---

### `pickup_windows` — REMOVED (DEC-029)

Originally specified by DEC-013 (4 fixed windows per week). Removed by DEC-029: fulfillment is free-text per order. Replacement: `orders.pickup_note` and `orders.delivery_preference` (see `orders` section below). Migration drops the table.

---

### `ordering_schedule`

Singleton config row (expect exactly 1). Controls live open/close state and weekly schedule (DEC-011). Phase 3.6 wires the cron logic that reads this and flips `is_open`.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| is_open | boolean | NOT NULL | true | Authoritative live toggle. Default `true` per DEC-030 — store is open until manually closed. |
| weekly_open_day | smallint | NULL | | 0 = Sun … 6 = Sat |
| weekly_open_time | time | NULL | | Phase 3.6 cron flips `is_open` on schedule |
| weekly_close_day | smallint | NULL | | |
| weekly_close_time | time | NULL | | |
| override_closes_at | timestamptz | NULL | | Set by "open for N hours"; cron clears + closes after |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

Indexes: none beyond PK.

---

### `orders`

One order per customer per week.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| customer_id | uuid | NOT NULL | | FK → customers(id) |
| week_of | date | NOT NULL | | Monday of the ISO week (`date_trunc('week', now())`) |
| fulfillment_type | text | NOT NULL | 'delivery' | codes(type='fulfillment_type'); app-enforced |
| pickup_note | text | NULL | | Free-text "When are you picking up?"; populated when fulfillment_type='pickup' (DEC-029). No prefill — starts empty every week. |
| delivery_preference | text | NULL | | Free-text "Delivery preference"; populated when fulfillment_type='delivery' (DEC-029). Customer order form pre-fills from this customer's most recent prior `delivery` order. |
| delivery_address | text | NULL | | Snapshot of customer address at order time |
| status | text | NOT NULL | 'new' | codes(type='order_status'); app-enforced |
| needs_reconciliation | boolean | NOT NULL | false | True if any item went oversold (DEC-012) |
| notes | text | NULL | | Customer notes to farm — optional textarea on order form |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

Indexes:
- `(customer_id)` — FK lookup
- `(week_of)` — admin week filter (Phase 5.1)
- `(needs_reconciliation) WHERE needs_reconciliation = true` — partial; admin reconciliation view

Constraints:
- UNIQUE `(customer_id, week_of)` — one order per customer per week

---

### `order_items`

Line items for an order. `qty` is integer; unit denomination is on `products.unit`. `unit_price_cents` is snapshotted at order time.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| order_id | uuid | NOT NULL | | FK → orders(id) ON DELETE CASCADE |
| product_id | uuid | NOT NULL | | FK → products(id) |
| qty | integer | NOT NULL | | Whole units; denomination via products.unit |
| unit_price_cents | integer | NOT NULL | | Snapshot of products.price_cents at order time |
| created_at | timestamptz | NOT NULL | now() | |

Indexes:
- `(order_id)` — most common access pattern
- `(product_id)` — oversell check / inventory queries

---

## Trade-offs

- **`qty` integer on order_items** — whole-unit ordering only. Works if Bay Branch sells in pre-packed denominations ("1 lb bag" × N). V1.5 (DEC-032) moves `products.qty_available` to `numeric(10,2)` for multi-unit support; `order_items.qty` stays integer (whole pints, whole flats).
- **No structured pickup windows** — DEC-029 removed `pickup_windows`. Fulfillment is free-text on the order: `pickup_note` (no prefill) and `delivery_preference` (prefilled from prior delivery order). Migration back to structured windows is reversible if customer count grows.
- **`notification_preference` text + CHECK** — retained flexible for a v2 customer email channel (placeholder; DEC-020 superseded by DEC-026/027 — v1 customer outbound is operator-sent SMS only). Could move into `codes` when email customer-side lands; CHECK constraint is sufficient for now.
- **`codes` table, no DB FK** — `orders.fulfillment_type` and `orders.status` reference `codes` by convention, app-enforced. Avoids composite FK ugliness on `orders`.
- **`ordering_schedule` is inert until Phase 3.6** — table shape is defined here; cron logic and open/close wiring land in Phase 3.6. Default `is_open = true` per DEC-030.
- **Multi-unit deferred to V1.5 (DEC-032)** — `products.unit` and `products.price_cents` remain in V1; V1.5 migration moves them into a child `product_units` table and converts `qty_available` to `numeric(10,2)`.
