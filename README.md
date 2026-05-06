# bushel

Bay Branch Farm inventory and weekly ordering app — `order.baybranchfarm.com`.

Replaces tend.com for ~7 B2B customers (farm stands, grocery, restaurants) on a Sun/Mon → Wed/Thu cadence.

## Stack

- Next.js 16 (App Router) · TypeScript strict
- Supabase (Postgres + Auth + RLS)
- Tailwind v4 · shadcn/ui (radix-maia)
- Twilio (toll-free SMS)
- Vercel · Supabase Cloud

## Getting started

```bash
npm install
npm run dev
```

Then `http://localhost:3000`.

## Project context

See [`CLAUDE.md`](./CLAUDE.md) for conventions, [`docs/SPEC.md`](./docs/SPEC.md) for scope, and [`docs/PROJECT_PLAN.md`](./docs/PROJECT_PLAN.md) for phases.
