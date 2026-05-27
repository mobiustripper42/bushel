// Bushel SMS Helper — content script for messages.google.com/web/*
//
// On load, asks the service worker (via chrome.runtime.sendMessage) for a
// pending {phone, body} payload deposited by the bridge content script on
// the admin tab. If present, drives the MWS DOM to open a new conversation
// and pre-fills recipient + body. Operator clicks Send manually.

(function () {
  console.log("[Bushel SMS Helper] content script loaded on " + location.href);

  const SELECTORS = {
    startChat: "a[data-e2e-start-button]",
    recipientInput: "input[data-e2e-contact-input]",
    composeTextarea: "textarea[data-e2e-message-input-box]",
  };

  // DB stores E.164 (+1XXXXXXXXXX). MWS recipient input prefers 10-digit US
  // local; the +1 prefix sometimes confuses the contact matcher. Strip it.
  function toUsLocal(e164) {
    return String(e164 || "").replace(/^\+1/, "").replace(/\D/g, "");
  }

  function waitFor(selector, timeoutMs) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          clearTimeout(timer);
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error("timeout"));
      }, timeoutMs);
    });
  }

  // Angular Material listens for native `input` events on <input> / <textarea>
  // via its FormControl bridge — setting `.value` alone is a no-op. Assign +
  // dispatch is enough; no React-internals trick needed.
  function setInputValue(el, value) {
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function fillNewConversation(phone, body) {
    const log = (...args) => console.log("[Bushel SMS Helper]", ...args);

    log("step 1: find Start Chat");
    const startChat = document.querySelector(SELECTORS.startChat);
    if (!startChat) throw new Error("no-start-chat-trigger");

    log("step 2: clicking Start Chat — href:", startChat.getAttribute("href"));
    startChat.click();

    // Small wait so the SPA can route; helps subsequent URL log reflect the
    // post-click state instead of the pre-click one.
    await new Promise((r) => setTimeout(r, 100));
    log("step 3: URL after click:", location.href);

    log("step 4: waiting for recipient input");
    const recipient = await waitFor(SELECTORS.recipientInput, 5000);
    log("step 5: recipient found, setting value to", toUsLocal(phone));
    setInputValue(recipient, toUsLocal(phone));
    log("step 6: recipient.value after set:", recipient.value);

    recipient.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    log("step 7: Enter dispatched");

    log("step 8: waiting for compose textarea");
    const compose = await waitFor(SELECTORS.composeTextarea, 5000);
    log("step 9: compose found, setting value (len", body.length, ")");
    setInputValue(compose, body);
    log("step 10: compose.value after set (len):", compose.value.length);
    // Do NOT submit. Operator clicks Send so she can edit / cancel.
  }

  chrome.runtime.sendMessage({ type: "consume" }, (payload) => {
    if (chrome.runtime.lastError) {
      console.warn(
        "[Bushel SMS Helper] consume failed",
        chrome.runtime.lastError.message,
      );
      return;
    }
    if (!payload) {
      console.log("[Bushel SMS Helper] no pending fill; idle");
      return;
    }
    console.log("[Bushel SMS Helper] filling for", payload.phone);
    fillNewConversation(payload.phone, payload.body).catch((err) => {
      console.warn("[Bushel SMS Helper] fill failed", err);
    });
  });
})();
