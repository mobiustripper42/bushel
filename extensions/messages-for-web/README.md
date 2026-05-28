# Bushel SMS Helper

Chromium extension that pre-fills the recipient and body in Messages for Web
when triggered from the Bushel admin's Send page. The operator still clicks
Send — nothing is sent automatically (DEC-026).

## How it works

Messages for Web sends a `Cross-Origin-Opener-Policy` header that severs
`window.opener` and silently drops cross-tab `postMessage`, so the admin tab
can't talk to the Messages tab directly. The extension bridges that gap:

1. **`bridge.js`** runs on the admin pages. The Send button fires a
   same-window `postMessage`; the bridge forwards it to the service worker.
2. **`background.js`** (service worker) stashes the `{phone, body}` payload in
   `chrome.storage.session`, then opens (or focuses + reloads) the Messages
   for Web tab via `chrome.tabs` — which isn't subject to COOP.
3. **`content-script.js`** runs on `messages.google.com/web/*`. On load it
   asks the service worker for the pending payload, then drives the DOM:
   opens a new conversation, fills the recipient, clicks the contact
   suggestion, and types the body into the compose box.

## Install

1. Open `chrome://extensions/` (or `edge://extensions/`).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select this folder: `extensions/messages-for-web/`.
5. Confirm "Bushel SMS Helper" appears in the list and is enabled.

Sideloads show a "developer mode" banner — that's expected.

## Update

When this folder changes (e.g. after `git pull`):

1. Open `chrome://extensions/` and click the **Reload** ⟳ icon on the
   "Bushel SMS Helper" card.
2. **If you changed `manifest.json`** (permissions, content-script entries),
   a ⟳ Reload sometimes isn't enough — toggle the card **off and back on**,
   or **Remove** + **Load unpacked** to force a clean re-read.
3. **Refresh any open admin tab** afterward. Reloading the extension orphans
   the `bridge.js` already injected into open admin pages — they'll throw
   "Extension context invalidated" until refreshed. A hard refresh
   (Ctrl/Cmd+Shift+R) re-injects a current bridge.
4. **Close any open Messages for Web tab** before the next test — the old
   content script stays loaded in it until the tab is reopened.

## How to tell if it's working

Click **Send** on a customer in the Bushel admin's Send page on desktop. The
Messages for Web tab opens (or comes to the front) and the new conversation
auto-fills with the recipient and body — review and click Send yourself.

The admin always copies the body to your clipboard as a safety net, so even
if the extension isn't installed or hits an error, you can open Messages for
Web and paste manually. The Send row shows **"Copied — paste in Messages."**

To watch it run: open the Messages tab's DevTools console — a `fill failed:`
warning there is the signal that a selector drifted (see below).

## When to update selectors

Messages for Web is shipped by Google and the DOM can change without warning.
The extension watches a few attributes; if any disappear, the fill throws and
logs `[Bushel SMS Helper] fill failed: …` in the Messages tab console. The
clipboard fallback still covers the operator.

The selectors live at the top of `content-script.js`:

```js
const SELECTORS = {
  startChat:        "a[data-e2e-start-button]",
  recipientInput:   "input[data-e2e-contact-input]",
  contactSuggestion: ".anon-contact-name",
  composeTextarea:  "textarea[data-e2e-message-input-box]",
};
```

To fix: open Messages for Web, DevTools → Elements, find the equivalent
elements, swap the selectors, and reload the extension card.

## Notes & gotchas

- **The 600ms compose delay is load-bearing.** MWS's compose textarea is an
  Angular component (`mws-autosize-textarea`) that resets its value on its
  first change-detection pass. Writing before Angular attaches gets wiped —
  the delay lets the binding settle. Don't remove it.
- The recipient field fills via a synthetic value-set because it's a plain
  search input; the compose body uses `execCommand("insertText")` so Angular's
  FormControl registers the change like real typing.

## Not in scope

- Auto-clicking Send. Operator-in-the-loop per DEC-026.
- Web Store publishing. Sideload only — one operator, one machine.
- iOS/Safari. Chromium only.
