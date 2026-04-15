/**
 * WhatsApp Shield - Content Script
 * Runs on https://web.whatsapp.com/*
 *
 * Strategy:
 *  - Use MutationObserver to catch every new message node added to the DOM
 *  - For each message, find sticker/image/GIF elements
 *  - Wrap them with a blur overlay + Reveal button
 *  - Panic shortcut (Shift+H) blurs the entire chat panel
 *  - Settings stored in chrome.storage.local
 */

(function () {
  "use strict";

  // ─── State ────────────────────────────────────────────────────────────────
  let settings = {
    enabled: true,          // master toggle
    blurImages: true,       // blur regular images
    blurStickers: true,     // blur stickers
    blurGifs: true,         // blur GIFs
    revealMode: "click",    // "click" | "hover"
    panicKey: "H",          // Shift + this key
    disabledChats: [],      // array of chat IDs where shield is off
  };

  let panicActive = false;
  let panicBanner = null;
  let observer = null;

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    loadSettings(() => {
      if (!settings.enabled) return;
      createPanicBanner();
      startObserver();
      scanExisting();
      registerKeyboardShortcut();
      listenForMessages();
    });
  }

  function loadSettings(cb) {
    chrome.storage.local.get("waShieldSettings", (data) => {
      if (data.waShieldSettings) {
        settings = { ...settings, ...data.waShieldSettings };
      }
      cb();
    });
  }

  function saveSettings() {
    chrome.storage.local.set({ waShieldSettings: settings });
  }

  // ─── Listen for messages from popup ───────────────────────────────────────
  function listenForMessages() {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "SETTINGS_UPDATED") {
        settings = { ...settings, ...msg.settings };
        saveSettings();
        if (!settings.enabled) {
          removeAllShields();
        } else {
          scanExisting();
        }
      }
      if (msg.type === "PANIC_TOGGLE") {
        togglePanic();
      }
    });
  }

  // ─── MutationObserver ─────────────────────────────────────────────────────
  function startObserver() {
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          processNode(node);
        }
      }
    });

    // Observe the whole document body - we'll scope processing to message nodes
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function scanExisting() {
    // Scan all existing message nodes on load
    const candidates = findMediaElements(document.body);
    candidates.forEach(shieldElement);
  }

  // ─── Element detection ────────────────────────────────────────────────────
  /**
   * Detect media elements inside a root node.
   * We use structural/behavioral detection rather than fragile class names.
   */
  function findMediaElements(root) {
    const results = [];

    // --- Stickers ---
    // WhatsApp Web stickers: img elements inside message bubbles
    // They typically have no alt text or alt="sticker", width/height around 100-200px
    if (settings.blurStickers) {
      const imgs = root.querySelectorAll
        ? root.querySelectorAll('img[src*="sticker"], img[alt="sticker"], img[data-testid*="sticker"]')
        : [];
      imgs.forEach((el) => {
        if (!isAlreadyShielded(el)) results.push({ el, type: "sticker" });
      });

      // Broader: detect sticker containers via data attributes
      const stickerContainers = root.querySelectorAll
        ? root.querySelectorAll('[data-testid="media-sticker-wrapper"], [class*="sticker"]')
        : [];
      stickerContainers.forEach((el) => {
        const img = el.querySelector("img, canvas");
        if (img && !isAlreadyShielded(img)) results.push({ el: img, type: "sticker" });
      });
    }

    // --- Regular images in messages ---
    if (settings.blurImages) {
      const imgWrappers = root.querySelectorAll
        ? root.querySelectorAll(
            '[data-testid="image-thumb"], [data-testid="media-viewer-img-wrapper"] img, ' +
            'img[src*="blob:"], .message-image, [data-testid*="image"]'
          )
        : [];
      imgWrappers.forEach((el) => {
        if (!isAlreadyShielded(el)) results.push({ el, type: "image" });
      });
    }

    // --- GIFs ---
    if (settings.blurGifs) {
      const gifs = root.querySelectorAll
        ? root.querySelectorAll('[data-testid="gif"], video[src*="gif"], img[src*=".gif"]')
        : [];
      gifs.forEach((el) => {
        if (!isAlreadyShielded(el)) results.push({ el, type: "gif" });
      });
    }

    // --- Generic fallback: any img inside a message bubble that looks like media ---
    // We do this last and deduplicate by element reference
    const seen = new Set(results.map((r) => r.el));
    const messageBubbles = root.querySelectorAll
      ? root.querySelectorAll(
          '[data-testid="msg-container"], [data-testid="conversation-panel-messages"] [role="row"]'
        )
      : [];

    messageBubbles.forEach((bubble) => {
      bubble.querySelectorAll("img, video, canvas").forEach((el) => {
        // Skip avatars (round, small images)
        if (isAvatar(el)) return;
        if (!seen.has(el) && !isAlreadyShielded(el)) {
          seen.add(el);
          results.push({ el, type: "media" });
        }
      });
    });

    return results;
  }

  function isAvatar(el) {
    // Avatars are typically small circular images
    const style = window.getComputedStyle(el);
    const w = el.offsetWidth || parseInt(style.width);
    const h = el.offsetHeight || parseInt(style.height);
    if (w < 50 && h < 50) return true;
    if (style.borderRadius === "50%" || el.closest('[data-testid*="avatar"]')) return true;
    return false;
  }

  function isAlreadyShielded(el) {
    return el.closest(".wa-shield-wrapper") !== null || el.hasAttribute("data-wa-shield");
  }

  function processNode(node) {
    if (!settings.enabled) return;
    const candidates = findMediaElements(node);
    candidates.forEach(shieldElement);
  }

  // ─── Shield / Unshield ────────────────────────────────────────────────────
  function shieldElement({ el, type }) {
    if (isAlreadyShielded(el)) return;
    if (isPanicActive()) return; // panic mode handles this globally

    el.setAttribute("data-wa-shield", type);

    // Wrap in a relative container
    const wrapper = document.createElement("span");
    wrapper.className = "wa-shield-wrapper";
    wrapper.setAttribute("data-wa-shield-wrapper", "true");

    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);

    // Blur the element
    el.classList.add("wa-shield-blurred");

    // Overlay with reveal button
    const overlay = document.createElement("span");
    overlay.className = "wa-shield-overlay";

    const btn = document.createElement("button");
    btn.className = "wa-shield-btn";
    btn.textContent = "👁 Reveal";
    overlay.appendChild(btn);
    wrapper.appendChild(overlay);

    // Reveal interaction
    const revealFn = (e) => {
      e.stopPropagation();
      revealElement(el, overlay);
    };

    if (settings.revealMode === "hover") {
      overlay.addEventListener("mouseenter", revealFn);
    } else {
      overlay.addEventListener("click", revealFn);
      btn.addEventListener("click", revealFn);
    }
  }

  function revealElement(el, overlay) {
    el.classList.remove("wa-shield-blurred");
    overlay.remove();
    el.removeAttribute("data-wa-shield");

    // Re-hide after 8 seconds (optional auto-rehide)
    setTimeout(() => {
      if (!el.hasAttribute("data-wa-shield") && !isAlreadyShielded(el)) {
        // Don't re-shield if user explicitly revealed; this is optional behavior
        // Uncomment below to auto-rehide:
        // el.classList.add("wa-shield-blurred");
      }
    }, 8000);
  }

  function removeAllShields() {
    document.querySelectorAll("[data-wa-shield]").forEach((el) => {
      el.classList.remove("wa-shield-blurred");
      el.removeAttribute("data-wa-shield");
      const wrapper = el.closest(".wa-shield-wrapper");
      if (wrapper) {
        wrapper.querySelector(".wa-shield-overlay")?.remove();
        wrapper.parentNode.insertBefore(el, wrapper);
        wrapper.remove();
      }
    });
  }

  // ─── Panic Mode ───────────────────────────────────────────────────────────
  function createPanicBanner() {
    panicBanner = document.createElement("div");
    panicBanner.className = "wa-shield-panic-banner";
    panicBanner.textContent = "🛡 Shield active — press Shift+" + settings.panicKey + " to reveal";
    document.body.appendChild(panicBanner);
  }

  function isPanicActive() {
    return panicActive;
  }

  function activatePanic() {
    panicActive = true;
    document.body.classList.add("wa-shield-panic");
    if (panicBanner) {
      panicBanner.classList.add("visible");
    }
  }

  function deactivatePanic() {
    panicActive = false;
    document.body.classList.remove("wa-shield-panic");
    if (panicBanner) {
      panicBanner.classList.remove("visible");
    }
  }

  function togglePanic() {
    if (panicActive) {
      deactivatePanic();
    } else {
      activatePanic();
    }
  }

  // ─── Keyboard shortcut ────────────────────────────────────────────────────
  function registerKeyboardShortcut() {
    document.addEventListener("keydown", (e) => {
      if (e.shiftKey && e.key === settings.panicKey) {
        e.preventDefault();
        togglePanic();
      }
    });
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
