// Bushel SMS Helper — service worker.
//
// Two RPCs over chrome.runtime.sendMessage:
//   - "deposit" (from bridge.js on admin tab): stash {phone, body} for the
//     next MWS tab to consume.
//   - "consume" (from content-script.js on MWS tab load): pop and return
//     the pending payload.
//
// State lives in chrome.storage.session — survives service worker idle
// termination (which is aggressive in MV3) and is cleared when the browser
// closes, so no stale customer data persists.

const STORAGE_KEY = "pending-fill";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg.type !== "string") return false;

  if (msg.type === "deposit") {
    if (typeof msg.phone !== "string" || typeof msg.body !== "string") {
      sendResponse({ ok: false, reason: "bad-payload" });
      return false;
    }
    chrome.storage.session
      .set({ [STORAGE_KEY]: { phone: msg.phone, body: msg.body } })
      .then(async () => {
        // Force any existing MWS tab to reload so the content script re-runs
        // and consumes the new payload. Tabs still mid-load don't need it —
        // their initial content-script run will pick it up.
        try {
          const tabs = await chrome.tabs.query({
            url: "https://messages.google.com/web/*",
          });
          for (const tab of tabs) {
            if (tab.id && tab.status === "complete") {
              chrome.tabs.reload(tab.id);
            }
          }
        } catch {
          // Tab API unavailable in odd contexts — payload's still in storage.
        }
        sendResponse({ ok: true });
      })
      .catch((err) => sendResponse({ ok: false, reason: String(err) }));
    return true;
  }

  if (msg.type === "consume") {
    chrome.storage.session
      .get(STORAGE_KEY)
      .then(async (data) => {
        const payload = data[STORAGE_KEY] || null;
        if (payload) {
          await chrome.storage.session.remove(STORAGE_KEY);
        }
        sendResponse(payload);
      })
      .catch(() => sendResponse(null));
    return true;
  }

  return false;
});
