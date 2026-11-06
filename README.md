# ViRaSPA

**ViRaSPA** is a no-build frontend framework for single-page applications (SPAs), written in plain HTML, CSS and JavaScript.

It keeps the structure that makes frameworks like Angular pleasant to work in (pages, components, lifecycle events, services, routing) but drops the build step. There is no TypeScript to transpile and no bundler: what you write is exactly what the browser runs, served by a small static dev server.

> **Status:** 0.2.0 in progress (milestone M2 of 5, see [Documents/plans](Documents/plans/README.md)). The framework model is still a working draft, see [Documentation](#documentation).

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
  install.js          <- installs, restores and verifies what app/project-viraspa.json pins
  create-project.js   <- starts a new project
  clean-sample.js     <- removes the sample app from a copy of this repository
  stamp.js            <- for publishers: writes file lists and checksums into manifests
  help.js             <- lists the tools
  lib/, templates/    <- shared code and the new-project template
ViRaSPA/              <- the served folder ("site folder")
  index.html          <- project settings (inline), the app shell, one framework script
  favicon.ico
  viraspa/            <- the framework - never edited in a project
    viraspa.js        <- loader: feature check, cache tokens, framework files
    framework-viraspa.json  <- version, release date, file checksums
    core/             <- events, components, registry, icons, pages, router, layout, bootstrap
    components/       <- core components: vs-header, vs-menu, vs-icon, ...
    services/         <- data binding, communication (HTTP)
    utility/          <- DOM and asset-loading helpers
    styles/base.css   <- reset, theme variables, utilities
  components/         <- official components installed by install.js (vs-card, ...)
  extensions/         <- third-party extensions installed by install.js
  app/                <- the project's own code
    project-viraspa.json  <- what is installed (pinned) + node-tool settings (never served)
    config/           <- startup.js, routes.js, endpoints.js, init.js
    pages/            <- sample pages
    components/       <- the app's own components
    assets/           <- icons, images, the x-responsive grid, jQuery extensions
  lib/                <- libraries in versioned folders, installed by install.js (not in git)
Documents/            <- developer documentation, plans, release notes, design model
jsconfig.json         <- VS Code editor settings (autocomplete); not part of the framework
```

After cloning this repository, install the libraries once (Font Awesome, Lucide, jQuery):

```bash
node node-tools/install.js restore
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
class Note extends Viraspa.core.Component {
  static tag = "app-note";               // lowercase, with a hyphen
  static folder = "app/components/note"; // note.html, note.css, note.model.json
  static isolation = "scoped";           // "full" | "scoped" | "none"
  prepareModel(model) {                  // optional: derived values
    model.upper = String(model.heading).toUpperCase();
    return model;
  }
}
Viraspa.core.defineComponent(Note);
```

Use it as `<app-note heading="Tip">…</app-note>`, or from code with `await Viraspa.core.mountComponent(Note, target, { heading: "Tip" })`.

- **Default rendering:** the `.html` is rendered with the `.model.json` defaults, overridden by attributes and then by `props`. Call `await this.render()` to render again after a change.
- **Optional files:** `static hasModel = false` and `static hasStyles = false` skip the `.model.json` and `.css` files when there aren't any.
- **Shared files:** a component's files are fetched once per session and shared by every instance.
- **`ready`:** `element.ready` resolves once it has loaded, including the components inside it.
- **Reserved prefixes:** `vs-` and `viraspa-` are kept for core and official components; `defineComponent` refuses them elsewhere.
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
- **Parts:** mark them with `part="title"`. Pages style them with `::part(title)` in `full` mode, or `app-note [part="title"]` otherwise.

### Core components

These ship with the framework (`viraspa/components/`) and load by themselves the first time their tag appears. Nothing needs to be listed.

| Tag | What it does |
| --- | --- |
| `vs-header` | The top bar. Slots: `brand`, (default) the middle, `end`. Attribute `sticky`. |
| `vs-brand` | The logo and name, linking home: `name`, `href`, `logo` (an image) or `icon`. |
| `vs-menu` | Navigation links, `orientation="horizontal"` (default) or `"vertical"`.<br>• Built from the routes whose `nav.menus` includes its `menu` (default `"main"`), or from `element.items = [{ label, href, icon }, { divider: true }]`.<br>• `collapsed` (vertical): icons only, with the label as a tooltip.<br>• Horizontal menus fold into a toggle button under 768px.<br>• The current page's link gets `aria-current="page"`. |
| `vs-sidebar` | A side panel for a vertical menu. `collapsible` adds a button that collapses it (and its menus) to icons. The choice is remembered in the browser, and it starts collapsed on small screens. |
| `vs-user-menu` | The user's name and avatar or initials, with a dropdown panel below.<br>• `element.items` takes links (`href`) and actions (`action: () => …`).<br>• Keyboard: arrows, Enter and Escape.<br>• Dispatches a `vs-select` event. |
| `vs-footer` | The bottom bar; shows what you put in it. |
| `vs-icon` | An icon (see [Icons](#icons)). Decorative unless it has `label`. |
| `vs-busy-indicator` | A spinner with `message`. Attributes `active` and `overlay` (covers its positioned parent); `delay` (default 200 ms) avoids flashing it for quick work. |
| `vs-toast` | Short messages: `Viraspa.toast.show("Saved.", { type: "success", duration: 4000 })`. `type`: `info`, `success`, `warning` or `error`; `duration: 0` stays until closed. |

Colours come from the theme variables, plus a few per component, e.g. `--vs-header-background`, `--vs-sidebar-width` and `--vs-menu-active-background`.

### Icons

An icon is an object, so its source is always explicit. In HTML, a short `set:name[:style]` form works too.

| Set | Object | Short form |
| --- | --- | --- |
| Font Awesome Free (self-hosted) | `{ set: "fontawesome", name: "house", style: "solid" }` (`solid`, `regular` or `brands`) | `fontawesome:github:brands` |
| Lucide (self-hosted) | `{ set: "lucide", name: "house" }` | `lucide:house` |
| A character or emoji | `{ set: "char", text: "★" }` | `char:★` |
| An SVG file, inlined (takes the text colour) | `{ set: "svg", src: "app/assets/icons/x.svg" }` | `svg:app/assets/icons/x.svg` |
| An image | `{ set: "image", src: "app/assets/icons/x.png" }` | `image:app/assets/icons/x.png` |

```html
<vs-icon icon="lucide:house"></vs-icon>
<vs-icon icon="fontawesome:github:brands" label="GitHub"></vs-icon>
```

- **Size and colour:** icons follow the font size (1em) and text colour, and work inside any component's shadow root. Font Awesome's fonts are declared at page level for that.
- **Where the libraries live:** `lib/fontawesome/7.3.1/` and `lib/lucide/1.70.0/`, pinned in `app/project-viraspa.json`.
- **Changing the location:** `Viraspa.icons.configure("lucide", { folder: "…" })`.
- **Adding a set:** `Viraspa.icons.register("myset", { render(icon, root) { return element; } })`.

### Official components and extensions

**Official components** (`vs-card`, `vs-stat-tile`, `vs-login-form`…) live in the [ViRaSPA-Components](https://github.com/RuzoOwzy/ViRaSPA-Components) repository. A project installs only the ones it uses:

```bash
node node-tools/install.js add component vs-card@0.1.0
```

- **Where it goes:** `components/vs-card/`, described by its `component-viraspa.json`.
- **Loading:** like core components, it loads the first time `<vs-card>` appears.
- **Not installed:** the console says so, with the command to install it.

**Extensions** are third-party bundles in `extensions/<name>/`, described by `extension-viraspa.json`. A minimal manifest:

```json
{
  "name": "owzy",
  "version": "1.0.0",
  "releaseDate": "2026-11-06",
  "author": { "name": "Owzy", "email": "…", "website": "https://…", "organization": "…" },
  "contributors": [{ "name": "…", "email": "…", "website": "…" }],
  "tagPrefix": "owzy",
  "frameworkVersion": { "min": "0.2.0", "max": "0.9.9", "supported": [], "excluded": ["0.2.3"] },
  "components": [{ "tag": "owzy-number-input", "script": "number-input/number-input.js" }],
  "styles": [],
  "scripts": []
}
```

- **Loading:** list the extension in `app/config/startup.js` (`extensions: ["owzy"]`). Its components then load on first use.
- **Framework versions:**
  - precedence is `excluded` > `supported` > `min`/`max`;
  - a missing `min` or `max` means no limit on that side;
  - only `supported` means exactly those versions;
  - nothing means any version, with a warning.
- **An extension is rejected,** at install time by `install.js` and at runtime with a clear console message, if:
  - its framework version doesn't fit;
  - its `tagPrefix` is reserved (`vs`, `viraspa`) or already used by another extension;
  - a component tag doesn't start with its prefix.
- **Theme variables:** extensions may *use* `--vs-*` variables but not *define* them. Styles that do are not applied.
- **Locked namespaces:** `Viraspa.core`, `services`, `utility`, `icons`, `toast`, `extensions` and `cache` are frozen after startup, so no code can replace framework functions. Use the APIs instead, e.g. `Viraspa.core.setGuard(fn)`.

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
| `nav` | `{ label, icon, menus, order }` lists the route in a `vs-menu`. `menus` defaults to `["main"]`; `icon` is e.g. `"lucide:house"`. |
| `access` | `public` or `private`, checked by the guard: set it with `Viraspa.core.setGuard(async (route) => true \| false)`. It allows every route by default. |
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
2. The loader checks the browser, loads `base.css` and the framework files, then `app/config/startup.js`, which lists the app's extensions and own files in groups.
3. The shell is plain markup in `index.html`. It's built once; only `#page-root` changes per route:
   ```html
   <vs-header sticky>
     <vs-brand slot="brand" name="ViRaSPA" logo="app/assets/icons/favicon.svg"></vs-brand>
     <vs-menu menu="main"></vs-menu>
   </vs-header>
   <main id="page-root"></main>
   <vs-footer>© 2026</vs-footer>
   ```

**Remote mode:** the framework's files are found relative to `viraspa.js`, so the framework can be served from a CDN instead of being installed, e.g. `<script src="https://cdn.jsdelivr.net/gh/RuzoOwzy/ViRaSPA@v0.2.0/ViRaSPA/viraspa/viraspa.js"></script>`. CDN files carry no token, since the URL already names the version. This works once version tags are published.

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

The framework's version and release date live in `viraspa/viraspa.js` (available at runtime as `Viraspa.framework`) and in `viraspa/framework-viraspa.json`, with its file checksums. Changes are described in [Documents/release-notes.md](Documents/release-notes.md).

### Starting a project

```bash
node node-tools/create-project.js D:\Projects\VSales --project-name "VSales"
```

This creates a ready-to-run project:

- the node tools;
- a minimal app (Home and Not Found pages, the core shell);
- the framework, copied from here and pinned;
- a `.gitignore` that leaves out everything installed.

To turn a copy of *this* repository into a project instead, `node node-tools/clean-sample.js --dry-run`, then `--yes`, removes the sample pages, components and assets.

### Installing, pinning and restoring: install.js

`app/project-viraspa.json` pins everything the project installs: the framework, official components, extensions and libraries.

- **What a pin holds:** the version, the download source it came from, and a SHA-256 checksum of the installed files. It covers downloaded files only, never `app/`.
- **The checksum** is computed by `install.js` when it installs something, not as a build step.
- **What to commit:** `index.html`, `app/` and `node-tools/`. Git ignores `viraspa/`, `components/`, `extensions/` and `lib/`.
- **On a new computer:** one command brings back exactly the same files.

```bash
node node-tools/install.js restore
```

| Command | Does |
| --- | --- |
| `add component vs-card@0.1.0` | installs and pins (also `extension`, `library`) |
| `update framework@0.3.0` | installs another version and updates the pin. For the framework it also updates `?v=` in `index.html`. |
| `remove component vs-card` | deletes the files and the pin |
| `restore` | reinstalls anything missing or changed, and refuses files that don't match their pin |
| `verify` | compares the installed files with the pins and changes nothing; exit code 1 on a problem |
| `list` | shows the pins |

**Download sources:**

- **`official`:** the ViRaSPA GitHub repositories through jsDelivr.
- **`npm`:** npm packages through jsDelivr, for libraries.
- **Your own:** listed in `downloadSources`:
  ```json
  "downloadSources": [
    { "name": "company", "type": "folder", "location": "D:\\Shared\\ViRaSPA" },
    { "name": "offline", "type": "zip", "location": "D:\\Downloads\\viraspa-bundle.zip" },
    { "name": "components-repository", "type": "folder", "location": "../ViRaSPA-Components/components/{name}" }
  ]
  ```
- **Layout under a location:**
  - `framework/<version>/`
  - `components/<name>/<version>/`
  - `extensions/<name>/<version>/`
  - `libraries/<name>/<version>/`

  A location with `{kind}`, `{name}` or `{version}` placeholders is used as written instead.
- **Overriding for one run:**
  - `--download-source company`: another source;
  - `--from <url | folder | file.zip>`: straight from one place.

  Versions can't be overridden on `restore`; use `update`.

**Libraries** come from npm packages: `--package`, `--package-folder` and `--include` choose the files:

```bash
node node-tools/install.js add library chartjs@4.6.1 --package chart.js --package-folder dist --include chart.umd.min.js --download-source npm
```

**Publishing** a framework release, an official component or an extension: `node node-tools/stamp.js <folder>` checks the manifest and writes its file list and checksums. `install.js` then verifies every downloaded file against them.

### What to edit in a project

- **Don't edit** anything in `viraspa/`, `components/`, `extensions/` or `lib/`. They're installed and pinned.
- **Do edit:**
  - `index.html`: the settings, the app version and release date, the shell
  - everything in `app/`

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
