# N11 report · Showcase, benchmark and review

## Done

| Part | Result |
| --- | --- |
| Showcase | `/showcase` now shows every official component. New: a data table and pagination (people from the demo API), and `vs-card` and `vs-stat-tile`, with a link to the sign-in page for `vs-login-form`. A failed API call no longer stops the rest of the page. |
| Extensions demo site | Nine new pages (Inputs, Selects, Tables, Tree, Popups & menus, Progress, Media, Editor, Helpers) beside the three existing ones. Made-up people and orders (no backend); the overview table lists all 24 components and 5 helpers. The framework is pinned to the latest pushed commit, and the four helpers and `vs-popup` load at startup. |
| DOM benchmark | New `tests/benchmark.html` and `node node-tools/test.js --benchmark [--engine …]`: js-framework-benchmark's keyed operations, ViRaSPA against hand-written vanilla JS, in Chromium, Firefox and WebKit. |
| Benchmark re-measured | [benchmark.md](../benchmark.md): sizes, first page and navigation (separate files and bundled), and DOM update speed in three engines. |
| Review against the N plan | See below. |

## Problems found and fixed

The benchmark turned up three framework problems and one bundle-tool problem:

- **Keyed lists moved every row on any change.** After each change, `data-bind-repeat` put all of its rows back in order, so swapping two rows or removing one cost as much as updating 100. It now keeps the longest run of rows already in order and moves only the others (a longest-increasing-subsequence pass). New rows go in as one batch. Measured: swap 9.5× → 1.4×, remove 10× → 1.4× vanilla. A new test checks that swap, reverse, insert, remove and shuffle sequences all end in the right order with rows reused.
- **Selecting a row re-ran every row's binding.** New `Viraspa.state.selector(source)`: `isSelected(row.id)` updates only the old and the new row. Select went from about 27× to 1.1–1.4×. It is in the README, with a test.
- **Template texts were split again for every repeated row;** they are now split once and remembered (short texts only, as frozen parts).
- **The bundle put every installed official component into `app.bundle.js`.** With 24 installed, that was 365 KB raw / 85 KB gzip, plus 153 KB in the pack, downloaded on the first visit. The new `components` setting defaults to `"startup"`: only components in `startup.js` `components`, those used in `index.html`, and their component dependencies are bundled and packed. The others load when first used. `"all"` keeps the old behaviour. Startup bytes on the bundled sample fell from 649 KB to 395 KB. A Node test covers both settings.

The review against the plan turned up these:

- **Tables on phones:** the plan asked for "scroll with the first column fixed" and "columns hidden on small screens". The first column is now fixed while a phone scrolls the table sideways, and a column can say `phone="hide"` (read by table-core). Checked at 375 px on `/showcase`: Company is hidden and Name stays in place after scrolling 200 px.
- **The demo's search hints were wrong:** they said "elodie dar", but in the demo data Élodie is in Arusha. The hints now say "elodie aru", and that search was checked on the Tables and Helpers pages.

**Result:** the geometric mean of the DOM benchmark went from **3.51× to 1.50×** vanilla in Chromium, with 1.49× in Firefox and 1.38× in WebKit.

## Review against the N plan

| Decision | State |
| --- | --- |
| Classic scripts; `{ src, type: "module" }` only for third-party libraries | Kept. No import map, no ES-module app code. |
| ViRaSPA-Extensions with `components/` and `helpers/`, the helper kind, manifest dependencies | Done (N1). Dependencies install automatically; helpers also load on demand (`loadHelper`). The GitHub repository still has its old name until the owner renames it. |
| Naming `vs-<family>-<variant>` | All 24 components follow it. |
| Migration scope, with merges and drops as listed | Done (N7 inventory, N8–N10). `simplifyFilterPage` dropped; its ideas are in `vs-table` and `/orders`. |
| Progress: `vs-progress` bar, ring, dots, plus the core top line (`busy.style`) | Done. The page-wide top line lives in `Viraspa.busy` rather than a `vs-progress` type, as the `vs-progress` README says. |
| Keyboard: always-on behaviour, data-entry mode, overrides (developer wins, `data-keys="native"`, named actions, `add-row-on-enter`, editor keys normal, `?` overlay, no browser shortcuts taken) | Done (N7–N10), with tests. |
| Server-handler contract with debounce, cancel, loading, errors, retry, `search-scope` and the "In this list / All records" switch | Done (`Viraspa.data`, `vs-table`, `vs-select-search`, `vs-tree` `load`, the uploads in the cropper and editor). |
| Tables on phones: scroll (first column fixed) or cards, hidden columns | Done (completed in this milestone). |
| `Viraspa.templates.add`, call and pipe, with `format.addPipe` as an alias; `Viraspa.app` conventions | Done (N7). |
| Rich text editor v1, all our own code | Done (N10). The "later" list stays later. |
| Bundle tool, real servers, browsers and phones, GitHub Pages, dynamic previews | Done (N2–N6). IIS waits for an administrator run, and Pages waits for the owner (see below). |

## Verified

- **Tests:** 31 Node tests pass. Browser tests (73) pass in Edge (plain and bundled), and in Firefox 159 and WebKit 27.2, each as iPhone 15 and Pixel 7.
- **Benchmark:** `node node-tools/test.js --benchmark --engine chromium,firefox,webkit` gives a geometric mean of 1.50× / 1.49× / 1.38×.
- **Demo site, locally, with the real jsDelivr framework (port 8029, stopped afterwards):** all 13 pages render, every component tag is defined, and there are no console errors or failed requests. Checked:
  - Tables: 10 of 120 orders per page, overdue rows red through `::part`, the computed sale amount, the "elodie aru" search.
  - Tree: 7 nodes.
  - Helpers: 20 people, the required marks, the filter.
  - Media: the crop result.
  - Editor: its starting text.
  - Popups: `Viraspa.popup`.
- **Phone width:** no page of the demo or the showcase scrolls sideways, and the demo's orders table shows each row as a card.

## Waiting for the owner

- Rename the GitHub repository ViRaSPA-Components to ViRaSPA-Extensions. GitHub redirects the old address, and the local remote can then be updated.
- Turn on GitHub Pages for ViRaSPA-Extensions (branch `main`, root).
- Run `F:\Development\ViRaSPA\Miscellaneous\test-servers\setup-iis.ps1` as administrator to test IIS on port 8033.
