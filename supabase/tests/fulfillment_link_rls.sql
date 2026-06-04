begin;
select plan(7);

-- Schema sanity
select has_table('public', 'fulfillment_link', 'fulfillment_link table exists');
select col_is_pk('public', 'fulfillment_link', 'id', 'id is the primary key');
select col_not_null('public', 'fulfillment_link', 'token', 'token is not null');
select col_is_unique('public', 'fulfillment_link', 'token', 'token is unique');

-- RLS is on
select is(
  (select relrowsecurity from pg_class where oid = 'public.fulfillment_link'::regclass),
  true,
  'RLS is enabled on fulfillment_link'
);

-- The migration seeds exactly one row; it exists as the bypass-RLS postgres role.

-- Anonymous cannot read the token (no anon policy at all)
set local role anon;
select is_empty(
  $$ select token from public.fulfillment_link $$,
  'anon cannot read fulfillment_link'
);
reset role;

-- Authenticated (admin) can read
set local role authenticated;
select isnt_empty(
  $$ select token from public.fulfillment_link $$,
  'authenticated can read fulfillment_link'
);
reset role;

select * from finish();
rollback;
