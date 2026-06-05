begin;
select plan(3);

-- Seed prerequisites (bypass-RLS postgres role).
insert into public.customers (name, token) values ('Mode Test Farm', 'modetest-token-0001');

-- #193: delivery_reminder is now an accepted mode.
select lives_ok(
  $$ insert into public.customer_sends (customer_id, week_of, mode)
       select id, '2026-06-01', 'delivery_reminder' from public.customers where token = 'modetest-token-0001' $$,
  'customer_sends accepts mode = delivery_reminder'
);

-- The original pickup_reminder still works.
select lives_ok(
  $$ insert into public.customer_sends (customer_id, week_of, mode)
       select id, '2026-06-01', 'pickup_reminder' from public.customers where token = 'modetest-token-0001' $$,
  'customer_sends still accepts mode = pickup_reminder'
);

-- A bogus mode is still rejected by the CHECK.
select throws_ok(
  $$ insert into public.customer_sends (customer_id, week_of, mode)
       select id, '2026-06-01', 'carrier_pigeon' from public.customers where token = 'modetest-token-0001' $$,
  '23514',
  null,
  'customer_sends rejects an unknown mode'
);

select * from finish();
rollback;
