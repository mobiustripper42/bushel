# Bushel SMS Helper

Chromium extension that pre-fills the recipient and body in Messages for Web
when triggered from the Bushel admin's Send page. Operator still clicks Send.

## Install

1. Open `chrome://extensions/` (or `edge://extensions/`).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select this folder: `extensions/messages-for-web/`.
5. Confirm "Bushel SMS Helper" appears in the list and is enabled.

Sideloads show a "developer mode" banner — that's expected.

## Update

When this folder changes:

1. Replace the folder contents (`git pull` if installed from a clone).
2. Open `chrome://extensions/` and click the **Reload** ⟳ icon on the
   "Bushel SMS Helper" card.

## How to tell if it's working

Click **Send** on a customer in the Bushel admin's Send page on desktop.

- With the extension installed: the new Messages tab opens, the
  conversation auto-populates with the recipient and body, and the Send
  row shows **"Filled in Messages — review and Send."**
- Without it (or if the extension hit an error): the tab opens, the body
  lands in your clipboard, and the Send row shows
  **"Copied — paste in Messages."** Paste manually.

The clipboard write happens either way as a safety net, so you never lose
the body if something goes wrong.

## When to update selectors

Messages-for-Web is shipped by Google and the DOM can change without
warning. The extension watches three attributes; if any disappear, the
extension silently fails over to the clipboard path and the Bushel admin
will show "Copied — paste in Messages" instead of "Filled."

The selectors live at the top of `content-script.js`:

```js
const SELECTORS = {
  startChat:        "a[data-e2e-start-button]",
  recipientInput:   "input[data-e2e-contact-input]",
  composeTextarea:  "textarea[data-e2e-message-input-box]",
};
```

To fix: open Messages for Web, DevTools → Elements, find the equivalent
elements, swap the selectors, and reload the extension card.

## Not in scope

- Auto-clicking Send. Operator-in-the-loop per DEC-026.
- Web Store publishing. Sideload only — one operator, one machine.
- iOS/Safari. Chromium only.
