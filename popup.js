// WhatsApp Shield - Popup Script

const defaultSettings = {
  enabled: true,
  blurImages: true,
  blurStickers: true,
  blurGifs: true,
  revealMode: "click",
  panicKey: "H",
  disabledChats: [],
};

let settings = { ...defaultSettings };

// ─── DOM refs ────────────────────────────────────────────────────────────────
const masterToggle = document.getElementById("masterToggle");
const blurStickers = document.getElementById("blurStickers");
const blurImages   = document.getElementById("blurImages");
const blurGifs     = document.getElementById("blurGifs");
const revealHover  = document.getElementById("revealHover");
const mainContent  = document.getElementById("mainContent");
const statusDot    = document.getElementById("statusDot");
const statusText   = document.getElementById("statusText");
const panicBtn     = document.getElementById("panicBtn");

// ─── Load settings ───────────────────────────────────────────────────────────
chrome.storage.local.get("waShieldSettings", (data) => {
  if (data.waShieldSettings) {
    settings = { ...defaultSettings, ...data.waShieldSettings };
  }
  applyToUI();
});

// ─── Apply settings → UI ─────────────────────────────────────────────────────
function applyToUI() {
  masterToggle.checked = settings.enabled;
  blurStickers.checked = settings.blurStickers;
  blurImages.checked   = settings.blurImages;
  blurGifs.checked     = settings.blurGifs;
  revealHover.checked  = settings.revealMode === "hover";
  updateStatus();
}

function updateStatus() {
  if (settings.enabled) {
    statusDot.classList.remove("off");
    statusText.textContent = "Shield active on WhatsApp Web";
    mainContent.classList.remove("disabled");
  } else {
    statusDot.classList.add("off");
    statusText.textContent = "Shield is off";
    mainContent.classList.add("disabled");
  }
}

// ─── Persist and relay ───────────────────────────────────────────────────────
function persist() {
  chrome.storage.local.set({ waShieldSettings: settings });
  chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings });
}

// ─── Event listeners ─────────────────────────────────────────────────────────
masterToggle.addEventListener("change", () => {
  settings.enabled = masterToggle.checked;
  updateStatus();
  persist();
});

blurStickers.addEventListener("change", () => {
  settings.blurStickers = blurStickers.checked;
  persist();
});

blurImages.addEventListener("change", () => {
  settings.blurImages = blurImages.checked;
  persist();
});

blurGifs.addEventListener("change", () => {
  settings.blurGifs = blurGifs.checked;
  persist();
});

revealHover.addEventListener("change", () => {
  settings.revealMode = revealHover.checked ? "hover" : "click";
  persist();
});

// Panic button in popup: send direct message to active WhatsApp tab
panicBtn.addEventListener("click", () => {
  chrome.tabs.query({ url: "https://web.whatsapp.com/*", active: true }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type: "PANIC_TOGGLE" }).catch(() => {});
    });
  });
  window.close();
});
