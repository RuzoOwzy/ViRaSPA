# M4 verification report

**Date:** 2026-11-07.

**How it was checked:**
- `node node-tools/test.js`, which runs the Node tests and the browser tests in headless Edge;
- the preview on port 8028 in the in-app browser (Chromium), stopped afterwards.

Port 8027 was not touched.

## Automated tests: 54 passed, 0 failed

| Suite | Tests | Covers |
| --- | --- | --- |
| Node: `tests/node/framework.test.js` | 16 | Signals (re-run, lazy computed, batch, scopes, cleanup), expressions (operators, members, literals, signals, `this` in calls, pipes, blocked prototypes, template splitting), formats (patterns, presets, date-only strings, currency, number, percent, relative, preference precedence), i18n (interpolation, plurals, direction), manifest rules (version precedence, reserved prefixes, `--vs-` definitions) |
| Node: `tests/node/tools.test.js` | 7 | Flag/config naming and help, zip round trip and checksums, globs, the route loader, server rules, download-source locations, prerender head tags |
| Browser: `ViRaSPA/tests/run.html` | 31 | Bindings (escaping, raw, literal braces, attributes and booleans, URL safety, show-if, if, keyed repeat with row reuse, two-way, events with arguments, computed values with pipes, disposal), components (`vs-card` shadow, `app-note` scoped slot, `vs-icon` Lucide, reserved prefix, effects disposed on removal), session (login, wrong password, `canAccess`, privilege attributes, expiry with a fake clock, `mockEndpoint`), i18n (plurals, `setLocale` with `t()`, `data-i18n` and `lang`, fallback, formats per language, right-to-left), router (navigation and head tags, private redirect, not-found, frozen core) |

## Checked by hand in the preview

| Check | Result |
| --- | --- |
| Live Demo: three rows, total TZS 46,500; Add stays disabled until a name is typed; adding "Tea 500 g" at 60,000 gives four rows, the total TZS 106,500 and the free-delivery note (`data-bind-if`); the name field clears | Pass |
| Removing a row keeps the other rows' elements (keyed); removing all shows "The cart is empty.", "0 items" and hides the note | Pass |
| Formats: `07-Nov-2026`, `November 7, 2026`, `07/11/2026`, time, `3 days ago`, `1,234,567.89`, `$1,234.50`, `25.7%` | Pass |
| English plural "3 items"; Swahili: menus (Mwanzo, Vipengele, Onyesho Hai…), Sign In → Ingia, page text, the placeholder, "Bidhaa 3", "7 Novemba 2026", "siku 3 zilizopita", `lang="sw"`, choice remembered; back to English | Pass |
| Private app in Swahili: side menu (Dashibodi, Watumiaji, Mipangilio…) and user menu (Wasifu, Badilisha Nenosiri, Toka) | Pass |
| Regression: every page (Home, About, Contact, Features, Plain Native, Dashboard, Users, Settings, Profile, Change Credentials, Login) renders with no leftover `{{`, no console errors or warnings; literal `{{ }}` shown on Features | Pass |

## Not verified

- **The CI workflow on GitHub:** it runs when this is pushed; the result shows in the repository's Actions tab.
- **Other browsers:** Firefox and Safari weren't run, and the browser tests ran in Edge only.

## Deviations and notes

- **Folder for Node tests:** they live in `tests/node/` at the repository root (they test the tools too). The browser tests live in the served folder, `ViRaSPA/tests/`, so the browser can load them; `deploy.js` leaves `tests/` out.
- **Plurals in the default language:** they need that language's file. Set `file: true` on its locale entry (the sample's `app/i18n/en.json`).
- **Old string form kept:** `bindTemplate` (`{{key}}` filled once) stays for one-off text. Pages and components now use the binding service.
- **Added beyond the plan:** `node-tools/test.js`, so the tests run with one command locally and in CI.
