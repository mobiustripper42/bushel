#!/usr/bin/env bash
# safe-supabase.sh — wrapper around the `supabase` CLI that refuses
# destructive operations when linked to a production project.
#
# DEC-009 (seeds): two-layer defense — discipline (never link prod locally)
# plus this wrapper as belt-and-suspenders.
#
# Setup (per project):
#   1. Copy this script to <project>/scripts/safe-supabase.sh
#   2. chmod +x <project>/scripts/safe-supabase.sh
#   3. Create <project>/.claude/prod-supabase-refs (one project ref per line):
#        echo "your-prod-ref" > .claude/prod-supabase-refs
#   4. Add to .gitignore:
#        echo ".claude/prod-supabase-refs" >> .gitignore
#   5. Optional shell alias for transparent protection:
#        alias supabase='./scripts/safe-supabase.sh'
#
# Detection:
#   - Reads the linked project ref from supabase/.temp/project-ref
#   - Compares against .claude/prod-supabase-refs
#     (blank lines and lines starting with # are ignored)
#
# What's blocked when linked to a prod ref:
#   db reset, db push, db remote *, migration up, migration repair
#
# The matcher walks adjacent argument pairs so leading global flags
# (--debug, --workdir, etc.) don't bypass the guard:
#   `supabase --debug db push` is still blocked.
#
# Bypass surfaces NOT guarded (by design — discipline-plus-wrapper):
#   - `supabase ... --db-url postgres://...` skips the linked-project
#     entirely and writes to whatever URL is passed.
#   - Direct `psql` against a prod URL.
#   - Anything that doesn't go through the `supabase` binary.
#
# Everything else (db pull, db diff, db lint, migration list, gen types,
# status, start, stop, login, projects list, etc.) passes through unchanged.
#
# Override the underlying CLI for testing: SAFE_SUPABASE_REAL=/path/to/fake-supabase

set -eu

PROD_REFS_FILE=".claude/prod-supabase-refs"
LINK_REF_FILE="supabase/.temp/project-ref"
REAL_SUPABASE="${SAFE_SUPABASE_REAL:-supabase}"

repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || pwd
}

MATCHED_PAIR=""
is_destructive() {
  # Walk adjacent argument pairs so leading global flags don't shift
  # the destructive subcommand out of the $1/$2 window. Sets
  # MATCHED_PAIR so the refusal message can name the actual subcommand
  # rather than echo back the leading flag.
  MATCHED_PAIR=""
  local prev=""
  for arg in "$@"; do
    case "$prev $arg" in
      "db reset"|"db push"|"db remote"|"migration up"|"migration repair")
        MATCHED_PAIR="$prev $arg"
        return 0 ;;
    esac
    prev="$arg"
  done
  return 1
}

linked_ref() {
  local path
  path="$(repo_root)/$LINK_REF_FILE"
  if [ -f "$path" ]; then
    tr -d '[:space:]' < "$path"
  fi
}

is_prod_ref() {
  local ref="$1" path
  path="$(repo_root)/$PROD_REFS_FILE"
  [ -f "$path" ] || return 1
  grep -v '^[[:space:]]*#' "$path" | grep -v '^[[:space:]]*$' | grep -qFx "$ref"
}

main() {
  if [ $# -eq 0 ]; then
    exec "$REAL_SUPABASE"
  fi

  if is_destructive "$@"; then
    local ref
    ref=$(linked_ref)
    if [ -n "$ref" ] && is_prod_ref "$ref"; then
      cat >&2 <<EOF

safe-supabase: REFUSED — '$MATCHED_PAIR' is destructive and the linked
project ref ($ref) is in $PROD_REFS_FILE.

Production deploys read env vars (SUPABASE_URL, service-role key) from
Vercel — never from a local link. To run this command:

  $REAL_SUPABASE unlink
  $REAL_SUPABASE link --project-ref <staging-ref>

Then retry.

EOF
      exit 1
    fi
  fi

  exec "$REAL_SUPABASE" "$@"
}

main "$@"
