# WhatsApp Shield 🛡

A Chrome extension that blurs stickers, images, and GIFs on WhatsApp Web until you choose to reveal them. Built for classroom, office, and public settings where someone nearby might see your screen.

The main motivation for this extension was stickers. WhatsApp now gives better control for auto-download of photos, videos, and other media, but stickers can still appear instantly in chats. This extension helps hide those stickers (and other media) until you explicitly reveal them.

---

## How to install (Developer Mode)

1. Unzip this folder somewhere on your computer
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle, top-right)
4. Click **Load unpacked**
5. Select this folder (`whatsapp-shield/`)
6. Open **web.whatsapp.com** — the shield activates automatically

---

## How it works

- All stickers, images, and GIFs on WhatsApp Web are **blurred by default**
- Click (or hover, if you enable that) the **👁 Reveal** button to see a specific item
- Press **Shift + H** anywhere on the page to instantly blur the entire chat panel (panic mode)
- Press **Shift + H** again to un-panic

---

## Settings (click the extension icon)

| Setting | Default | Description |
|---|---|---|
| Shield ON/OFF | ON | Master switch |
| Blur stickers | ON | Blur sticker messages |
| Blur images | ON | Blur photo messages |
| Blur GIFs | ON | Blur animated GIFs |
| Reveal on hover | OFF | Hover to reveal instead of click |

---

## Limitations

- Works on **WhatsApp Web only** (`web.whatsapp.com`), not the desktop app
- WhatsApp Web uses obfuscated class names that can change — if blur stops working after a WhatsApp update, the selectors in `content.js` may need updating
- Does not perform NSFW detection — all media is blurred by default (this is intentional)

---

## Project structure

```
whatsapp-shield/
├── manifest.json      Chrome extension manifest v3
├── content.js         Main logic: blur, reveal, panic mode
├── content.css        CSS injected early to prevent flash
├── popup.html         Extension popup UI
├── popup.js           Popup settings logic
├── background.js      Service worker (relays messages)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```
