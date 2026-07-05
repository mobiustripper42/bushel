# Runbook — Phase 10.7 Production cutover (Supabase → Neon)

Moves **production** off Supabase onto Neon + the pg/HMAC code. High blast radius —
run it once, deliberately, in a quiet minute. **DB before code**: schema + data land
on Neon *before* the code that reads them is promoted.

Scope (per #260): only **products, product_units, customers** carry over. Orders /
order_items / customer_sends are wiped per DEC-041, so the week starts empty — that's
expected, not data loss. `pg_dump` is read-only against Supabase, so **Supabase prod
stays a clean rollback target** until you're satisfied.

What flips: prod DB (Supabase → Neon `production`), prod auth (Google OAuth → email
code + HMAC session, DEC-047), prod code (v0.11.1 → current `main`).

---

## 0. Pre-flight (do this *before* the outage window — nothing here touches prod)

- [ ] **All Phase 10 PRs merged to `main`** — #274 (baseline), #275 (supabase removal),
      #276 (login-code tests). `main` should be the full pg / Neon / no-supabase code.
      Confirm: `git log origin/main --oneline | head` and `git cat-file -e origin/main:src/lib/db.ts && echo ok`.
- [ ] **Neon `production` branch exists and is empty** (it has been, until now). You'll
      apply the schema in step 2.
- [ ] **Grab the Supabase prod DIRECT connection string** — Supabase dashboard → the
      **prod** project (`piaobrnrmoxnfrpnpixw`) → Settings → Database → Connection string →
      **Direct** (host `db.<ref>.supabase.co`, port **5432** — NOT the pooler on 6543;
      `pg_dump` can't use pgbouncer). Keep it handy for step 3.
- [ ] **Set Vercel Production-scope env vars** (dashboard → Settings → Environment
      Variables → Production). Setting them now is safe — they only take effect on the next
      prod deploy (the promote in step 4).
  - `DATABASE_URL` = Neon **production** branch **pooled** URL
  - `DATABASE_URL_UNPOOLED` = Neon **production** branch **direct** URL
  - `SESSION_SECRET` = a 32-byte hex (`openssl rand -hex 32`) — **required**, or every
    `/admin` + `/login` request 500s (fail-fast by design)
  - `RESEND_API_KEY` = the brewcle Resend key
  - `RESEND_FROM` = `Bay Branch Farm <bushel-auth@brewcle.com>` (verified domain —
    the `crew-tips` subdomain 403s)
  - (optional cleanup) delete the old `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY`
    from Production — the current code ignores them.
- [ ] **Confirm the 3 admin emails** are the real ones seeded in 0001 (Emma / Eric /
      Annabel). Only those can log in after cutover — Annabel logs in with *her email*, not
      a Google account.

`.envrc.production` (gitignored) already holds `PROD_DATABASE_URL`,
`PROD_DATABASE_URL_UNPOOLED`, `MCP_READONLY_DATABASE_URL` for Neon prod.

---

## 1. Open the outage window

Ordering is closed most of the week anyway; pick a minute with no active customer
session. The gap is only steps 2–4 (a few minutes).

---

## 2. Schema → Neon prod

```bash
source .envrc.production
npx tsx db/migrate.ts "$PROD_DATABASE_URL_UNPOOLED"
```

Verify (Neon SQL Editor or `psql "$PROD_DATABASE_URL_UNPOOLED" -c '…'`):

```sql
select count(*) from _migrations;   -- expect 1
select email from admins order by email;   -- expect the 3 real admins
select to_regclass('public.products'), to_regclass('public.login_codes');  -- both non-null
```

---

## 3. Catalog data → Neon prod

```bash
SUPABASE_PROD_URL="postgres://postgres:...@db.<ref>.supabase.co:5432/postgres" \
TARGET_URL="$PROD_DATABASE_URL_UNPOOLED" \
scripts/migrate-prod-catalog.sh
```

The script guards (schema present, target catalog empty), prompts for `yes`, copies
products → product_units → customers, and verifies row counts match Supabase. If it
reports a **version mismatch**, install a `pg_dump` matching the Supabase server major
(e.g. `postgresql-client-17` via PGDG) and retry. If it reports a **column mismatch**,
the Supabase prod schema drifted from 0001 — stop and reconcile before promoting.

---

## 4. Code → prod (promote)

Only after steps 2–3 are verified:

```
/promote-production
```

This ff-merges `main` → `production` and pushes; Vercel builds prod from the pg/Neon
code (the version tag is already on the commit — promote doesn't tag).

---

## 5. Verify prod (close the window once green)

- [ ] Visit `order.baybranchfarm.com/login` → enter an admin email → a code arrives via
      Resend → sign in → `/admin` loads.
- [ ] `/admin/inventory` shows the real products; `/admin/customers` shows the real
      customers (the catalog you copied).
- [ ] Open a real customer's `/c/<token>` link → order form loads → place a test order →
      it appears in `/admin/orders`. (Delete the test order after.)
- [ ] `VersionTag` in the admin sidebar shows the promoted version, not v0.11.1.

Then **re-open ordering** if it should be open (Neon seed starts it closed), and
**reshare any `/f/<token>` harvest-sheet link** (the token was freshly minted on Neon).

Close #260 once prod is confirmed healthy.

---

## Rollback (if prod is broken and you can't fix forward fast)

Supabase prod data was only read, never modified — it's intact.

1. **Vercel → Production → Deployments** → find the last **v0.11.1** deployment →
   **⋯ → Promote to Production** (or redeploy it). That puts the old OAuth/Supabase code
   back, pointed at Supabase prod. Google-OAuth login + real data return.
2. Leave Neon `production` as-is; re-attempt the cutover later.

The rollback is clean precisely because the cutover is copy-forward, not move.
