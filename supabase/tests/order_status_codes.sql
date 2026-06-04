begin;
select plan(6);

-- #190 / DEC-035: confirmed inserted at ordinal 2; the rest renumber to 3/4/5.
select results_eq(
  $$ select code, sort_order from public.codes
       where type = 'order_status' order by sort_order $$,
  $$ values ('new', 1), ('confirmed', 2), ('ready', 3),
            ('picked_up', 4), ('delivered', 5) $$,
  'order_status codes: new,confirmed,ready,picked_up,delivered at ordinals 1..5'
);

select is(
  (select label from public.codes where type = 'order_status' and code = 'confirmed'),
  'Confirmed',
  'confirmed has label "Confirmed"'
);
select is((select sort_order from public.codes where type='order_status' and code='confirmed'), 2, 'confirmed = 2');
select is((select sort_order from public.codes where type='order_status' and code='ready'), 3, 'ready = 3');
select is((select sort_order from public.codes where type='order_status' and code='picked_up'), 4, 'picked_up = 4');
select is((select sort_order from public.codes where type='order_status' and code='delivered'), 5, 'delivered = 5');

select * from finish();
rollback;
