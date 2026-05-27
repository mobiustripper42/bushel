// Bushel SMS Helper — content script for messages.google.com/web/*
//
// Listens for postMessage from the Bushel admin tab and drives the
// Messages-for-Web DOM to open a new conversation pre-filled with the
// customer's phone + the SMS body. The operator still clicks Send.
//
// Contract (from src/components/admin/send-row.tsx):
//   inbound:  { type: "bushel-sms", phone: "+15555551234", body: "..." }
//   outbound: { type: "bushel-sms-ok" }
//             { type: "bushel-sms-error", reason: "..." }

(function () {
  const ALLOWED_ORIGINS = [
    "https://order.baybranchfarm.com",
    "https://preview.baybranchfarm.com",
    "http://localhost:3001",
  ];

  const SELECTORS = {
    startChat: "a[data-e2e-start-button]",
    recipientInput: "input[data-e2e-contact-input]",
    composeTextarea: "textarea[data-e2e-message-input-box]",
  };

  // DB stores E.164 (+1XXXXXXXXXX). Messages-for-Web's recipient input strips
  // the +1 prefix on its own, but typing it sometimes confuses the contact
  // matcher — strip to a 10-digit US local number before fill.
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

  // Angular Material listens for native `input` events on `<input>` /
  // `<textarea>` via its FormControl bridge — setting `.value` alone is a
  // no-op. Assign + dispatch is enough; no React-internals trick needed.
  function setInputValue(el, value) {
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function fillNewConversation(phone, body) {
    const startChat = document.querySelector(SELECTORS.startChat);
    if (!startChat) throw new Error("no-start-chat-trigger");
    startChat.click();

    const recipient = await waitFor(SELECTORS.recipientInput, 2000);
    setInputValue(recipient, toUsLocal(phone));
    recipient.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    const compose = await waitFor(SELECTORS.composeTextarea, 2000);
    setInputValue(compose, body);
    // Do NOT submit. Operator clicks Send manually so she can edit / cancel.
  }

  window.addEventListener("message", (event) => {
    if (!ALLOWED_ORIGINS.includes(event.origin)) return;
    const data = event.data;
    if (!data || data.type !== "bushel-sms") return;
    if (typeof data.phone !== "string" || typeof data.body !== "string") return;

    const reply = (msg) => {
      if (event.source && typeof event.source.postMessage === "function") {
        event.source.postMessage(msg, event.origin);
      }
    };

    fillNewConversation(data.phone, data.body)
      .then(() => reply({ type: "bushel-sms-ok" }))
      .catch((err) => {
        reply({
          type: "bushel-sms-error",
          reason: err && err.message ? err.message : "unknown",
        });
      });
  });
})();
