-- customers.priority — send-queue ordering for the weekly SMS link (DEC-026/027).
-- Lower number sends earlier; 100 is a neutral default so existing rows
-- and new customers without a strong preference all sit at the same rank.
-- Not-null + default means the send-queue ORDER BY priority never needs
-- to think about NULLs.

alter table public.customers
  add column priority integer not null default 100
  check (priority >= 0);

comment on column public.customers.priority is
  'Send-queue ordering (DEC-026/027). Lower = earlier in the cycle. Default 100.';
