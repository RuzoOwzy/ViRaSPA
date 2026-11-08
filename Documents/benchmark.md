# ViRaSPA benchmark (0.1.0, in development)

**Date:** 2026-11-08 (milestone N11; first edition 2026-11-07).

**Ground rules:**
- **Other frameworks:** only published figures are used. Nothing was downloaded or installed to measure them.
- **ViRaSPA:** measured on its own sample app, on this computer:
  - file sizes computed from the files themselves (gzip and brotli with Node's `zlib`);
  - load and navigation times from the browser's Performance API, in headless Edge 157 driven by Playwright, against `node-tools/serve.js` on localhost (5 loads, median);
  - DOM update speed with `node node-tools/test.js --benchmark` (section 2, "DOM update speed"), in Chromium (Edge), Firefox and WebKit.

So ViRaSPA's numbers are **measured**, and the others are **reported** by their authors or third parties. Treat the comparison as an orientation, not a race result.

## 1. What each comparison point means

| Point | What it measures | Why it matters |
| --- | --- | --- |
| **Runtime size** (min+gzip) | The framework code every visitor downloads before the app's own code | First-visit speed on slow networks and phones |
| **Requests at startup** | How many separate files load before the first page shows | Each request has a cost. HTTP/2 and HTTP/3 make many small files much cheaper, but not free. |
| **Time to first page** | From the address bar to the first page on screen | What a visitor feels on arrival |
| **Navigation time** | From a click to the next page on screen | What a user feels all day in an app |
| **DOM update speed** | Creating, updating and swapping table rows ([js-framework-benchmark](https://github.com/krausest/js-framework-benchmark) style), shown as a multiple of hand-written vanilla JS (1.00×) | Large lists and frequent updates (dashboards, POS screens) |
| **Build step** | Whether code must be compiled or bundled before it runs | The tooling to install and maintain, and what you debug versus what runs |
| **Server rendering / SEO** | Ready-made HTML for search engines and link previews | Public pages, sharing |

## 2. ViRaSPA, measured

### Size of what it loads

| What | Raw | gzip | brotli |
| --- | --- | --- | --- |
| Framework at startup: `viraspa.js` + 27 core files + `base.css` (29 files) | 217.6 KB | 74.6 KB (per file) / 63.4 KB (as one stream) | 63.7 KB / 53.3 KB |
| All 9 core components (loaded only when used; 26 files) | 33.7 KB | 14.0 KB | — |
| Signals (`state.js`, now with `selector`) | 7.5 KB | 2.3 KB | — |
| Template expressions (`expressions.js`) | 13.4 KB | 4.1 KB | — |
| Binding service | 17.9 KB | 5.4 KB | — |
| Router | 19.2 KB | 6.2 KB | — |
| Keyboard (new in N7) | 13.3 KB | 4.6 KB | — |

**Growth since 2026-11-07:** +55 KB raw, +16 KB gzip. The new core files are the keyboard rules and shortcuts, data sources, template helpers, route parameters and the top-line loader (milestones N5–N7). The official components themselves stay outside the framework.

**The files are unminified and fully commented:** there's no build step, so what you write is what the browser runs. Minifying would roughly halve the raw size, but it would mean a build step, which ViRaSPA avoids by design.

### The sample app, first page (`/about`), localhost

The sample now installs 24 official components and 5 helpers. Its startup loads 4 helpers and `vs-popup` (for `Viraspa.popup`).

| Measure | Separate files | Bundled (`bundle.js`, default settings) |
| --- | --- | --- |
| Requests before the first page shows | 76 (52 JS, 13 CSS, 7 JSON, 2 HTML, 1 SVG, the page) | 33 |
| Bytes before the first page (raw) | 395.8 KB: framework 245.5 KB (45 files, with the core components on screen), jQuery 80.8 KB (opted into by the sample), app, helpers and `vs-popup` the rest | 395.3 KB, compacted, in fewer files |
| `DOMContentLoaded` | 109 ms | 119 ms |
| First page on screen (median of 5) | 451 ms | 309 ms |
| JS heap in use | 3.6 MB | 3.8 MB |

| Bundle file | Raw | gzip | brotli |
| --- | --- | --- | --- |
| `viraspa/viraspa.bundle.js` (framework + 9 core components) | 150.1 KB | 40.4 KB | 34.4 KB |
| `app/app.bundle.js` (11 app scripts + `vs-popup`) | 112.6 KB | 29.1 KB | 24.2 KB |
| `app/viraspa-pack.js` (92 templates, models, styles, manifests) | 92.0 KB | 23.2 KB | 19.2 KB |

**Fixed during this measurement:** the bundle tool used to put every installed official component into `app.bundle.js`. With 24 installed that was 365 KB raw (85 KB gzip), plus 153 KB in the pack, downloaded on the first visit even by pages that use none of them. It now bundles only the components needed at startup (`components: "startup"`, the default); the others load when first used. `components: "all"` keeps the old behaviour. Startup bytes fell from 649 KB to 395 KB.

### Navigation, localhost

| Measure | Separate files | Bundled |
| --- | --- | --- |
| A page's first visit (fetch its files, render, show) | 45–72 ms | 49–69 ms (one outlier 289 ms) |
| Visiting a page again (files cached in memory) | 9–13 ms | 11–16 ms |
| Returning to a keep-alive page (Home) | 13–37 ms | 8–28 ms |

These times run until the next animation frame after the page appears, so they are a few milliseconds longer than in the first edition, which stopped at the router's event.

### DOM update speed

`node node-tools/test.js --benchmark --engine chromium,firefox,webkit` opens `tests/benchmark.html`. It runs the keyed operations of [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark) twice: with hand-written vanilla JavaScript (direct DOM work, like its `vanillajs-keyed` entry) and with ViRaSPA as an app would write it (a signal list, keyed `data-bind-repeat`, `selector` for the chosen row).

How it is timed:
- Each time covers the script plus the browser's style and layout (a forced layout ends each operation). Paint is not included.
- Each time is the median of 10 runs after 3 warm-ups.
- Very short operations (select, swap, remove) are repeated 10–50 times inside one measurement and divided, because browsers' timers are coarse.

So these are factors measured on one machine with our own harness, not official js-framework-benchmark results.

| Operation | Chromium (Edge 157) | Firefox 159 | WebKit 27.2 |
| --- | --- | --- | --- |
| Create 1,000 rows | 1.77× | 1.56× | 1.47× |
| Replace all 1,000 rows | 1.57× | 1.94× | 1.42× |
| Update every 10th row | 1.27× | 1.05× | 1.04× |
| Select a row | 1.14× | 1.22× | 1.40× |
| Swap two rows | 1.40× | 1.24× | 1.35× |
| Remove a row | 1.40× | 1.23× | 1.47× |
| Create 10,000 rows | 1.78× | 2.10× | 1.68× |
| Append 1,000 rows | 1.81× | 1.99× | 1.31× |
| Clear 1,000 rows | 1.48× | 1.43× | 1.42× |
| **Geometric mean** | **1.50×** | **1.49×** | **1.38×** |

(Vanilla times in Chromium: about 56 ms to create 1,000 rows, 15 ms to update every 10th, 4 ms to swap and 0.07 ms to select.)

**Fixed and improved during this measurement:**
- **Keyed lists moved every row on any change.** `data-bind-repeat` used to put all rows back in order after each change, so swapping two rows or removing one took as long as updating 100 (about 49 ms for 1,000 rows). It now keeps the longest run of rows that are already in order and moves only the others: swap went from 9.5× to 1.4×, remove from 10× to 1.4×, and update every 10th from 2.1× to 1.3×.
- **Selecting a row re-ran 1,000 bindings.** The new `Viraspa.state.selector` updates only the old and the new row: select went from about 27× to 1.1–1.4×.
- **Template texts were split for every row;** they are now split once and remembered.
- Together these took the geometric mean from **3.51× to 1.50×** in Chromium.

## 3. Published figures for other frameworks

The sources disagree, so ranges are given. Sizes are min+gzip framework runtimes; app code comes on top.

| Framework | Runtime (min+gzip) | DOM update speed vs vanilla JS (1.00×) | Build step | Sources |
| --- | --- | --- | --- | --- |
| React 19 (+ React DOM) | about 60–92 KB | about 1.2–1.8× | yes (JSX) | React size bot ([PR](https://github.com/facebook/react/pull/32934)), [TanStack analysis](https://tanstack.com/redact/latest/docs/SAVINGS_ANALYSIS), [tech-insider](https://tech-insider.org/solidjs-vs-react-vs-svelte-2026/), [siliconbased.dev](https://siliconbased.dev/framework-performance-benchmark) |
| Angular (standalone) | about 36–46 KB for a starter app | not found for 2026 ("much closer to Vue and React" with signals) | yes | [ngLite starter](https://dev.to/angular/a-simpler-and-smaller-angular-starter-with-nglite-1ooh), [DEV comparison](https://dev.to/johalputt/performance-showdown-svelte-5-vs-angular-18-bundle-sizes-for-web-apps-55cl), [strapi](https://strapi.io/blog/best-javascript-frameworks) |
| Vue 3.5 | about 20–45 KB | about 1.06× (Vapor mode) | optional (SFC compiler) | [frontend-framework-size-analysis](https://github.com/gautemo/frontend-framework-size-analysis), [arc.dev](https://arc.dev/employer-blog/svelte-vs-vue-vs-solidjs/), [siliconbased.dev](https://siliconbased.dev/framework-performance-benchmark) |
| Svelte 5 | about 2–8 KB | about 1.05× | yes (compiler) | [DEV](https://dev.to/sendotltd/porting-the-landing-to-svelte-5-runes-61-smaller-gzip-and-why-the-compiler-approach-wins-here-23e3), [arc.dev](https://arc.dev/employer-blog/svelte-vs-vue-vs-solidjs/), [siliconbased.dev](https://siliconbased.dev/framework-performance-benchmark) |
| Solid 1.x | about 6–8 KB | about 1.04–1.1× | yes (JSX compiler) | [tech-insider](https://tech-insider.org/solidjs-vs-react-vs-svelte-2026/), [frontend-framework-size-analysis](https://github.com/gautemo/frontend-framework-size-analysis) |
| Lit 3 | about 5.5 KB | not found | no (plain JS works; TypeScript optional) | [DEV: Lit 3 port](https://dev.to/sendotltd/lit-3-port-970-kb-on-par-with-solid-because-web-components-are-legitimately-viable-now-2041) |
| **ViRaSPA 0.1.0 (dev)** | **63 KB gzip / 53 KB brotli** as separate files (unminified, with comments); **40 KB gzip / 34 KB brotli** bundled and compacted, with the core components | **about 1.4–1.5×** (own harness, script + layout, no paint; see 2) | **no** | this report |

The official [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark) results page didn't come up in the searches. The speed multiples above come from third-party write-ups of it, and the [vani.js suite](https://vanijs.dev/benchmarks/) uses a different method, so the numbers are not directly comparable.

## 4. What this says, honestly

1. **Size:** ViRaSPA's runtime is 53–63 KB compressed as separate files, or 34–40 KB bundled and compacted. That is in the same range as Angular and Vue, below React, and well above the compiled frameworks (Svelte, Solid) and Lit. The reason is the no-build choice: the code ships unminified, with its comments and its own features (router, session, i18n, formats, busy, head, icons, keyboard). Those other frameworks leave many of these features to separate libraries.
2. **Requests:** 76 requests before the first page is far more than a bundled app, which typically needs 3–10. On HTTP/2 or HTTP/3 servers this costs much less than on HTTP/1.1, but it is the main cost of "no build". The optional bundle tool brings it to 33 (most of the rest are jQuery, icons and settings files), and after the first visit the cache tokens let browsers reuse everything until the next release.
3. **Navigation:** about 10–15 ms for a cached page and under 40 ms for a page's first visit are in the range users perceive as instant (under about 100 ms). Here ViRaSPA behaves like the big SPA frameworks.
4. **DOM update speed:** about 1.4–1.5× hand-written vanilla JS in all three engines, measured with our own harness. The published multiples for other frameworks (React about 1.2–1.8×, Vue Vapor about 1.06×, Solid and Svelte about 1.05×) come from js-framework-benchmark, which also counts paint. Paint is the same for every framework, so it narrows every factor, and ViRaSPA's factor there would likely be lower than 1.4–1.5×. A fair comparison still needs a ViRaSPA entry in js-framework-benchmark itself. The slowest parts now are creating rows (about 1.6–2.1×) and the per-row cost of bindings: one effect per binding, which is what keeps later updates fine-grained.
5. **What the numbers don't show:**
   - no compile step or `node_modules`;
   - plain HTML, CSS and JS that any web developer can read;
   - dependencies pinned by checksum;
   - built-in session, privileges, i18n and deployment tooling.

   These are the reasons to choose ViRaSPA, not raw kilobytes.

## 5. Ways to improve, without a mandatory build step

Done since the first edition: the optional bundle tool (fewer requests, preload hints, compaction), the DOM benchmark, minimal-move keyed lists and `selector`. Still open, each the project owner's decision:

- **Optional minification at deploy time** (`--minify`): likely 30–40% smaller than compaction alone, still only at deploy and never in development.
- **A ViRaSPA entry in js-framework-benchmark,** for figures that compare directly with the published ones.
- **Faster row creation:** compile a repeated block's bindings once (where each binding sits in the row) instead of walking every new row.
- **Load less at startup:** load `format`, `i18n` and `session` only when the app uses them (lazy framework groups). Helpers listed in `startup.js` could also join the app bundle.
