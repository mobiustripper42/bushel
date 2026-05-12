-- Dev seed data. Applied by `supabase db reset`. Not for production.

insert into public.customers (name, token) values
  ('Test Farm Stand',  'testtoken-farmstand-0001'),
  ('Test Restaurant',  'testtoken-restaurant-0001')
on conflict (token) do nothing;

insert into public.products (id, name, unit, price_cents, qty_available, is_available, sort_order) values
  ('cccccccc-0000-0000-0000-000000000001'::uuid, 'Kale',  'bunch',  300,  10, true, 1),
  ('cccccccc-0000-0000-0000-000000000002'::uuid, 'Eggs',  'dozen',  600,   5, true, 2),
  ('cccccccc-0000-0000-0000-000000000003'::uuid, 'Honey', 'jar',   1200,   8, true, 3)
on conflict (id) do nothing;
