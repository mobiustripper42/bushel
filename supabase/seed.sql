-- Dev seed data. Applied by `supabase db reset`. Not for production.

insert into public.customers (name, token) values
  ('Test Farm Stand',  'testtoken-farmstand-0001'),
  ('Test Restaurant',  'testtoken-restaurant-0001')
on conflict (token) do nothing;
