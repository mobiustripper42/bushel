# bushel

Bay Branch Farm inventory and weekly ordering app — `order.baybranchfarm.com`.

Replaces tend.com for ~7 B2B customers (farm stands, grocery, restaurants) on a Sun/Mon → Wed/Thu cadence.

## Stack

- Next.js 16 (App Router) · TypeScript strict
- Supabase (Postgres + Auth + RLS)
- Tailwind v4 · shadcn/ui (radix-maia)
- Native `sms:` deep links for operator-sent customer SMS · transactional email for admin alerts
- Vercel · Supabase Cloud

## Getting started

```bash
npm install
npm run dev
```

Dev server: `http://mill-dev:3001` (tailnet only — works from laptop, phone, iPad). Pinned to `:3001` so it can run alongside sailbook on `:3000`. Rationale: see [DEC-025](./docs/DECISIONS.md#dec-025--dev-server-access-pattern).

## Common ops

### Reset the `preview` branch to match `main`

The `preview` branch backs `preview.baybranchfarm.com`. Point it at the latest `main`:

```bash
git checkout preview
git merge --ff-only origin/main   # clean ff
git push
```

If `preview` has diverged (e.g. throwaway `force redeploy` commits):

```bash
git checkout preview
git reset --hard origin/main
git push --force-with-lease
```

To kick a Vercel rebuild on the current branch without other changes:

```bash
git commit --allow-empty -m "force redeploy"
git push
```

### Push migrations to prod Supabase

See CLAUDE.md §"Two Supabase projects" — `source .envrc`, link to prod ref, `db push`, **relink back to dev** (non-negotiable).

## Project context

See [`CLAUDE.md`](./CLAUDE.md) for conventions, [`docs/SPEC.md`](./docs/SPEC.md) for scope, and [`docs/PROJECT_PLAN.md`](./docs/PROJECT_PLAN.md) for phases.
