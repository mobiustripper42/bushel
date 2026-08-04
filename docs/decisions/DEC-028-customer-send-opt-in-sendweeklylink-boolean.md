---
id: DEC-028
title: "Customer send opt-in: send_weekly_link boolean (replaces notification_preference)"
topic: "Notifications & alerting"
amends:
  - id: DEC-020
    relation: amends
    scope: "the notification_preference column, dropped for customers.send_weekly_link"
---

## DEC-028: Customer send opt-in: send_weekly_link boolean (replaces notification_preference)

**Decision:** Replace `customers.notification_preference text CHECK ('sms','email','none')` with `customers.send_weekly_link boolean NOT NULL DEFAULT true`.

**Why:** `notification_preference` was scoped for a multi-channel world (SMS, email, both) that DEC-026 eliminated. With operator-sent SMS deep links as the only customer channel, the meaningful choice collapses to one bit: does this customer receive the weekly order link? A boolean named `send_weekly_link` is unambiguous and requires no enum gymnastics. `false` replaces `'none'`; `true` replaces `'sms'`. The `'email'` and `'both'` values are dropped with no v1 replacement.

**Trade-offs accepted:** If a v2 email channel is added (Phase 7+), a new column will be needed rather than reusing this one. That's the right trade — v2 scope shouldn't constrain the v1 schema.

**Migration:** `20260510050945_replace_notification_preference.sql`. Existing `'none'` rows → `false`; all others → `true`. Safe on an empty table at this stage of development.

---
