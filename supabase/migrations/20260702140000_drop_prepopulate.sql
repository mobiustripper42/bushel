-- #248 — remove "Pre-populate from last week" entirely.
--
-- The feature was week-keyed by construction: copy last week's inventory
-- forward at the top of a new order week. DEC-040 (always-open) + DEC-041
-- (order identity is the open order; week_of demoted to a stamp) removed
-- the "new week" moment it existed for — Annabel edits live inventory now,
-- and the demand-aware rethink already died once (PR #220, closed).
--
-- The UI button, server action, Playwright spec, and pgTAP file went in the
-- same PR; this drops the last piece. The four historical prepopulate
-- migrations stay — they're applied history.

drop function if exists public.prepopulate_inventory_from_last_week();
