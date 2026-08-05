---
id: DEC-050
title: "Expo native app: muster rehearsal, push-first, thin scope"
topic: "Stack, platform & environments"
---

## DEC-050: Expo native app: muster rehearsal, push-first, thin scope

**Decision:** A separate-repo Expo (React Native) app, `bushel-mobile`, whose v1 scope is exactly: (a) receive Expo push notifications, (b) a read-only active-orders list, (c) one mutation — mark-fulfilled. It authenticates to bushel's Next.js `/api/*` routes with the DEC-047 HMAC session as a bearer token — never direct DB access from the phone. Not an admin port.

**Why:** bushel is the rehearsal for muster, where native + background-sync are real requirements — and long-term, in-app push is the path off SMS/carrier costs for users who don't want texts. Bushel's only alert channel today is Telegram (DEC-033; the PWA push idea #170 was closed *parked*, never built), so the app also replaces that hack for Annabel — but the scope stays thin because the rehearsal is the point.

**Net-new API surface:** bushel mutations are Server Actions (uncallable from native), so Phase 11 builds the first real `/api/*` routes — list orders, mark-fulfilled, register push token, order-arrival push fan-out. The DEC-047 session is bearer-consumable specifically to serve these.

**iOS scope reset:** remote push to iOS requires an APNs key, which requires paid Apple Developer Program membership ($99/yr, deferred). Free 7-day personal-team signing installs and runs on Emma's iPhone but does NOT grant remote push. So **v1 push is ANDROID-ONLY (Annabel)**; iPhone push is explicitly gated behind the $99 enrollment. Android proves the Expo push loop for the muster rehearsal.

**Repo shape:** separate repo, not in-repo `apps/mobile` — a monorepo root collides with the seeds-template sync (root-file-oriented, single-app-root assumption). This sets no precedent for muster's repo layout — muster makes its own monorepo-vs-separate call when it builds its app.

**Web↔app parity:** the two surfaces need to stay close, not 1:1. Two mechanisms: (1) admin mutations are implemented as service-layer functions first, with the Server Action (web) and `/api/*` route (app) as thin wrappers over the same function — parity is then a wrapper, not a reimplementation; (2) each phase retro includes a parity pass — which admin capabilities added that phase should the app pick up, and which diverge deliberately. Divergence is fine when named; drift is not.

**Build/signing:** Android via EAS free tier → sideloaded APK ($0). iOS via free-signed 7-day EAS builds for install/run only (no push) until $99 lands. No Mac in the loop for Android.

---
