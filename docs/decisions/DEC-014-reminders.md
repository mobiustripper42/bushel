---
id: DEC-014
title: "Reminders"
topic: "Notifications & alerting"
---

## DEC-014: Reminders

**Decision:** Morning-of pickup reminder to pickup customers only. No delivery reminders (B2B locations are staffed).

**Amended 2026-06-04 (#193):** delivery reminders are now sent too — per-order, operator-initiated from the Orders-page action stack, using a distinct `delivery_reminder` send mode + `deliveryReminderBody` template. Annabel wanted parity with pickup reminders. The original "staffed locations don't need it" rationale held until she asked; sending one is cheap (operator-initiated `sms:` deep link, no automation) and harmless.

---
