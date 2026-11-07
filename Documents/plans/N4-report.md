# N4 report · Browsers and phones

## Done

| Item | Where |
| --- | --- |
| Playwright 1.65.0 with Firefox and WebKit, outside the project (550 MB; its own Chromium removed: Edge is used instead) | `F:\Development\ViRaSPA\Miscellaneous\playwright` |
| `test.js --engine`, `--device`, `--playwright-folder` (comma lists; combine with `--bundled`) | `node-tools/test.js` |
| CI job "other-browsers": Firefox, WebKit, iPhone 15, Pixel 7 | `.github/workflows/tests.yml` |
| Phone and browser testing guide with a DevTools checklist | [mobile-testing.md](../mobile-testing.md) |

## Results

| Run | Browser tests |
| --- | --- |
| Firefox 159.0 | 32 / 32 |
| WebKit 27.2 | 32 / 32 |
| iPhone 15 (WebKit) | 32 / 32 |
| Pixel 7 (Chromium = Edge 157) | 32 / 32 |
| Firefox with the iPhone 15 profile (no mobile viewport in Firefox) | 32 / 32 |
| Bundled copy in Firefox and WebKit | 32 / 32 each |

Beyond the tests, on iPhone 15 and Pixel 7 profiles: Home, Features, Live Demo and Login were screenshotted and looked at; no page scrolls sideways; the menu button opens the menu with a tap, and tapping a page navigates and closes it.

## Problems found and fixed

- **Language picker unreadable in Safari:** WebKit draws its own light background behind a native `<select>`, so the white text disappeared. The picker now uses `appearance: none` with its own arrow.
- **A 404 on every Live Demo visit:** `i18n: true` asked for `live-demo.i18n.en.json`, a file the default language doesn't need. Now `i18n: true` means every language except the default; a list names the languages exactly.
- **Test page noise:** the sample's startup files expect jQuery; the test page now loads it as `index.html` does.

## Not done

- No real phone was available; the guide explains how to test on one.
