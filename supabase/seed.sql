-- Dev seed data. Applied by `supabase db reset`. Not for production.

insert into public.customers (name, token) values
  ('Test Farm Stand',  'testtoken-farmstand-0001'),
  ('Test Restaurant',  'testtoken-restaurant-0001')
on conflict (token) do nothing;

insert into public.products (id, name, qty_available, is_available, sort_order) values
  ('cccccccc-0000-0000-0000-000000000001'::uuid, 'Kale',   10, true, 1),
  ('cccccccc-0000-0000-0000-000000000002'::uuid, 'Eggs',    5, true, 2),
  ('cccccccc-0000-0000-0000-000000000003'::uuid, 'Honey',   8, true, 3)
on conflict (id) do nothing;

-- DEC-037: products no longer carry unit/price columns and nothing auto-spawns
-- a base unit row — every product fixture seeds its base product_units row
-- (conversion_to_base = 1.0) explicitly. Slug format matches saveInventory:
-- <name-slug>-<first 8 chars of product id>.
insert into public.product_units (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order) values
  ('cccccccc-1111-0000-0000-000000000001'::uuid, 'cccccccc-0000-0000-0000-000000000001'::uuid, 'bunch', 1.0,  300, true, 'kale-cccccccc',  0),
  ('cccccccc-1111-0000-0000-000000000002'::uuid, 'cccccccc-0000-0000-0000-000000000002'::uuid, 'dozen', 1.0,  600, true, 'eggs-cccccccc',  0),
  ('cccccccc-1111-0000-0000-000000000003'::uuid, 'cccccccc-0000-0000-0000-000000000003'::uuid, 'jar',   1.0, 1200, true, 'honey-cccccccc', 0)
on conflict (id) do nothing;
