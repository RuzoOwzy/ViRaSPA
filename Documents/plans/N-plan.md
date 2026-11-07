# The N plan (N1–N11)

Approved by the project owner on 2026-11-08. It replaces the earlier draft `next-plan.md` and carries over the leftovers of the [M5 review](M5-review.md). The framework stays the **first version, 0.1.0, in development**: no releases, tags or version bumps unless the owner asks.

Each milestone runs the same way: implement, self-verify (tests plus a preview on a port other than the owner's 8027, stopped afterwards), review and fix, write a short report (`N<n>-report.md`), then commit and push.

| | Milestone | Status |
| --- | --- | --- |
| **N1** | Housekeeping: version 0.1.0 in development; repository renamed to ViRaSPA-Extensions; the `helper` kind; manifest `dependencies` | done, see [N1 report](N1-report.md) |
| **N2** | Bundle tool (classic files only) | done, see [N2 report](N2-report.md) |
| **N3** | Real servers: IIS (with URL Rewrite), Apache, nginx | planned |
| **N4** | Browsers and phones: Playwright with Chromium, Firefox, WebKit and phone profiles; a DevTools phone-mode checklist | planned |
| **N5** | GitHub Pages: a demo site for ViRaSPA-Extensions | planned |
| **N6** | Dynamic page previews: the optional Node helper | planned |
| **N7** | Study and foundations | planned |
| **N8** | Basic components (13) | planned |
| **N9** | Composite components (5) and the list-page example | planned |
| **N10** | Media viewer, image cropper, rich text editor v1 | planned |
| **N11** | Showcase, benchmark and review | planned |

## Decisions

### Classic scripts

The framework and app code stay **classic scripts**. ES modules give no real advantage here and would need an import map (extra tooling) to keep cache tokens working, a real bundler to join files, and would mix two load orders. Only addition: the asset loader can load a third-party library that ships only as a module (`type: "module"`), with no import map.

### Repository and package kinds

- **ViRaSPA-Extensions** (renamed from ViRaSPA-Components) holds the official optional packages: `components/<tag>/` and `helpers/<name>/`.
- **Helper** is a new installable kind: `helpers/<name>/helper-viraspa.json` with `namespace`, `scripts`, `styles`. Loaded from `startup.js` `helpers`, or automatically before a component that depends on it. Its `Viraspa.<namespace>` is locked once loaded.
- **Dependencies** in component and helper manifests: `[{ kind, name, version }]`; `install.js` installs missing ones.
- **Core keeps** what the framework or its own components rely on: signals, bindings, `format`, `i18n`, keyboard standard behaviour and the shortcuts registry, `Viraspa.templates`, the busy indicator with the thin top line.
- **Optional helpers:** `forms` (required, read-only, validation, caching values), `data-entry` (Enter moves on…), `filter`, `tooltip` (`data-tooltip` plus `vs-tooltip`).

### Naming

`vs-<family>-<variant>`, the plain family name being the most common variant:

| Family | Components |
| --- | --- |
| select | `vs-select` (fixed list, filter box), `vs-select-search` (type to search a list, a table column or the server), `vs-select-tree` |
| input | `vs-input-number`, `vs-input-date`, `vs-input-password`, `vs-input-color` |
| table | `vs-table` (display, `<td><div class="cell">`), `vs-table-entry` (data entry) |
| others | `vs-popup`, `vs-textarea`, `vs-tabs`, `vs-tooltip`, `vs-context-menu`, `vs-progress`, `vs-countdown`, `vs-pagination`, `vs-tree`, `vs-media-viewer`, `vs-image-cropper`, `vs-rich-text-editor` |

### Migration sources and scope

- **Newest sources:** the published CTC2Web-Backend `wwwroot` (`OwzyComponents.js`, `General.js`, 11 Sep 2026) first; then EliteWeb for the entry table, number inputs and the Chart of Accounts tree.
- **Only what will be used** (e.g. VSales moving to .NET plus ViRaSPA). Merged: popup + fullScreenPopup; selectX + dynamicCombofy + bindTextBoxDropDown; the image and general viewers + SVG zoom; the croppers. Dropped: FIITScroll, slideshow, FIITwaterMark, the `date` helper and `numberWithCommas` (covered by `Viraspa.format`), CKEditor add-ons, and `simplifyFilterPage` (tied to WebForms GridView pages; its ideas go into `vs-table` and a list-page example).
- **Progress:** `vs-progress` (bar, ring, dots, top line) and a YouTube-style thin top line in the core busy indicator (`busy.style: "top-line" | "overlay" | "both"`).

### Keyboard

- **Always on:** sensible Tab order, Enter/Space activate, arrows inside menus, lists, trees, tabs and tables, Escape closes, visible focus, focus trapped in popups and restored, a skip link.
- **Data-entry mode** (helper `data-entry`, opt-in per app, page or container): Enter → next field, Shift+Enter → previous, read-only fields skipped, select-on-focus for numbers, per-field `data-enter`.
- **Overrides:** the developer's handler always wins (the framework acts last and respects `preventDefault()`); `data-keys="native"` switches an area off; every key behaviour is a named action with a default key that can be moved or switched off (`table.keys = { addRow: false }`, `add-row-on-enter="off"`); settings stack component → app → page → element. Text areas and the editor keep normal editor keys (Enter = new line/paragraph); "next field" has no default key there. The `?` overlay lists the keys in use. No browser shortcuts are taken by default.

### Server handlers

One contract for anything that may need the server: the developer gives a function, the component handles debounce, cancelling (AbortSignal), loading, errors and retry. `table.source = async ({ page, pageSize, search, sort, filters, signal }) => ({ rows, total })`; the same pattern for `vs-select-search`, `vs-tree` children and uploads. `search-scope="loaded" | "all" | "auto"` (default auto), with an optional user switch "In this list / All records". Server paging forces server sorting and filtering unless explicitly local ("sorts this page only").

### Tables on phones

`phone-layout="scroll"` (sideways scroll, first column fixed) or `"cards"` (each row as label/value lines), plus columns hidden on small screens.

### Templates

`Viraspa.templates.add(name, fn)`: one registry usable both as a call, `{{ fullName(user) }}`, and as a pipe, `{{ user.name | initials }}`. `Viraspa.format.addPipe` stays as an alias. App conventions: `app/utils/`, `app/services/`, `app/state/` under `Viraspa.app`, listed in `startup.js`.

### Rich text editor

100% own code, on the browser's editing commands behind one internal adapter, with our own sanitizer. v1: paragraphs, H1–H3, bold, italic, underline, strike, lists with indent/outdent, quote, alignment, horizontal line, links (safe URLs), images (URL or upload handler, alt text), undo/redo, clear formatting, paste cleaning or plain-text paste, shortcuts, placeholder, counts, max length, read-only, height modes, toolbar presets and per-button on/off, sticky toolbar, i18n, form support, events, accessibility. Later: colours, fonts, tables, emoji, find/replace, source view, Markdown shortcuts, mentions, fill-in blanks, full screen.
