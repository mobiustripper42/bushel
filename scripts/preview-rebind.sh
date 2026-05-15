#!/usr/bin/env bash
# Rebind preview.baybranchfarm.com to the current git branch by updating the
# Vercel project domain's gitBranch field. Idempotent. Soft-fails (exit 0) so
# callers (e.g. /its-alive) keep going on auth/CLI/API errors.
#
# Why PATCH /v9/projects/{name}/domains/{domain}, not `vercel alias set`:
# preview.baybranchfarm.com is a Vercel **project domain with a Git Branch
# binding**, not a deployment alias. `vercel alias set` 403s on it ("you don't
# have access to the domain"). The dashboard's Edit → Git Branch button hits
# this same API. Once the binding is updated, Vercel serves the latest READY
# preview for that branch automatically — no need to look up a specific
# deployment URL.
#
# Requires: VERCEL_TOKEN env var (set via .envrc). See CLAUDE.md §"Stable
# preview URL — preview.baybranchfarm.com".

set -uo pipefail

DOMAIN="preview.baybranchfarm.com"
PROJECT="bushel"

BRANCH="$(git branch --show-current 2>/dev/null || true)"

case "$BRANCH" in
  ""|main|master)
    echo "preview-rebind: on '${BRANCH:-detached}', skipping."
    exit 0 ;;
esac

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "preview-rebind: VERCEL_TOKEN not set (add to .envrc), skipping."
  exit 0
fi

RESPONSE="$(curl -sS \
  -X PATCH "https://api.vercel.com/v9/projects/${PROJECT}/domains/${DOMAIN}" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"gitBranch\":\"${BRANCH}\"}" 2>/dev/null || true)"

CURRENT_BRANCH="$(printf '%s' "$RESPONSE" | node -e '
  let s = ""; process.stdin.on("data", c => s += c).on("end", () => {
    try { const j = JSON.parse(s); if (j && j.gitBranch) process.stdout.write(j.gitBranch); } catch (_) {}
  });
' 2>/dev/null || true)"

if [ "$CURRENT_BRANCH" = "$BRANCH" ]; then
  echo "preview-rebind: $DOMAIN → $BRANCH"
  exit 0
fi

echo "preview-rebind: rebind failed (check VERCEL_TOKEN scope, manual fallback in Vercel dashboard)."
exit 0
