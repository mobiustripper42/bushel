---
id: DEC-001
title: "Stack"
topic: "Stack, platform & environments"
---

## DEC-001: Stack

**Decision:** Next.js 16 + TypeScript strict + Supabase + Vercel + transactional email (provider TBD). No third-party SMS — customer outbound is operator-sent via native `sms:` deep links. baybranchfarm.com stays Astro on Netlify, untouched.

**Why:** User is fluent in Next.js. Supabase bundles Postgres + RLS + auth + realtime. Vercel is already paid. Twilio dropped — see DEC-026. Email/PWA-push admin alert — see DEC-027.

---
