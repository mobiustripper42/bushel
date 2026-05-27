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

  // Use document.execCommand("insertText") so MWS's Angular FormControl picks
  // up the change. Plain `.value = ...` updates the DOM property but doesn't
  // dispatch the InputEvent that NgModel binds to, so on next render MWS
  // clears the textarea back to the FormControl's empty state. Selecting all
  // first replaces any existing content.
  function setInputValue(el, value) {
    el.focus();
    el.select();
    const ok = document.execCommand("insertText", false, value);
    if (!ok) {
      // execCommand deprecated/disabled; fall back to native setter + event.
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  async function fillNewConversation(phone, body) {
    const log = (...args) => console.log("[Bushel SMS Helper]", ...args);

    log("step 1: waiting for Start Chat");
    const startChat = await waitFor(SELECTORS.startChat, 10000);

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

    log("step 7: waiting for contact suggestion");
    const suggestion = await waitFor(SELECTORS.contactSuggestion, 5000);
    // Click the closest interactive ancestor — span itself may not have the
    // handler, but a button/li wrapper above it does. Fall back to the span
    // for click-bubbling if no obvious ancestor.
    const clickTarget =
      suggestion.closest('[role="option"], mat-option, li, button') || suggestion;
    log("step 7b: clicking suggestion via", clickTarget.tagName, clickTarget.className);
    clickTarget.click();

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
