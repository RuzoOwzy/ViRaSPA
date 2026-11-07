# N8 report · Basic components

## Done

13 components in ViRaSPA-Extensions, each with its manifest, README, styles and template, installed in the sample and shown on its new `/showcase` page:

| Component | Highlights |
| --- | --- |
| `vs-popup` + `Viraspa.popup` | native `<dialog>`; alert/confirm/prompt/flash/drop/open returning promises, queued; focus kept inside and returned; `vs-cancel` can stop a close |
| `vs-input-number` | the user's number format; filtered typing; paste cleaning ("TZS 2.500,75" → 2500.75); steps with keys or spin buttons; min/max validity |
| `vs-input-date` | typed dates in the language's order; calendar with day/month/year views and full keyboard; min/max/disabled days; date, month, datetime |
| `vs-input-password` | scoped (password managers find it); show/hide; Caps Lock warning; strength meter |
| `vs-input-color` | swatches, recent colours, hex, the full picker, an eyedropper where supported |
| `vs-textarea` | grows (native `field-sizing` where available); max rows; overlap mode; count; optional submit key |
| `vs-select` | options from children or a property; filter box; multiple with chips; groups; type-ahead; Escape restores |
| `vs-select-search` | from a server handler (debounced, cancelled, late answers ignored, retry), a list or a table; columns; free text |
| `vs-tabs` | ARIA tabs; vertical; manual activation; remembered tab; lazy panels |
| `vs-tooltip` | rich content that stays while hovered; focus and Escape |
| `vs-context-menu` | right-click, long press, Menu key/Shift+F10; `vs-menu-open` to adjust items |
| `vs-progress` | bar, ring, dots; determinate or not; in CSS |
| `vs-countdown` | to a moment or for seconds; formats; tick/finished events |

Framework additions they needed: `delegatesFocus`, `labelText()`, `dom.position()`/`follow()`/`uid()`, `startup.components`.

## Problems found and fixed during the review

- **Early properties hid setters** (framework): `$("#customer").source = fn` ran before `<vs-select-search>` was defined, leaving a plain property that hid the component's setter, so the search used the wrong data. Components now re-apply such properties through their setters when they start.
- **`vs-popup` didn't load:** it used `this.title`, a built-in element property (a string). Renamed.
- **`vs-tabs` "remember" never worked** for panels without ids: it saved a generated id that changes each time. It now saves the position.
- **`vs-input-number`:** text inserted several characters at once (autofill, some keyboards) was refused when one character was invalid; it is now cleaned like a paste. The parser was rewritten with clear rules after a European-formatted paste read as 2.5.
- **`vs-input-password`** moved from Shadow DOM to scoped isolation, so password managers and `<label for>` work (the same reason as `vs-login-form`).
- **CSP:** `vs-countdown` and `vs-input-color` no longer use inline `style` attributes in HTML text.

## Verified

- Browser tests: 60 pass (10 new component tests) in Edge (plain and bundled), Firefox 159 and WebKit 27.2.
- On the sample's `/showcase` (Edge, real key presses): `vs-select` opens with Down, filters "mbe" to Mbeya, Enter chooses, Escape keeps the earlier choice; `vs-select-search` asks the demo API after typing "le", lists five people with their email, arrow and Enter choose (value "3"); `vs-input-date` turns "11-30-26" into 2026-11-30, Alt+Down opens the calendar on that day with Sundays disabled, arrows cross into December, Enter chooses; `vs-input-color` picks a swatch with arrows and Enter and remembers it; the context menu opens with Shift+F10, arrows and Enter choose "edit", focus returns; tabs move with arrows, skip the disabled tab and create the lazy panel; every popup returns the right result and the queue shows one alert at a time; the number field steps, refuses letters and reports "must be 99 or less".
- `install.js verify`: every pinned package matches.
