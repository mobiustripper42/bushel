// Bushel SMS Helper — content script for messages.google.com/web/*
//
// Reads phone + body from the URL hash and drives the Messages-for-Web DOM
// to open a new conversation pre-filled. Operator clicks Send manually.
//
// Hash format set by admin (src/components/admin/send-row.tsx):
//   #bushel-sms=<base64(JSON.stringify({phone, body}))>
//
// Hash transport (not postMessage) because Messages-for-Web sends a
// Cross-Origin-Opener-Policy header that severs window.opener and silently
// drops cross-tab postMessages from the admin tab. The hash survives the
// MWS redirect to /web/u/0/conversations.

(function () {
  console.log("[Bushel SMS Helper] content script loaded on " + location.href);

  const HASH_PREFIX = "#bushel-sms=";

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

  function readPayloadFromHash() {
    const hash = location.hash || "";
    if (!hash.startsWith(HASH_PREFIX)) return null;
    const encoded = hash.slice(HASH_PREFIX.length);
    try {
      const json = decodeURIComponent(escape(atob(encoded)));
      const obj = JSON.parse(json);
      if (typeof obj.phone === "string" && typeof obj.body === "string") return obj;
    } catch (e) {
      console.warn("[Bushel SMS Helper] failed to decode hash payload", e);
    }
    return null;
  }

  const payload = readPayloadFromHash();
  if (!payload) {
    console.log("[Bushel SMS Helper] no bushel-sms hash; idle");
    return;
  }

  // Clear the hash so the URL bar isn't littered + so a manual page reload
  // doesn't re-fire the fill flow.
  try {
    history.replaceState(null, "", location.pathname + location.search);
  } catch {
    // Non-fatal — fill still works, URL just stays dirty.
  }

  console.log("[Bushel SMS Helper] filling for", payload.phone);
  fillNewConversation(payload.phone, payload.body).catch((err) => {
    console.warn("[Bushel SMS Helper] fill failed", err);
  });
})();
