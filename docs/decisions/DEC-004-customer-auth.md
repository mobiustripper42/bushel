---
id: DEC-004
title: "Customer auth"
topic: "Auth & access boundary"
---

## DEC-004: Customer auth

**Decision:** Tokenized per-customer URL — `/c/<token>`. No email-verify round-trip. Each customer has a durable, regeneratable token.

**Why:** ~7 known B2B customers; magic-link is friction without security gain.

**Trade-off accepted:** SMS forwarding could let an unintended recipient order. Low risk at this scale.

---
