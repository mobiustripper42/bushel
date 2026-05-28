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
        // Focus or open MWS via chrome.tabs.* — admin can't manage the tab
        // via window.open because Cross-Origin-Opener-Policy on
        // messages.google.com blocks both named-target reuse and any cross
        // -tab communication. chrome.tabs operates at the browser level,
        // not subject to COOP.
        try {
          const existing = await chrome.tabs.query({
            url: "https://messages.google.com/web/*",
          });
          if (existing.length > 0 && existing[0].id) {
            const tab = existing[0];
            await chrome.tabs.update(tab.id, { active: true });
            if (tab.windowId) {
              chrome.windows.update(tab.windowId, { focused: true });
            }
            // Reload so the content script re-runs and consumes the fresh
            // payload. Without the reload, focusing an already-loaded MWS
            // tab leaves the old (empty / previously consumed) state.
            await chrome.tabs.reload(tab.id);
          } else {
            await chrome.tabs.create({
              url: "https://messages.google.com/web/conversations",
              active: true,
            });
          }
        } catch (err) {
          console.warn("[Bushel SMS Helper] tab focus/open failed", err);
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
