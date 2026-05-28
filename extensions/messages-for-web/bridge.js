// Bushel SMS Helper — admin-side bridge content script.
//
// Runs in ISOLATED world on bushel admin URLs. Listens for same-window
// postMessage events from admin's page JS (which can't talk to extension
// service workers directly, but page → same-window-isolated-content-script
// is the established Chrome pattern). Forwards the payload to the service
// worker, which stashes it in chrome.storage.session for the MWS content
// script to consume when MWS finishes loading.
//
// Same-window postMessage is required because:
//   - admin → MWS-tab postMessage is silently dropped by Cross-Origin-Opener
//     -Policy on messages.google.com
//   - admin can't write to chrome.storage directly; only extension code can
//   - admin doesn't know the extension ID to use chrome.runtime.sendMessage
//     externally (would require manifest "externally_connectable" + a fixed
//     extension key — possible but heavier than this bridge for one user)

(function () {
  window.addEventListener("message", (event) => {
    // Same-window only — never accept messages from other windows / origins.
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.type !== "bushel-sms-helper:fill") return;
    if (typeof data.phone !== "string" || typeof data.body !== "string") return;

    try {
      chrome.runtime.sendMessage(
        { type: "deposit", phone: data.phone, body: data.body },
        () => {
          if (chrome.runtime.lastError) {
            console.warn(
              "[Bushel SMS Helper] deposit failed",
              chrome.runtime.lastError.message,
            );
          }
        },
      );
    } catch (err) {
      // Extension was reloaded; this bridge is orphaned. Refresh the page
      // to re-inject a current bridge.
      console.warn(
        "[Bushel SMS Helper] bridge orphaned (extension reloaded?) — refresh this tab to re-link",
        err,
      );
    }
  });
})();
