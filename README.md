# ViRaSPA

**ViRaSPA** is a no-build frontend framework for single-page applications (SPAs), written in plain HTML, CSS and JavaScript.

It keeps the structure that makes frameworks like Angular pleasant to work in (pages, components, lifecycle events, services, routing) but drops the build step. There is no TypeScript to transpile and no bundler: what you write is exactly what the browser runs, served by a small static dev server.

> **Status:** 0.2.0 in progress (milestone M1 of 5, see [Documents/plans](Documents/plans/README.md)). The framework model is still a working draft, see [Documentation](#documentation).

## Why ViRaSPA

- **No build step**: edit a file, refresh the browser. No compile, transpile or bundle stage between source and output.
- **Familiar structure**: pages, components, services and routes, laid out the way an Angular-style frontend framework would, but in vanilla JS.
- **Native first**: every page, component or extension can be written in 100% standard HTML, CSS and JS. Every framework helper is opt-in.
- **Load only what's needed**: pages and components are fetched on demand and kept in memory, not shipped all at once.
- **No hidden dependencies**: the framework uses no third-party library. jQuery, Tailwind, Bootstrap, etc. are opt-in and declared visibly in `index.html`.

## Browser support

Current Edge, Chrome, Firefox and Safari. At startup, `viraspa/viraspa.js` checks the features the framework needs (Fetch, Promises, AbortController, custom elements, Shadow DOM, constructable stylesheets, `structuredClone`, the History API, `URL`, CSS variables). If any is missing, it shows a clear "This site needs a newer browser" message listing them, instead of a blank page. With JavaScript turned off, a `<noscript>` message explains what to do.

## Repository layout

```
node-tools/           <- command-line tools (Node.js), outside the served folder
  serve.js            <- development server
  help.js             <- lists the tools
  lib/                <- shared option reader and site-folder finder
ViRaSPA/              <- the served folder ("site folder")
  index.html          <- project settings (inline) + one framework script
  favicon.ico
  viraspa/            <- the framework - never edited in a project
    viraspa.js        <- loader: feature check, cache tokens, framework files
    core/             <- events, components, pages, router, layout, bootstrap
    services/         <- data binding, communication (HTTP)
    utility/          <- DOM and asset-loading helpers
    styles/base.css   <- reset, theme variables, utilities
  app/                <- the project's own code
    project-viraspa.json  <- settings for the node tools (never served)
    config/           <- startup.js, routes.js, endpoints.js, init.js
    pages/            <- sample pages
    components/       <- sample components
    assets/           <- icons, images, the x-responsive grid, jQuery extensions
  lib/                <- libraries, in versioned folders (lib/jquery/4.0.0/)
Documents/            <- developer documentation, plans, release notes, design model
jsconfig.json         <- VS Code editor settings (autocomplete); not part of the framework
```

## Running locally

ViRaSPA needs a static server, not a `file://` double-click, because pages fetch their `.html` and `.model.json` files. With [Node.js](https://nodejs.org/) installed, run this from the repository root:

```bash
node node-tools/serve.js
```

Then open http://localhost:8027/. The server falls back to `index.html` for client-side routes, sends `Cache-Control: no-cache` with ETags (so edits show up on refresh), and never serves `app/project-viraspa.json` or dot-files.

### Node tools

Every tool explains itself with `--help`, and `node node-tools/help.js` lists them all.

- **Config:** each tool reads its own section of `app/project-viraspa.json` (`serve.js` reads `devServer`).
- **Flags match config keys:** a flag is its key in kebab-case, e.g. `devServer.port` ↔ `--port`.
- **Precedence:** command-line flag, then environment variable, then config file, then default.
- **Saving:** flags apply to one run only; add `--save` to write them into the config.

```bash
node node-tools/serve.js --help
```

```bash
node node-tools/serve.js --port 8030
```

```bash
node node-tools/serve.js --port 8030 --save
```

The tools find the served folder automatically (the folder containing `app/project-viraspa.json`), or take `--site-folder <path>`.

## Key concepts

### Pages

Every page lives in its own kebab-case folder, with its files sharing the folder's name:

```
app/pages/home/
  home.html
  home.css
  home.js
  home.model.json   <- values for the {{placeholders}} in home.html
```

`home.js` registers a page class as `Viraspa.pages["home"]`. The base class `Viraspa.core.Page` fetches and renders the page's `.html` and `.model.json` and shows the page, so a page only writes code for what it does differently:

```js
class HomePage extends Viraspa.core.Page {
  async onLoad() {
    await super.onLoad(); // renders home.html and shows the page
    const users = await Viraspa.services.communication.call(Viraspa.endpoints.users.list, { signal: this.signal });
    // ... this.container is the page's element
  }
}
Viraspa.pages.home = HomePage;
```

- **`this.signal`** is an `AbortSignal` that is aborted when the user leaves the page, so pending requests are cancelled.
- **`await this.display()`** shows the page. The default `onLoad` calls it once the template is rendered, so slower work (API calls) runs on the visible page.

#### Plain native pages

A route with `native: true` is a plain page: `.html`, `.css` and an ordinary `.js` file. There's no class, no model and no `{{ }}` processing. The script runs once, on the first visit, and uses standard DOM events that the framework dispatches on the page's element (they bubble to `document`):

| Event | When |
| --- | --- |
| `viraspa:pageCreated` | the page's HTML was just created: set it up here |
| `viraspa:pageShown` | the page is on screen (every visit) |
| `viraspa:pageHidden` | the user left the page |
| `viraspa:pageRemoved` | the page's HTML was removed |

```js
document.addEventListener("viraspa:pageCreated", (event) => {
  if (event.detail.route.name !== "plain-native") return;
  event.target.querySelector("button").addEventListener("click", () => { /* ... */ });
});
```

See `/plain-native` in the sample.

### Components

A framework component is a [custom element](https://developer.mozilla.org/docs/Web/API/Web_components/Using_custom_elements) with a folder of `.html`, `.css` and `.model.json` files:

```js
class Card extends Viraspa.core.Component {
  static tag = "app-card";               // lowercase, with a hyphen
  static folder = "app/components/card"; // card.html, card.css, card.model.json
  static isolation = "full";             // "full" | "scoped" | "none"
}
Viraspa.core.defineComponent(Card);
```

Use it as `<app-card title="Hello"></app-card>`, or from code with `await Viraspa.core.mountComponent(Card, target, { title: "Hello" })`.

- **Default rendering:** the `.html` is rendered with the `.model.json` defaults, overridden by attributes and then by `props`.
- **Shared files:** a component's files are fetched once per session and shared by every instance.
- **Reserved prefixes:** `vs-` and `viraspa-` are kept for official ViRaSPA components.
- **Native components:** a component written with plain `customElements.define(...)` works without any of this; the framework leaves it alone.

#### Isolation modes

| Mode | How | Component styles leak out? | Page styles leak in? | Use for |
| --- | --- | --- | --- | --- |
| `"full"` (default) | Shadow DOM. `base.css` is shared into it (`static sharedStyles`). | No | No (theme variables and `::part()` only) | Most components; the safest for third parties |
| `"scoped"` | Light DOM. The CSS is limited to the component with `@scope` (or by prefixing selectors with the tag on older browsers). | No | Yes | Forms (password managers and autofill work), components that should pick up Bootstrap or Tailwind |
| `"none"` | Light DOM. The CSS is added as it is. | Yes | Yes | Rare: style packs, behaviour-only wrappers |

The same rules apply in every mode:

- **`this.componentRoot`:** where the component's content lives. It's the shadow root in `full` mode and the element itself otherwise. `this.documentShadow` is the shadow root in `full` mode, and `null` otherwise.
- **CSS:** `:host` means the component element and `::slotted(x)` means slotted content.
- **Slots:** `<slot>` / `<slot name="x">` work. In `scoped` and `none`, the framework moves the matching children into each slot, or keeps the slot's fallback content.
- **Parts:** mark them with `part="title"`. Pages style them with `::part(title)` in `full` mode, or `app-card [part="title"]` otherwise.

### Templates and escaping

| Placeholder | Result |
| --- | --- |
| `{{key}}` | the value as text, HTML-escaped. Paths work: `{{user.address.city}}`. |
| `{{{key}}}` | the value as raw HTML: only for HTML you trust |
| `\{{` | a literal `{{` |

In URL attributes (`href`, `src`, `action`, `formaction`, `poster`), a `{{key}}` value starting with `javascript:`, `vbscript:` or a non-image `data:` becomes `about:blank`.

### Lifecycle events

Framework events are DOM `CustomEvent`s whose names start with `viraspa:`. Listen with `document.addEventListener("viraspa:pageAfterLoad", handler)`.

- **App:** `appInit`. Project init code registered with `Viraspa.core.onInit(async () => …)` in `app/config/init.js` is awaited before the layout and the first page.
- **Layout:** `layoutBeforeLoad`, `layoutOnLoad`, `layoutAfterLoad`.
- **Route guard:** `routeBeforeGuard`, `routeOnGuard`, `routeAfterGuard`. `routeChanged` fires after a page is shown, for analytics.
- **Page:**
  - load: `pageBeforeLoad`, `pageOnLoad`, `pageAfterLoad`
  - data binding: `pageBeforeDataBinding`, `pageOnDataBinding`, `pageAfterDataBinding`
  - visibility: `pageCreated`, `pageShown`, `pageHidden`, `pageRemoved`
- **Component:** `componentBeforeLoad`/`OnLoad`/`AfterLoad` and `componentBeforeDataBinding`/`OnDataBinding`/`AfterDataBinding`.
- **Sample pages** also emit `pageBeforeValidation`/… and `pageBeforeRequest`/… through `Viraspa.core.emit(name, detail)`.

### Routing

Routes live in `app/config/routes.js`. Each one maps a URL path to a page folder:

```js
{ path: "/about", name: "about", page: "app/pages/about", title: "ViRaSPA — About", access: "public", nav: { label: "About" } }
```

| Option | Meaning |
| --- | --- |
| `page` | the folder. `app/pages/about` → `about.js`, `about.html`, `about.css`, `about.model.json`. |
| `nav` | lists the route in the nav bar, which is built from the routes |
| `access` | `public` or `private`, checked by the pluggable `Viraspa.core.guard(route)` (it allows every route by default) |
| `keepAlive` | `true` keeps the page's DOM and state when the user leaves, so coming back is instant. At most `settings.pageCache.maxPages` (default 5) pages are kept; the oldest goes first. |
| `native` | `true` for a plain page (see above) |

`Viraspa.notFoundRoute`, also in `routes.js`, is the page shown when nothing matches.

How navigation behaves:

- **Clicking a link** to one of the routes, including links inside components' shadow roots, updates the address bar (History API) and replaces only the page area. Ctrl/Shift-clicks, `target="_blank"`, `download` and external links behave normally.
- **No flicker:**
  - a page's stylesheet is loaded before the page is shown;
  - each page keeps its own `<link>`, switched on only while that page is on screen;
  - page files are fetched once per session.
- **The last click wins:** if the user clicks again before a page is ready, the older navigation is dropped and its requests are aborted.
- **Focus and scroll:**
  - after a navigation, focus moves to the new page's `<h1>` for keyboard and screen-reader users;
  - a new page starts at the top (or at its `#hash`);
  - Back/Forward restores the previous scroll position;
  - links to `#anchors` on the same page only scroll.
- **Typing a URL, refreshing or a bookmark:** the server returns `index.html` for any path without a file extension, and the router shows the matching page.
- **Matching:** case-insensitive and without a trailing slash, so `/About/` opens `/about`, and the address bar is corrected.
- **Wrong URLs** show the not-found page. That 404 is visual only: the server still answers 200.
- **A misconfigured route** logs a clear console error and shows the not-found page.

`index.html` has `<base href="/">`, so relative paths always resolve from the site root. If the app is served from a sub-folder, change it to that folder.

### Endpoints

Backend endpoints are defined once in `app/config/endpoints.js` and shared by every page:

```js
Viraspa.endpoints = Viraspa.services.communication.defineEndpoints({
  baseUrl: "https://jsonplaceholder.typicode.com",
  users: { list: { method: "GET", path: "/users" }, get: { method: "GET", path: "/users/{id}" } },
});
```

```js
const user = await Viraspa.services.communication.call(Viraspa.endpoints.users.get, { params: { id: 7 }, signal: this.signal });
```

- **Frozen definitions:** the endpoint definitions can't be changed at runtime.
- **Base URL:** it's read on every call. `Viraspa.endpoints.setBaseUrl(url)` replaces it, and accepts only an absolute `http`/`https` URL.

### Startup and the app shell

1. `index.html` holds the project settings (`Viraspa.settings`) and one framework script, `viraspa/viraspa.js?v=<framework version>`.
2. The loader checks the browser, loads `base.css` and the framework files, then `app/config/startup.js`, which lists the app's own files in groups.
3. The shell (for example `<app-nav-bar>`, `<main id="page-root">`, `<app-footer>`) is plain markup in `index.html`. It's built once; only `#page-root` changes per route.

### Cache strategies

Every URL the framework loads carries a token, so browsers never use a stale copy after a release.

- **Framework files** use the framework version (`viraspa/core/router.js?v=0.2.0`).
- **App files** use the app token, chosen by `Viraspa.settings.cache.strategy` in `index.html`:

| Strategy | App token | Use when |
| --- | --- | --- |
| `release` (default) | `app.version` + the digits of `app.releaseDate`, e.g. `0.2.0-20261106120000` | you bump the version and date on each release |
| `custom` | `cache.token` (letters, digits, dots, hyphens) | your release process sets its own token |
| `auto` | `release.json` (`{"token": "..."}`, written at deploy time), else the server's ETag/Last-Modified of `index.html` | you don't want to bump anything by hand |
| `revalidate` | none: the browser asks the server about every file | development, or servers that send ETags |

`index.html` itself must be served with `Cache-Control: no-cache` (`serve.js` does), so a change to the settings reaches every browser on its next visit. Libraries in `lib/` live in versioned folders, so a new version is a new URL and needs no token. With `auto`, a missing `release.json` shows as a 404 in the console; that's expected.

### Theme

`viraspa/styles/base.css` defines the theme as CSS variables (`--vs-color-primary`, `--vs-radius`, `--vs-space-3`…). Override them in your own stylesheet:

```css
:root { --vs-color-primary: #b0122b; }
```

They reach into every component, including shadow roots.

## Conventions

- **Files and folders** (anything that appears in a URL): `kebab-case`, e.g. `services/communication/http-service.js`.
- **JS identifiers**: `PascalCase` for classes, `camelCase` for functions, variables and properties.
- **Namespace**: code uses `window.Viraspa`. The stylized name **ViRaSPA** is used only in text people see.
- **Reserved**:
  - the `vs-` and `viraspa-` tag prefixes
  - the `viraspa:` event prefix
  - `--vs-` CSS variables

## Versions and using ViRaSPA in a project

The framework's version and release date live in `viraspa/viraspa.js` and are available at runtime as `Viraspa.framework`. Changes are described in [Documents/release-notes.md](Documents/release-notes.md).

In a project:

- **Don't edit** anything in `viraspa/`.
- **Do edit:**
  - `index.html`: the settings, the app version and release date, the shell
  - everything in `app/`
  - `lib/`

Installing, updating and verifying the framework with a tool (`node-tools/install.js`) arrives in milestone M2.

## Deploying one frontend to many servers

A project may be installed on several servers, each with its own backend:

- **Init code:** write it in `app/config/init.js` with `Viraspa.core.onInit(async () => …)`. It runs once at startup and is awaited before the layout and first page load.
- **Backend address:** call `Viraspa.endpoints.setBaseUrl(url)` there.
- **A settings file an admin edits on the server:** read it with `Viraspa.utility.assetLoader.fetchJson(path, { fresh: true })`, which bypasses the browser cache.
- **Secrets:** anything the frontend fetches is public, so never put secrets in such a file.

## Documentation

See [Documents/](Documents/README.md):

- [Plans for 0.2.0](Documents/plans/README.md), milestone by milestone
- [Release notes](Documents/release-notes.md)
- [Framework design model](Documents/Modeling%20my%20Own%20Custom%20SPA%20Web%20Development%20Frontend%20Framework.txt) (a working draft)
