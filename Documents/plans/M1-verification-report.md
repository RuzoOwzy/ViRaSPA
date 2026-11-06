# M1 verification report

**Date:** 2026-11-06.
**How it was checked:** a preview with `node node-tools/serve.js --port 8028`, in the in-app browser (Chromium), plus command-line checks. The preview was stopped afterwards. Port 8027 was not touched.

## Results

| # | Plan item | Check | Result |
| --- | --- | --- | --- |
| 1 | New layout | `viraspa/`, `app/`, `lib/jquery/4.0.0/` and `node-tools/` are in place; old files were moved with `git mv` | Pass |
| 2 | `serve.js`, `help.js`, options | `--help` table (flag, config key, environment variable, default), `--version` (`framework 0.2.0`), the typo `--prot` (suggests `--port`), `--port 8028` | Pass |
| 2 | `serve.js` responses | `/` and `/about` → 200 `index.html`; `/about/team` → 200 (SPA fallback); `/missing.js` → 404; `app/project-viraspa.json` (any case) → 404; dot-files → 404; `..%2f` traversal → 404; POST → 405; `If-None-Match` → 304; `Cache-Control: no-cache`; `prerendered/about/index.html` served for `/about` | Pass |
| 3 | Feature check | A frame with `structuredClone` removed shows "This site needs a newer browser … Missing: structuredClone" | Pass |
| 3 | noscript, favicon | Markup checked; the favicon was rendered and inspected at 32 px and 180 px; `favicon.ico` → 200 `image/x-icon` | Pass |
| 4 | Cache strategies | `release` → `0.2.0-20261106120000`; `custom` (`"build 42/x"`) → `build42x`; `revalidate` → no token; `auto` (no `release.json`) → the ETag of `index.html`. Framework files carry `?v=0.2.0` | Pass |
| 5 | Flicker fix | The new page's `<link>` is loaded (`media="not all"`) before the swap; the old page's link is switched off (`not all`), not removed | Pass |
| 5 | Last navigation wins | `navigate('/about'); navigate('/contact'); navigate('/about')` → only About is shown, with the right title | Pass |
| 5 | keepAlive | Home → About → Home: Home stays (hidden) and comes back with its 5 cards without calling the API again; About is removed when left (`pageHidden`, then `pageRemoved`) | Pass |
| 5 | Focus and scroll | After a navigation, the new `<h1>` has focus; scroll was 700 → a new page starts at 0 → Back restores 700 | Pass |
| 6 | Escaping | `{{t}}` is escaped in text and attributes; `{{{raw}}}` is raw; `\{{` gives a literal; paths and missing values work; `javascript:` and ` JaVa\nScRiPt:` → `about:blank`; `data:image/png` is kept; `&` in URLs is escaped | Pass |
| 7 | Full isolation | Cards and the nav bar render in shadow roots with 2 adopted sheets (`base.css` and the component's); `.text-muted` from `base.css` applies inside; nav links inside the shadow root are routed (`composedPath`) | Pass |
| 7 | Scoped isolation | `<app-note>` gets `@scope (app-note) to (:scope [data-vs-component])`; its background applies; the page's link colour reaches in; slot content is placed | Pass |
| 7 | Prefix fallback | `:host`, `:host(.open)`, selector lists, `@media`, `@keyframes` (left as is) and `::slotted()` are all rewritten correctly | Pass (tested by calling the function; Chromium itself supports `@scope`) |
| 7 | None mode, slots | Named and default slots filled; fallback content kept when nothing is given; `componentRoot` is the element and `documentShadow` is `null` | Pass |
| 7 | Tag checks | `vs-thing` is rejected as reserved; `nohyphen` is rejected with a clear message | Pass |
| 8 | Native page | `/plain-native`: plain JS sets up through `viraspa:pageCreated`; leaving and coming back re-runs the setup on the new HTML; `{{ }}` is shown as written; a direct load or refresh works | Pass |
| 8 | Events | Order seen: `pageHidden:home`, `pageCreated:about`, `pageShown:about`, `routeChanged:about`, … | Pass |
| — | Other | Contact form validation (jQuery 4.0.0), the x-responsive grid, not-found for `/nope/deeper`, Back/Forward | Pass |
| — | Console | No errors on a normal load. Errors seen during testing came only from the deliberate tests (the `auto` strategy's missing `release.json`, and the simulated old browser) | Pass |

## Not verified

- **Other browsers:** I only checked Chromium (the in-app browser). Firefox and Safari weren't run, and neither was a browser without `@scope`. The fallback was checked by calling the function directly.
- **Screen readers:** focus moving to the heading was checked, but no screen reader was run.

## Deviations from the plan

- **Event names:** they keep their old structure under the new prefix, e.g. `viraspa:pageBeforeLoad`, and the new events follow the planned names (`viraspa:pageShown` and so on). I also added `viraspa:pageCreated` and `viraspa:pageRemoved`: with keep-alive, a native page needs "set up once" separately from "shown".
- **`core/framework.js`:** merged into `viraspa/viraspa.js` (the single source of the framework version). `framework-viraspa.json` comes in M2, as planned.
- **Card's `title` attribute:** `<app-card title="...">` also shows the browser's native tooltip, because `title` is a standard HTML attribute. The sample is left as it is; the M2 `vs-card` will use `heading`.
- **Old dev-server command:** `node node-server.js` no longer exists. The replacement is `node node-tools/serve.js` (port 8027 by default).

## Proposed repository About

> A no-build SPA framework in plain HTML, CSS and JavaScript: pages, custom-element components (Shadow DOM, scoped or no isolation), routing, lifecycle events and cache-safe loading. Write it 100% native if you like.

This is applied to GitHub only when you ask for a push.
