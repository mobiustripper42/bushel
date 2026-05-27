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
    const startChat = document.querySelector(SELECTORS.startChat);
    if (!startChat) throw new Error("no-start-chat-trigger");
    startChat.click();

    const recipient = await waitFor(SELECTORS.recipientInput, 5000);
    setInputValue(recipient, toUsLocal(phone));
    recipient.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    const compose = await waitFor(SELECTORS.composeTextarea, 5000);
    setInputValue(compose, body);
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
