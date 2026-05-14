# Bushel — User Stories

> **Status:** First-pass B2B reframe from `docs/review/spec-for-annabel.html` + `DECISIONS.md`. Pending review by Eric.

Story IDs use a prefix per role: `AD-N` for Admin (Annabel), `CU-N` for B2B customer. Cross-reference with `SPEC.md` and `PROJECT_PLAN.md`. Sub-stories use letter suffixes (`AD-3a`).

---

## AD — Admin (Annabel)

### Open the week (Sun / Mon)

- **AD-1:** As Annabel, I want to update the week's inventory in a spreadsheet-style grid so I can edit all items in one screen instead of clicking through individual product pages.
- **AD-2:** As Annabel, I want a "Pre-fill from last week" button so I'm editing last week's list rather than starting blank.
- **AD-3:** As Annabel, I want to mark items unavailable without deleting them so they're easy to bring back when they're in stock again.
- **AD-4:** As Annabel, I want to flip ordering open with one toggle so customers can start placing orders.
- **AD-5:** As Annabel, I want a send-queue page that lists customers in priority order with a per-customer Send button so I can fire off the weekly text in ~21 taps from my phone.
- **AD-5a:** As Annabel, I want each Send button to open my phone's Messages app pre-filled with the customer's number and the weekly message so I never have to copy/paste.
- **AD-5b:** As Annabel, I want the queue to remember which customers I've already sent to this cycle so I can pause and resume without losing my place.

### Watch the week (Mon – Wed)

- **AD-6:** As Annabel, I want a notification on my phone when an order lands so I don't have to keep refreshing the orders page.
- **AD-7:** As Annabel, I want a running orders list sortable by customer or by item so I can spot-check the week as it builds.
- **AD-8:** As Annabel, I want oversold orders flagged in red regardless of sort/filter so I can call the affected customer instead of an embarrassing post-checkout error reaching them.

### Close the week (Tue / Wed)

- **AD-9:** As Annabel, I want to close ordering manually or let a schedule do it so I can set a cadence and still override it for late-add asks.
- **AD-9a:** As Annabel, I want an "open for N more hours" override so a customer who texts late doesn't force me to flip the toggle and forget to flip it back.
- **AD-10:** As Annabel, I want a final picking list aggregated by item so I can harvest from one screen.

### Fulfill (Wed / Thu)

- **AD-11:** As Annabel, I want each order tagged delivery-or-pickup with the address pre-filled or the customer's pickup note visible so I can plan my route.
- **AD-12:** As Annabel, I want to send pickup reminders the morning of through the same send-queue flow so I'm not building a separate workflow for them.
- **AD-13:** As Annabel, I want to mark orders fulfilled as I finish so the list stays accurate.
- **AD-14:** As Annabel, I want a one-click Wave CSV export (download + clipboard TSV) so I can paste straight into my existing Wave invoicing workflow.

### Manage customers (anytime)

- **AD-15:** As Annabel, I want to add a new wholesale customer (name, business name, contact, delivery address) so they can start receiving weekly links.
- **AD-16:** As Annabel, I want to set a customer's priority so my most important accounts get the weekly text first.
- **AD-17:** As Annabel, I want to regenerate a customer's order link if they lose their phone or need a fresh one, so I'm not locked out of rotating credentials.
- **AD-17a:** As Annabel, I want a confirm dialog before regenerating so I don't accidentally invalidate a customer's bookmark.
- **AD-18:** As Annabel, I want to pause a customer (stop sending them the weekly link) without deleting them so seasonal accounts don't disappear from my list.
- **AD-19:** As Annabel, I want to delete (soft-delete) a customer who isn't ordering this season so my active list stays clean.

### Auth + access

- **AD-20:** As Annabel, I want to sign in with Google so I'm not maintaining yet another password.

---

## CU — B2B customer

- **CU-1:** As a customer, I want to receive a weekly SMS with my personal ordering link so I can place an order without thinking about credentials.
- **CU-2:** As a customer, I want my link to recognize me automatically (no login, no password) so ordering from my phone takes seconds, not a minute.
- **CU-3:** As a customer, I want my link to stay the same week after week so I can bookmark it on my phone.
- **CU-4:** As a customer, I want to see this week's inventory with price, unit, and quantity remaining so I can pick what's actually available.
- **CU-5:** As a customer, I want sold-out items shown disabled (not hidden) so I can see what was on offer this week and know to order earlier next time.
- **CU-6:** As a customer, I want a quantity stepper per item with a running total at the bottom so I can build my order without doing math in my head.
- **CU-7:** As a customer, I want delivery selected by default with my address pre-filled so I'm not retyping it every week.
- **CU-8:** As a customer who picked delivery last week, I want my delivery preference (e.g., "back door, gate code 4321") pre-filled from my last delivery order so I can reuse standing instructions.
- **CU-9:** As a customer who picks pickup, I want a free-text "When are you picking up?" field so I can describe a window in plain language.
- **CU-10:** As a customer, I want an optional notes textarea so I can flag anything special about this order.
- **CU-11:** As a customer, I want a confirmation screen on submit and a quick follow-up text from Annabel once she's seen the order land, so I know it went through both technically and to a human.
- **CU-12:** As a customer, I want a reminder text the morning of pickup or delivery so I don't forget.
- **CU-13:** As a customer, I want to reply to texts and reach Annabel directly (not a bot) so substitutions and changes happen the way they always have.
- **CU-14:** As a customer, I want to see "Orders are closed this week" if Annabel has closed the store, so I'm not confused by an empty form.
- **CU-15:** As a customer, I want to see "Everything sold out — check back next week" if nothing is orderable, so I have a clear endpoint instead of a broken-feeling page.
