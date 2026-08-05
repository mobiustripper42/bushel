---
id: DEC-046
title: "Off Supabase to Neon; `pg` + hand-rolled SQL migration runner"
topic: "Stack, platform & environments"
---

## DEC-046: Off Supabase to Neon; `pg` + hand-rolled SQL migration runner

**Decision:** Bushel moves Postgres from Supabase Cloud to Neon (free tier). Data access is `pg` (node-postgres) `Pool` via `DATABASE_URL` — no ORM, no query builder. Migrations are plain SQL files `db/migrations/NNNN_name.sql` applied by a ~70-line runner ported from muster (`db/migrate.ts`: `_migrations` tracking table, each file in its own transaction). Local + CI test against docker Postgres; Neon hosts dev/preview + prod only.

**Why:** Consolidates billing off Supabase; aligns bushel with muster (same stack, one maintenance surface for a solo dev); muster already runs this on Neon, so it's a proven path, not a spike. `pg` + plain SQL clears the dependency bar where Drizzle/Prisma do not — the queries are hand-written already and "migrations are source of truth" stays literally true.

**Rejected:** Drizzle/Prisma (new paradigm + tooling for no gain at this scale); drizzle-kit (the SQL runner is portable and understood); replaying the 27 Supabase migrations (a third are RLS/mirror churn that gets deleted — author a clean `0001_init.sql` baseline instead, validated by the surviving pgTAP function tests). Also consciously rejected: staying on Supabase with just code-auth + one project — satisfies OAuth/billing goals without a DB move, but leaves bushel and muster on divergent stacks forever; the muster-alignment dividend is the tie-breaker.

**Migration:** fresh baseline schema on Neon; `place_order` plpgsql + `order_items` trigger port unchanged (pure Postgres). Data crosses via targeted `pg_dump -t products -t product_units -t customers` (orders/order_items/customer_sends are wiped by DEC-041's cutover, so they don't move).

**Sequencing:** the Neon data move happens in the SAME quiet-minute as the pending DEC-041 production cutover — one outage on the live tool, not two.

---
