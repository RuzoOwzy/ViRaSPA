# M1 · Foundation

Goal: the new project layout, the tool foundation, and the runtime fixes that everything later builds on.

## 1. Layout

```
<repo root>/
  node-tools/           serve.js, help.js, lib/ (shared option reader, site finder)
  ViRaSPA/              the served folder
    index.html          project settings (inline) + one framework script
    favicon.ico
    viraspa/            the framework: viraspa.js (loader), core/, services/, utility/, styles/base.css
    app/                project code
      project-viraspa.json   settings for the node tools (never served)
      config/           startup.js, routes.js, endpoints.js, init.js
      pages/, components/, assets/
    lib/                libraries in versioned folders, e.g. lib/jquery/4.0.0/
  Documents/
```

- `node-server.js` is replaced by `node node-tools/serve.js`.
- `core/manifest.js` is split in two:
  - the framework's own file list now lives in `viraspa/viraspa.js`;
  - the app's file list moves to `app/config/startup.js`.
- `core/version.js` is replaced by the project settings in `index.html` (see section 4).
- `core/framework.js` is merged into `viraspa/viraspa.js`, which defines `Viraspa.framework`.
- The x-responsive grid moves out of the framework into `app/assets/x-responsive/`. The sample app loads it from `startup.js`.

## 2. Node tools

- `node-tools/lib/options.js` is one option reader shared by all tools.
  - Precedence: flag, then environment variable, then config section, then default.
  - It provides `--help`/`-h`, `--version` and `--save`.
  - Flags are generated from the config keys, so a flag and its key can't drift apart.
- `node-tools/lib/site.js` finds the served folder: the folder that contains `app/project-viraspa.json`. `--site-folder` overrides it.
- `node-tools/serve.js`:
  - port 8027 by default, overridable with `--port` or `PORT`
  - SPA fallback to `index.html`
  - `no-cache` plus ETag and 304 responses
  - supports HEAD requests
  - serves `prerendered/<path>/index.html` when that file exists
  - never serves `app/project-viraspa.json` or dotfiles
  - a full MIME map, fonts included
  - path-traversal safe
- `node-tools/help.js` lists every tool, one line each.

## 3. Base CSS, noscript, feature check, favicon

- `general.css` becomes `viraspa/styles/base.css`: a reset, theme variables (`--vs-*`), and small utilities.
- `<noscript>` in `index.html` shows a styled message.
- `viraspa/viraspa.js` is written in old-browser-safe syntax and checks the required browser features first: fetch, Promise, AbortController, custom elements, Shadow DOM, constructable stylesheets, `structuredClone`, the History API and `URL`.
  - If any are missing, it shows a clear message listing them and stops.
- Favicon: a crimson "V" with an upward arrow (after the Viramol logo), shipped as SVG, ICO and an Apple touch icon.

## 4. Cache strategies

- `index.html` holds `Viraspa.settings`:
  ```js
  { app: { name, version, releaseDate }, cache: { strategy, token } }
  ```
  `index.html` must itself be served with `no-cache`.
- Framework files carry the framework version as their token (`viraspa/...?v=0.2.0`). App files carry the app token, chosen by the strategy:

  | Strategy | App token |
  | --- | --- |
  | `release` (default) | `version` plus the digits of `releaseDate` |
  | `custom` | `cache.token` |
  | `auto` | `release.json` (written by the deploy tool in M3), else the ETag or Last-Modified of `index.html`, else the `release` token |
  | `revalidate` | no token; the server's ETag decides |

## 5. Flicker fix and page cache

- Page files (template and model) are fetched once and kept in memory.
- Page CSS is loaded before the new page is shown. Each page keeps its own `<link>`, which is turned on and off rather than removed.
- Navigation token: only the last navigation can show its page. Superseded navigations are dropped, and their `AbortSignal` (`page.signal`) is aborted.
- A page is shown as soon as its own template is rendered (`await this.display()`). Slower work, such as API calls, continues on the visible page.
- `keepAlive: true` on a route keeps that page's DOM and instance when the user leaves, so going back to it is instant.
  - Kept-alive pages are limited by `settings.pageCache.maxPages` (default 5) and evicted oldest first.
- Route changes:
  - focus moves to the new page's heading, with a polite announcer as a fallback;
  - scroll position is saved per history entry and restored on Back/Forward;
  - a new page starts at the top.

## 6. Escaping

- `{{key}}` is HTML-escaped. `{{{key}}}` inserts trusted raw HTML. `\{{` writes a literal `{{`.
- Values in URL attributes (`href`, `src`, `action`, `formaction`, `poster`) are checked: `javascript:`, `vbscript:` and non-image `data:` URLs are replaced with `about:blank`.

## 7. Components: custom elements with three isolation modes

- `Viraspa.core.Component` extends `HTMLElement`. Components are registered with `Viraspa.core.defineComponent(Class)`.
- Static fields: `tag`, `folder`, `isolation` and `sharedStyles`.
- `static isolation`:

  | Mode | Mechanism | Styles leak out? | Page styles leak in? |
  | --- | --- | --- | --- |
  | `"full"` (default) | Shadow DOM; shared styles (`base.css`) adopted | no | no (theme variables and `::part` only) |
  | `"scoped"` | `@scope (tag) to (:scope [data-vs-component])`, falling back to prefixing selectors with the tag | no | yes |
  | `"none"` | the CSS is added as it is | yes | yes |

- `this.componentRoot` works in every mode: it's the shadow root in `full` mode and the element otherwise. `this.documentShadow` is set only in `full` mode.
- `<slot>` works in every mode. In `scoped` and `none`, the framework moves the matching children into each slot.
- `mountComponent(Class, target, props)` is kept and returns the element once it's ready.
- The router finds links through `composedPath()`, so links inside shadow roots work.
- The sample components become custom elements: `app-nav-bar` and `app-footer` (full), and `app-card` (full, with shared base styles).

## 8. Native pages and page events

- `native: true` on a route marks a plain page: `.html`, `.css` and a plain `.js`, with no class, model or `{{ }}` processing.
- Page events are dispatched on the page's element and bubble to `document`:
  - `viraspa:pageCreated`
  - `viraspa:pageShown`
  - `viraspa:pageHidden`
  - `viraspa:pageRemoved`
- All framework events are renamed with the `viraspa:` prefix, e.g. `page:beforeLoad` becomes `viraspa:pageBeforeLoad`. `viraspa:routeChanged` is added.
- Sample: `/plain-native` is a page written with no `Viraspa.*` calls.

## 9. Docs

- Update the README, release notes, `Documents/README.md`, `.gitignore` and `jsconfig.json`.
- Propose the new repository About text (it's applied when the owner asks for a push).

## Out of scope for M1

Everything listed in M2–M5.
