#!/usr/bin/env bash
# migrate-prod-catalog.sh — one-time Supabase → Neon catalog copy (Phase 10.7).
#
# Copies the three catalog tables Annabel maintains — products, product_units,
# customers — DATA-ONLY from Supabase prod into the Neon `production` branch.
# orders / order_items / customer_sends are NOT moved (wiped per DEC-041, so the
# week starts empty on Neon anyway).
#
# The target schema must already exist (apply db/migrations/0001 to Neon prod
# FIRST — see docs/RUNBOOK-neon-cutover.md). This is read-only against Supabase:
# it only `pg_dump`s, so Supabase prod stays a safe rollback target.
#
# Usage:
#   SUPABASE_PROD_URL="postgres://postgres:...@db.<ref>.supabase.co:5432/postgres" \
#   TARGET_URL="$PROD_DATABASE_URL_UNPOOLED" \
#   scripts/migrate-prod-catalog.sh
#
#   - SUPABASE_PROD_URL: the Supabase prod DIRECT connection string (port 5432 /
#     db.<ref>.supabase.co), NOT the pooler (pg_dump can't use pgbouncer).
#   - TARGET_URL: the Neon production UNPOOLED URL (from .envrc.production).
#
# Gotcha: `pg_dump` major version must be >= the Supabase server major, or it
# refuses with a version-mismatch error. If that happens, install a matching
# client (e.g. postgresql-client-17 via PGDG) and retry.

set -euo pipefail

: "${SUPABASE_PROD_URL:?set SUPABASE_PROD_URL (Supabase prod DIRECT connection string)}"
: "${TARGET_URL:?set TARGET_URL (Neon production unpooled URL, e.g. \$PROD_DATABASE_URL_UNPOOLED)}"

# FK-safe load order: product_units.product_id references products.id; customers
# is independent. Load products before product_units.
TABLES=(products product_units customers)

# Show host/db only — never the user:password prefix.
redact() { printf '…@%s' "${1#*@}"; }
echo "Source (Supabase prod): $(redact "$SUPABASE_PROD_URL")"
echo "Target (Neon prod):     $(redact "$TARGET_URL")"
echo

# --- Guards -----------------------------------------------------------------
# Schema present on target?
for t in "${TABLES[@]}"; do
  reg=$(psql "$TARGET_URL" -tAc "select to_regclass('public.$t')")
  if [ "$reg" != "$t" ]; then
    echo "ERROR: table '$t' missing on target — apply db/migrations/0001 to Neon prod first." >&2
    exit 1
  fi
done

# Idempotency: refuse a double-load. After 0001 these tables are empty (0001
# seeds only codes / singletons / admins), so any rows mean this already ran.
existing=$(psql "$TARGET_URL" -tAc "select count(*) from products")
if [ "$existing" != "0" ]; then
  echo "ERROR: target 'products' already has $existing row(s) — refusing to double-load." >&2
  echo "       To re-run cleanly: TRUNCATE products, product_units, customers on the target first." >&2
  exit 1
fi

read -r -p "Copy catalog (products, product_units, customers) Supabase → Neon prod? [type 'yes'] " ans
[ "$ans" = "yes" ] || { echo "aborted."; exit 1; }

# --- Copy + verify ----------------------------------------------------------
for t in "${TABLES[@]}"; do
  echo "→ $t"
  pg_dump --data-only --no-owner --no-privileges -t "public.$t" "$SUPABASE_PROD_URL" \
    | psql "$TARGET_URL" -v ON_ERROR_STOP=1 -q
  src=$(psql "$SUPABASE_PROD_URL" -tAc "select count(*) from public.$t")
  dst=$(psql "$TARGET_URL"        -tAc "select count(*) from public.$t")
  echo "   $t: source=$src target=$dst"
  if [ "$src" != "$dst" ]; then
    echo "ERROR: row-count mismatch on '$t' ($src vs $dst) — investigate before promoting." >&2
    exit 1
  fi
done

echo
echo "✓ Catalog copied and row counts match."
echo "  Next (DB before code): verify in the app, then /promote-production."
echo "  NOT migrated (per #260): ordering_schedule.is_open (Neon seed = closed — re-open if needed)"
echo "  and fulfillment_link.token (freshly minted on Neon — old /f/<token> links change)."
