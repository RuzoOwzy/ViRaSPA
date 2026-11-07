# Testing on phones and other browsers

Three levels, from quickest to most real. Use the first while you work, the second before a release, and the third for anything touch- or keyboard-heavy.

## 1. Automatic: other engines and phone profiles

`test.js` runs the browser tests through [Playwright](https://playwright.dev) when you ask for an engine or a device. Playwright is installed once, **outside** your project (the project stays free of npm packages):

```bash
mkdir D:\tools\playwright && cd D:\tools\playwright && npm init -y && npm install playwright
```

```bash
npx playwright install firefox webkit
```

Then, from your repository root:

```bash
node node-tools/test.js --no-node --engine firefox,webkit --playwright-folder D:\tools\playwright
```

```bash
node node-tools/test.js --no-node --device "iPhone 15,Pixel 7" --playwright-folder D:\tools\playwright
```

- `--engine chromium` uses the installed Edge or Chrome, so Playwright's own Chromium (about 740 MB) isn't needed.
- A device uses its own engine (iPhone: WebKit, Safari's engine; Pixel: Chromium) with its screen size, pixel ratio, touch and user agent.
- `--bundled` works with both, to test the bundled copy.
- CI runs Firefox, WebKit, iPhone 15 and Pixel 7 on every push.

Firefox and WebKit on Windows took about 550 MB.

## 2. By hand: DevTools device mode

In Edge or Chrome, open DevTools (F12), then the device toolbar (Ctrl+Shift+M). Pick a phone, reload, and check:

| Check | What to look for |
| --- | --- |
| No sideways scrolling | Swipe left/right on every page: nothing should move. |
| Header | Brand, menu button, language picker and sign-in fit on one line and are readable. |
| Menu | The menu button opens the menu; choosing a page navigates and closes it; Escape closes it. |
| Text | Body text at least 16 px; nothing cut off; long words (emails, links) wrap. |
| Touch targets | Buttons and links at least about 44 × 44 px, not too close together. |
| Forms | The right keyboard per field (`type="email"`, `inputmode="decimal"`); labels stay visible; the page doesn't zoom when a field gets focus (font size 16 px or more). |
| Tables | Wide tables scroll inside their own box, not the page. |
| Rotation | Turn the device (the rotate button): the layout still works. |
| Slow network | Network tab, "Slow 4G": the busy indicator shows; nothing jumps when content arrives. |
| Dark text on dark, light on light | Native controls (selects, date pickers) look different per browser: check contrast. |

DevTools emulates the screen and touch, not the phone's browser engine: Safari-only differences need level 1 (WebKit) or 3.

## 3. A real phone on your network

```bash
node node-tools/serve.js --host 0.0.0.0 --port 8030
```

Open `http://<your computer's IP>:8030` on the phone (same Wi-Fi; allow the port through the firewall if asked). Check the same list as above, plus:

- the on-screen keyboard doesn't cover the field being typed in;
- the back gesture/button moves between pages as expected;
- pinch-zoom still works (never disabled);
- with a Bluetooth keyboard: Tab order and Enter behave as on a computer.

Remote debugging: Chrome on Android with `chrome://inspect` on the computer; Safari on iPhone needs a Mac (Develop menu).
