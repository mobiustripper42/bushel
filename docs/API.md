# bushel `/api/mobile/*` — the app-facing API

The surface the **bushel-mobile** Expo app calls (Phase 11.1, #261). bushel's
web UI runs on Server Actions, which native clients can't invoke — so these are
bushel's first real HTTP data routes (DEC-050). Everything is JSON in / JSON out.

**Base URL:** the bushel deployment, e.g. `https://order.baybranchfarm.com`.

## Auth (DEC-047)

The app authenticates with the **same HMAC session token** the web login mints,
carried as a bearer header instead of an httpOnly cookie. Two steps to obtain it,
then send it on every guarded call:

```
Authorization: Bearer <token>
```

The token is stateless and self-expiring (14-day TTL, sliding on the web side but
the app simply re-runs the login when a guarded call returns 401). Store it in
`expo-secure-store`.

### `POST /api/mobile/auth/request-code`
Body `{ "email": string }`. Always `200 { "ok": true }` — no-enumeration: the
response is identical whether or not the email matches an admin, and the code is
only sent on a match (off the hot path, so timing doesn't leak the match).

### `POST /api/mobile/auth/verify-code`
Body `{ "email": string, "code": string }`.
- `200 { "token": string, "expiresAt": string }` — the bearer token + its ISO expiry.
- `401 { "error": "invalid" | "expired" | "locked" }` — wrong/expired code, or the
  5-attempt cap tripped.

## Guarded routes

All require a valid bearer token; missing/invalid/expired → `401 { "error": "Unauthorized" }`.

### `GET /api/mobile/orders`
The active (non-terminal) order set — the same `listActiveOrders` read the admin
Orders page uses (DEC-041/045).
- `200 { "orders": OrderRow[] }` — see `src/lib/admin/order-status.ts` for the
  `OrderRow` shape (customer, items, totals, status, fulfillment type, timestamps).

### `POST /api/mobile/orders/[id]/fulfill`
Mark an order fulfilled — the app's single mutation (thin scope, DEC-050). The
terminal status is derived server-side from the order's fulfillment type
(pickup → `picked_up`, delivery → `delivered`); the client sends no status.
- `200 { "ok": true }`
- `404 { "error": "Order not found" }`
- `409 { "error": string }` — illegal transition (e.g. an order that was never
  marked `ready`).

### `POST /api/mobile/push-tokens`
Register the device's Expo push token to the signed-in admin (upsert on the
token — idempotent across re-registration).
- Body `{ "token": string, "platform": "android" | "ios" }`.
- `200 { "ok": true }`
- `400 { "error": string }` — missing token or invalid platform.

## Notes for the app side
- One write path: `fulfill` and the admin UI share `advanceOrder` (DEC-052 parity
  mechanism 1), so the app can't drift from the admin's status rules.
- iOS remote push is gated on the deferred $99 Apple Developer enrollment; the
  registry accepts `ios` tokens now, fan-out is Android-first (bushel-mobile Phase 1).
