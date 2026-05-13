begin;
select plan(16);

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
insert into public.customers (name, token) values ('Test Farm Stand', 'test-token-postgres-001');

-- Anonymous cannot read
set local role anon;
select is_empty(
  $$ select id from public.customers $$,
  'anon cannot read customers'
);

-- Anonymous cannot insert (token must be supplied so RLS fires, not the NOT NULL constraint)
select throws_ok(
  $$ insert into public.customers (name, token) values ('sneaky', 'sneaky-token-anon-001') $$,
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
  $$ insert into public.customers (name, token) values ('Authed Farm', 'test-token-auth-001') $$,
  'authenticated can insert into customers'
);

reset role;

-- Token uniqueness on insert (duplicate token rejected)
select throws_ok(
  $$ insert into public.customers (name, token) values ('Dup Farm', 'test-token-postgres-001') $$,
  '23505',
  null,
  'duplicate token on insert is rejected'
);

-- Token rotation: update changes the value; old token no longer matches; new token matches
update public.customers
   set token = 'rotated-token-001'
 where token = 'test-token-postgres-001';

select is_empty(
  $$ select 1 from public.customers where token = 'test-token-postgres-001' $$,
  'after rotation, old token no longer matches any row'
);

select isnt_empty(
  $$ select 1 from public.customers where token = 'rotated-token-001' $$,
  'after rotation, new token resolves to the customer'
);

-- Anon still cannot read after rotation (regression guard)
set local role anon;
select is_empty(
  $$ select id from public.customers where token = 'rotated-token-001' $$,
  'anon cannot read customer by token (RLS still blocks)'
);
reset role;

-- Authenticated path: rotation through RLS-permitted UPDATE and UPDATE-uniqueness.
-- Seeds 'Authed Farm' (test-token-auth-001) and the rotated 'rotated-token-001'
-- already exist as authenticated-side and postgres-side rows.
set local role authenticated;

select lives_ok(
  $$ update public.customers set token = 'authed-rotated-001' where token = 'test-token-auth-001' $$,
  'authenticated can rotate a customer token (UPDATE permitted by RLS)'
);

select throws_ok(
  $$ update public.customers set token = 'rotated-token-001' where token = 'authed-rotated-001' $$,
  '23505',
  null,
  'authenticated UPDATE rejects collision with existing token'
);

reset role;

select * from finish();
rollback;
