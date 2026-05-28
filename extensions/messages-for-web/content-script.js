// Bushel SMS Helper — content script for messages.google.com/web/*
//
// On load, asks the service worker (via chrome.runtime.sendMessage) for a
// pending {phone, body} payload deposited by the bridge content script on
// the admin tab. If present, drives the MWS DOM to open a new conversation
// and pre-fills recipient + body. Operator clicks Send manually.

(function () {
  const SELECTORS = {
    startChat: "a[data-e2e-start-button]",
    recipientInput: "input[data-e2e-contact-input]",
    // MWS's contact-suggestion row contains a span.anon-contact-name with the
    // dialed digits. Synthetic Enter keypresses get filtered (isTrusted=false),
    // so we click the suggestion instead. Bubbles up to whichever ancestor
    // owns the click handler.
    contactSuggestion: ".anon-contact-name",
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

  // Wake the framework's FormControl. Plain `el.value = ...` updates the DOM
  // property but skips the change-detection path Angular uses to mirror the
  // value into NgModel — MWS then clears the visible text on next render.
  // The native value setter (called via the prototype descriptor) bypasses
  // some framework wrappers that hide writes, and the InputEvent with
  // inputType "insertText" matches what real keyboard typing dispatches,
  // which is what Angular's FormControl listens for.
  function setInputValue(el, value) {
    el.focus();
    // Prefer execCommand("insertText") — it produces the most faithful,
    // browser-generated InputEvent and updates Angular's FormControl the same
    // way a keystroke would. Select-all first so it replaces existing text.
    el.select?.();
    const ok = document.execCommand("insertText", false, value);
    if (ok && el.value === value) {
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    // Fallback: native prototype setter + synthetic InputEvent.
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(
      new InputEvent("input", {
        inputType: "insertText",
        data: value,
        bubbles: true,
      }),
    );
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function fillNewConversation(phone, body) {
    // Open the new-conversation view (Start Chat may not be in the DOM yet on
    // a cold MWS load, so wait for it).
    const startChat = await waitFor(SELECTORS.startChat, 10000);
    startChat.click();

    // Fill the recipient, then click the contact suggestion. A synthetic
    // Enter keypress is isTrusted=false and MWS's picker ignores it, so we
    // click the suggestion row instead.
    const recipient = await waitFor(SELECTORS.recipientInput, 5000);
    setInputValue(recipient, toUsLocal(phone));

    const suggestion = await waitFor(SELECTORS.contactSuggestion, 5000);
    const clickTarget =
      suggestion.closest('[role="option"], mat-option, li, button') || suggestion;
    clickTarget.click();

    // Let Angular attach its ControlValueAccessor to the freshly-rendered
    // compose field before we write. Writing too early lets MWS's first
    // change-detection pass reset the textarea to its empty model value —
    // this delay is load-bearing, not cosmetic.
    const compose = await waitFor(SELECTORS.composeTextarea, 5000);
    await new Promise((r) => setTimeout(r, 600));
    setInputValue(compose, body);
    // Do NOT submit. Operator clicks Send so she can edit / cancel.
  }

  chrome.runtime.sendMessage({ type: "consume" }, (payload) => {
    if (chrome.runtime.lastError || !payload) return;
    fillNewConversation(payload.phone, payload.body).catch((err) => {
      // Selector drift is the most likely failure; surface it for debugging.
      // The admin clipboard fallback covers the operator either way.
      console.warn("[Bushel SMS Helper] fill failed:", err.message);
    });
  });
})();
