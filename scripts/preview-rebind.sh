#!/usr/bin/env bash
# Rebind preview.baybranchfarm.com to the latest READY preview deployment for
# the current git branch. Idempotent. Soft-fails (exit 0) when there is nothing
# to do or when auth/CLI is missing, so callers (e.g. /its-alive) keep going.
#
# Requires: vercel CLI on PATH, node, VERCEL_TOKEN env var (set via .envrc).
# See CLAUDE.md §"Stable preview URL — preview.baybranchfarm.com".

set -uo pipefail

ALIAS_DOMAIN="preview.baybranchfarm.com"
PROJECT="bushel"

BRANCH="$(git branch --show-current 2>/dev/null || true)"

case "$BRANCH" in
  ""|main|master)
    echo "preview-rebind: on '${BRANCH:-detached}', skipping."
    exit 0 ;;
esac

if ! command -v vercel >/dev/null 2>&1; then
  echo "preview-rebind: vercel CLI not on PATH, skipping."
  exit 0
fi

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "preview-rebind: VERCEL_TOKEN not set (add to .envrc), skipping."
  exit 0
fi

DEPLOY_JSON="$(vercel ls "$PROJECT" \
  --meta githubCommitRef="$BRANCH" \
  --status READY \
  --format json \
  --token "$VERCEL_TOKEN" 2>/dev/null || true)"

DEPLOY_URL="$(printf '%s' "$DEPLOY_JSON" | node -e '
  let s = ""; process.stdin.on("data", c => s += c).on("end", () => {
    try { const j = JSON.parse(s); const d = (j.deployments || [])[0];
      if (d && d.url) process.stdout.write(d.url);
    } catch (_) {}
  });
' 2>/dev/null || true)"

if [ -z "$DEPLOY_URL" ]; then
  echo "preview-rebind: no READY preview for '$BRANCH' yet — push a commit to build one."
  exit 0
fi

echo "preview-rebind: $ALIAS_DOMAIN → $DEPLOY_URL"
vercel alias set "$DEPLOY_URL" "$ALIAS_DOMAIN" --token "$VERCEL_TOKEN" >/dev/null 2>&1 || {
  echo "preview-rebind: vercel alias set failed (non-fatal, manual rebind in dashboard if needed)."
  exit 0
}
