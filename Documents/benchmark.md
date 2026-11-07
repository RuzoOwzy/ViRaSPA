# ViRaSPA benchmark (0.1.0, in development)

**Date:** 2026-11-07.

**Ground rules:**
- **Other frameworks:** only published figures are used. Nothing was downloaded or installed to measure them.
- **ViRaSPA:** measured on its own sample app, on this computer:
  - file sizes computed from the files themselves (gzip and brotli with Node's `zlib`);
  - load and navigation times from the browser's Performance API, in the in-app Chromium browser, against `node-tools/serve.js` on localhost.

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
| Framework at startup: `viraspa.js` + 23 core files + `base.css` (25 files) | 162.4 KB | 55.9 KB (per file) / 47.1 KB (as one stream) | 47.6 KB / 39.9 KB |
| All 9 core components (loaded only when used; 31 files) | 33.4 KB | 14.1 KB | — |
| Signals (`state.js`) | 6.0 KB | 1.9 KB | — |
| Template expressions (`expressions.js`) | 12.9 KB | 3.9 KB | — |
| Binding service | 16.0 KB | 4.7 KB | — |
| Router | 16.0 KB | 5.2 KB | — |

**The files are unminified and fully commented:** there's no build step, so what you write is what the browser runs. Minifying would roughly halve the raw size, but it would mean a build step, which ViRaSPA avoids by design.

### The sample app, first page (`/about`), localhost

| Measure | Result |
| --- | --- |
| Requests before the first page shows | 81 (43 JS, 13 CSS, 7 JSON, 7 HTML, 10 SVG) |
| Bytes before the first page (raw) | 303.5 KB: framework 193.2 KB (including the core components on screen), jQuery 80.8 KB (opted into by the sample), app 25.8 KB, official components 3.6 KB |
| `DOMContentLoaded` | 50 ms |
| First page on screen | 371–405 ms (from the address bar; groups of files load one after another) |
| JS heap in use | 3.9 MB |

### Navigation, localhost

| Measure | Result |
| --- | --- |
| A page's first visit (fetch its 4 files, render, show) | 42–58 ms |
| Visiting a page again (files cached in memory) | 6–15 ms |
| Returning to a keep-alive page (Home) | 3–5 ms |

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
| **ViRaSPA 0.1.0 (dev)** | **47 KB gzip / 40 KB brotli** (unminified, with comments), plus about 2 KB per core component used | not measured (see 4) | **no** | this report |

The official [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark) results page didn't come up in the searches. The speed multiples above come from third-party write-ups of it, and the [vani.js suite](https://vanijs.dev/benchmarks/) uses a different method, so the numbers are not directly comparable.

## 4. What this says, honestly

1. **Size:** ViRaSPA's runtime (about 40–47 KB compressed) is in the same range as Angular and Vue, below React, and well above the compiled frameworks (Svelte, Solid) and Lit. The reason is the no-build choice: the code ships unminified, with its comments and its own features (router, session, i18n, formats, busy, head, icons). Those other frameworks leave many of these features to separate libraries.
2. **Requests:** 81 requests before the first page is far more than a bundled app, which typically needs 3–10. On HTTP/2 or HTTP/3 servers this costs much less than on HTTP/1.1, but it is the main cost of "no build". After the first visit, the cache tokens let browsers reuse everything until the next release.
3. **Navigation:** 6–15 ms for a cached page and 3–5 ms for a keep-alive page are in the range users perceive as instant (under about 100 ms). Here ViRaSPA behaves like the big SPA frameworks.
4. **DOM update speed:** not measured. ViRaSPA's fine-grained signals and keyed `data-bind-repeat` work the way Solid, Vue Vapor and Svelte do (only the bound text nodes and attributes change). So it should land well under React's multiple, but that is unproven until it is measured. The way to prove it is to add a ViRaSPA entry to js-framework-benchmark (see the next plan).
5. **What the numbers don't show:**
   - no compile step or `node_modules`;
   - plain HTML, CSS and JS that any web developer can read;
   - dependencies pinned by checksum;
   - built-in session, privileges, i18n and deployment tooling.

   These are the reasons to choose ViRaSPA, not raw kilobytes.

## 5. Ways to improve, without a mandatory build step

These are carried into the next plan, and each one is the project owner's decision:

- **Fewer requests at startup:**
  - add `<link rel="modulepreload">`/`preload` hints for the framework group;
  - or an **optional** `deploy.js --combine`, which concatenates the framework files into one file at deploy time. Source and development stay unbundled.
- **Optional minification at deploy time** (`--minify`): likely about 40–50% smaller. Again only at deploy, never in development.
- **Measure DOM update speed** with a ViRaSPA entry in js-framework-benchmark.
- **Load less at startup:** load `format`, `i18n` and `session` only when the app uses them (lazy framework groups).
