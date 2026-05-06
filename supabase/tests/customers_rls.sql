begin;
select plan(10);

-- Schema sanity
select has_table('public', 'customers', 'customers table exists');
select col_is_pk('public', 'customers', 'id', 'id is the primary key');
select col_not_null('public', 'customers', 'name', 'name is not null');
select col_is_unique('public', 'customers', 'token', 'token is unique');
select col_not_null('public', 'customers', 'token', 'token is not null');

-- RLS is on
select is(
  (select relrowsecurity from pg_class where oid = 'public.customers'::regclass),
  true,
  'RLS is enabled on customers'
);

-- Seed one row as the postgres role (bypasses RLS)
insert into public.customers (name) values ('Test Farm Stand');

-- Anonymous cannot read
set local role anon;
select is_empty(
  $$ select id from public.customers $$,
  'anon cannot read customers'
);

-- Anonymous cannot insert
select throws_ok(
  $$ insert into public.customers (name) values ('sneaky') $$,
  '42501',
  'new row violates row-level security policy for table "customers"',
  'anon cannot insert into customers'
);

reset role;

-- Authenticated can read
set local role authenticated;
select isnt_empty(
  $$ select id from public.customers $$,
  'authenticated can read customers'
);

-- Authenticated can insert
select lives_ok(
  $$ insert into public.customers (name) values ('Authed Farm') $$,
  'authenticated can insert into customers'
);

reset role;

select * from finish();
rollback;
