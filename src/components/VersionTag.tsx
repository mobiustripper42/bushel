/**
 * Build-time version tag. Renders e.g. "v1.2.3 (a1b2c3)".
 *
 * Reads:
 *   - process.env.NEXT_PUBLIC_APP_VERSION  (set in next.config.js — see below)
 *   - process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA  (Vercel sets automatically)
 *
 * Both are inlined at build time. No runtime cost.
 *
 * Why NEXT_PUBLIC_APP_VERSION and not process.env.npm_package_version?
 *   Next.js only inlines `process.env.X` into client bundles when X starts with
 *   NEXT_PUBLIC_. `npm_package_version` is set during `npm run build` so server
 *   components see it, but client components silently get `undefined` and the
 *   tag renders "v0.0.0". Routing through next.config.js makes it work in both
 *   server and client trees.
 *
 * Setup (one-time per project):
 *   In next.config.js:
 *     module.exports = {
 *       env: {
 *         NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version,
 *       },
 *     };
 *   This forwards the npm-set version into the client-inlinable namespace.
 *
 * Usage:
 *   import { VersionTag } from "@/components/VersionTag";
 *   <VersionTag />                     // "v1.2.3 (a1b2c3)"
 *   <VersionTag className="text-xs" /> // with extra Tailwind classes
 *   <VersionTag showCommit={false} />  // "v1.2.3"
 *
 * Wire into login screen + footer per dev/claude/CLAUDE.md §Versioning.
 *
 * Local dev fallback: when NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA is undefined
 * (running `npm run dev` outside Vercel), the commit hash is omitted.
 */

type VersionTagProps = {
  className?: string;
  showCommit?: boolean;
};

export function VersionTag({ className, showCommit = true }: VersionTagProps) {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
  const commit = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const display = showCommit && commit ? `v${version} (${commit})` : `v${version}`;

  return (
    <span className={className} data-testid="version-tag">
      {display}
    </span>
  );
}
