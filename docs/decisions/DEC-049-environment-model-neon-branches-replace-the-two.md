---
id: DEC-049
title: "Environment model: Neon branches replace the two-project split; prod-write protection via connection-string discipline"
topic: "Stack, platform & environments"
---

## DEC-049: Environment model: Neon branches replace the two-project split; prod-write protection via connection-string discipline

**Decision:** One Neon project, two branches — `main` (dev/preview) and `production`. Vercel Production → Neon `production` branch URL; Vercel Preview/Development + `.env.local` → Neon `main` branch URL. CI/local tests run docker Postgres (unchanged). No per-PR ephemeral-branch automation.

**Production-write protection** (replaces DEC-S009's Supabase relink dance): production `DATABASE_URL` lives ONLY in Vercel and a separate, deliberately-sourced `.envrc.production` — never the shell default. `db/migrate.ts` takes the connection string as an arg, so a prod migration is an explicit `tsx db/migrate.ts "$PROD_DATABASE_URL"`, not a lingering link state. Strictly safer than the "link to prod for a few seconds, always relink back" ritual — there is no default-prod state to forget out of.

**Supersedes:** DEC-S009 mechanics (the two-Supabase-project split + link discipline) and the Supabase↔Vercel env-sync section — replaced by two Neon branch URLs and the same "both Vercel scopes must stay coherent" diff-check.

---
