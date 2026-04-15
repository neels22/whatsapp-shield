// WhatsApp Shield - Background Service Worker

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SETTINGS_UPDATED") {
    // Relay to all WhatsApp Web tabs
    chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
      });
    });
  }
  return false;
});
