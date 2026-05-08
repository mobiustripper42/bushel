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

## Project context

See [`CLAUDE.md`](./CLAUDE.md) for conventions, [`docs/SPEC.md`](./docs/SPEC.md) for scope, and [`docs/PROJECT_PLAN.md`](./docs/PROJECT_PLAN.md) for phases.
