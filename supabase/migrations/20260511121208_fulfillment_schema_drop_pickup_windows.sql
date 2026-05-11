-- DEC-029: replace structured pickup windows with free-text fulfillment fields
-- DEC-030: ordering window defaults open (was closed)

-- Drop FK before dropping the table
alter table public.orders drop column if exists pickup_window_id;

drop table if exists public.pickup_windows;

-- Free-text fulfillment fields (DEC-029)
alter table public.orders
  add column pickup_note        text,
  add column delivery_preference text;

-- Default ordering schedule to open (DEC-030)
alter table public.ordering_schedule
  alter column is_open set default true;

update public.ordering_schedule set is_open = true;
