begin;
select plan(16);

-- ============================================================
-- #208 (DEC-038) — set_base_unit RPC
--
-- Re-basing divides every unit's conversion_to_base AND the product's
-- qty_available (stored in base units) by the new base's old conversion,
-- atomically, then renumbers sort_order so the new base sorts first.
-- Verifies:
--   - the rescale lands the new base at exactly 1.0 and rescales the rest
--     (including inactive units) by the same factor
--   - qty_available rescales identically → historical order math
--     (qty * live conversion vs qty_available) is physically unchanged
--   - prices are untouched (per-unit truths don't depend on the base)
--   - the new base gets the smallest sort_order (customer default = units[0])
--   - raises on cross-product / inactive / missing units; no-op on the
--     current base
-- ============================================================

-- Fixture: Basil with base "bunch" (conv 1.0) + "lb" (conv 0.5 — one lb is
-- half a bunch's worth) + an INACTIVE "case" (conv 4). 10 bunches in stock.
-- DEC-037: unit rows are inserted explicitly (nothing spawns them).
insert into public.products (id, name, qty_available, sort_order, category)
values ('ee080000-0000-0000-0000-aaaa00000001'::uuid, 'Basil', 10.00, 1, 'Herbs');

insert into public.product_units (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
values
  ('ee080000-0000-0000-0000-bbbb00000001'::uuid,
   'ee080000-0000-0000-0000-aaaa00000001'::uuid,
   'bunch', 1, 350, true, 'basil-bunch-ee080000', 0),
  ('ee080000-0000-0000-0000-bbbb00000002'::uuid,
   'ee080000-0000-0000-0000-aaaa00000001'::uuid,
   'lb', 0.5, 600, true, 'basil-lb-ee080000', 1),
  ('ee080000-0000-0000-0000-bbbb00000003'::uuid,
   'ee080000-0000-0000-0000-aaaa00000001'::uuid,
   'case', 4, 2000, false, 'basil-case-ee080000', 2);

-- Second product whose unit must not be promotable onto Basil.
insert into public.products (id, name, qty_available, sort_order, category)
values ('ee080000-0000-0000-0000-aaaa00000002'::uuid, 'Mint', 5.00, 2, 'Herbs');

insert into public.product_units (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
values ('ee080000-0000-0000-0000-cccc00000001'::uuid,
        'ee080000-0000-0000-0000-aaaa00000002'::uuid,
        'bunch', 1, 250, true, 'mint-bunch-ee080000', 0);

-- Existing order line on the lb unit: 3 lb = 1.5 base (bunch) against stock
-- of 10. The physical footprint ratio (qty * conv) / qty_available = 0.15
-- must survive the rebase.
insert into public.customers (id, name, token)
values ('ee080000-0000-0000-0000-000000000001'::uuid, 'Rebase Customer', 'token-rebase-208');

insert into public.orders (id, customer_id, week_of, fulfillment_type, status)
values ('ee080000-0000-0000-0000-dddd00000001'::uuid,
        'ee080000-0000-0000-0000-000000000001'::uuid,
        '2026-06-01', 'pickup', 'new');

insert into public.order_items (order_id, product_id, product_unit_id, qty, unit_price_cents)
values ('ee080000-0000-0000-0000-dddd00000001'::uuid,
        'ee080000-0000-0000-0000-aaaa00000001'::uuid,
        'ee080000-0000-0000-0000-bbbb00000002'::uuid,
        3, 600);

-- ============================================================
-- 1. Guard rails: cross-product, missing, and inactive units raise.
-- ============================================================
select throws_like(
  $$ select public.set_base_unit(
       'ee080000-0000-0000-0000-aaaa00000001'::uuid,
       'ee080000-0000-0000-0000-cccc00000001'::uuid) $$,
  '%does not belong to product%',
  'unit belonging to another product is rejected'
);

select throws_like(
  $$ select public.set_base_unit(
       'ee080000-0000-0000-0000-aaaa00000001'::uuid,
       'ee080000-0000-0000-0000-feed00000099'::uuid) $$,
  '%does not belong to product%',
  'nonexistent unit id is rejected'
);

select throws_like(
  $$ select public.set_base_unit(
       'ee080000-0000-0000-0000-aaaa00000001'::uuid,
       'ee080000-0000-0000-0000-bbbb00000003'::uuid) $$,
  '%is inactive%',
  'inactive unit cannot become the base'
);

-- ============================================================
-- 2. No-op when the unit is already the base: nothing rescales.
-- ============================================================
select lives_ok(
  $$ select public.set_base_unit(
       'ee080000-0000-0000-0000-aaaa00000001'::uuid,
       'ee080000-0000-0000-0000-bbbb00000001'::uuid) $$,
  'promoting the current base is a no-op, not an error'
);

select is(
  (select conversion_to_base from public.product_units
   where id = 'ee080000-0000-0000-0000-bbbb00000002'::uuid),
  0.5000::numeric(10,4),
  'no-op left the lb conversion untouched'
);

select is(
  (select qty_available from public.products
   where id = 'ee080000-0000-0000-0000-aaaa00000001'::uuid),
  10.00::numeric(10,2),
  'no-op left qty_available untouched'
);

-- ============================================================
-- 3. The rebase: lb (conv 0.5) becomes the base. Every conversion and
--    qty_available divides by 0.5.
-- ============================================================
select lives_ok(
  $$ select public.set_base_unit(
       'ee080000-0000-0000-0000-aaaa00000001'::uuid,
       'ee080000-0000-0000-0000-bbbb00000002'::uuid) $$,
  'set_base_unit succeeds on an active non-base unit'
);

select is(
  (select conversion_to_base from public.product_units
   where id = 'ee080000-0000-0000-0000-bbbb00000002'::uuid),
  1.0000::numeric(10,4),
  'new base lands at exactly 1.0'
);

select is(
  (select conversion_to_base from public.product_units
   where id = 'ee080000-0000-0000-0000-bbbb00000001'::uuid),
  2.0000::numeric(10,4),
  'old base rescales: one bunch is now 2 lb-units (1 / 0.5)'
);

select is(
  (select conversion_to_base from public.product_units
   where id = 'ee080000-0000-0000-0000-bbbb00000003'::uuid),
  8.0000::numeric(10,4),
  'inactive unit rescales too (4 / 0.5 = 8)'
);

select is(
  (select count(*)::int from public.product_units
   where product_id = 'ee080000-0000-0000-0000-aaaa00000001'::uuid
     and conversion_to_base = 1),
  1,
  'exactly one base unit after the rebase (saveInventory invariant holds)'
);

select is(
  (select qty_available from public.products
   where id = 'ee080000-0000-0000-0000-aaaa00000001'::uuid),
  20.00::numeric(10,2),
  'qty_available rescales by the same factor (10 / 0.5 = 20)'
);

-- ============================================================
-- 4. New base sorts first; the rest keep their display order.
--    Customer default = units[0] sorted by (sort_order nulls last, created_at).
-- ============================================================
select is(
  (select array_agg(label order by sort_order, created_at)
   from public.product_units
   where product_id = 'ee080000-0000-0000-0000-aaaa00000001'::uuid),
  array['lb', 'bunch', 'case'],
  'sort_order renumbered: new base first, others in prior display order'
);

-- ============================================================
-- 5. Prices are per-unit and must NOT change.
-- ============================================================
select is(
  (select array_agg(unit_price_cents order by label)
   from public.product_units
   where product_id = 'ee080000-0000-0000-0000-aaaa00000001'::uuid),
  array[350, 2000, 600],  -- bunch, case, lb
  'unit prices untouched by the rebase'
);

-- ============================================================
-- 6. Order-math invariance: the historical line's physical footprint
--    relative to stock is unchanged. Before: 3 * 0.5 / 10 = 0.15.
--    After: 3 * 1.0 / 20 = 0.15.
-- ============================================================
select is(
  (select (oi.qty * pu.conversion_to_base) / p.qty_available
   from public.order_items oi
   join public.product_units pu on pu.id = oi.product_unit_id
   join public.products p on p.id = oi.product_id
   where oi.order_id = 'ee080000-0000-0000-0000-dddd00000001'::uuid),
  0.15::numeric,
  'order line footprint ratio (qty * live conv / qty_available) is unchanged'
);

select is(
  (select row(oi.qty, oi.unit_price_cents)::text
   from public.order_items oi
   where oi.order_id = 'ee080000-0000-0000-0000-dddd00000001'::uuid),
  '(3,600)',
  'order line qty + snapshotted price untouched by the rebase'
);

select * from finish();
rollback;
