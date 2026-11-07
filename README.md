# ViRaSPA

**ViRaSPA** is a no-build frontend framework for single-page applications (SPAs), written in plain HTML, CSS and JavaScript.

It keeps the structure that makes frameworks like Angular pleasant to work in (pages, components, lifecycle events, services, routing) but drops the build step. There is no TypeScript to transpile and no bundler: what you write is exactly what the browser runs, served by a small static dev server.

> **Status:** first version (0.1.0), in development and not released yet. Milestones M1–M5 are done; the N milestones are in progress (see [Documents/plans](Documents/plans/README.md)). The framework model is still a working draft, see [Documentation](#documentation).

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
  prerender.js        <- ready-made public pages for search engines and link previews
  deploy.js           <- copies a release to a server folder or .zip, with environments and rollback
  bundle.js           <- optional faster copy: bundles, packed templates, compaction, preloads
  check-server.js     <- checks that a real web server serves a deployed site correctly
  create-project.js   <- starts a new project
  clean-sample.js     <- removes the sample app from a copy of this repository
  stamp.js            <- for publishers: writes file lists and checksums into manifests
  test.js             <- runs the Node tests and the browser tests
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
tests/node/           <- Node tests (node node-tools/test.js); browser tests are in ViRaSPA/tests/
.github/workflows/    <- CI: runs the tests on every push
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
- **Letting the page choose:** the author picks the mode. With `static allowedIsolation = ["full", "scoped"]` the author also lets a page choose, e.g. `<owzy-box isolation="scoped">` to let a CSS framework reach in. Modes that aren't allowed are refused, with a console warning.

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

### Official components, helpers and extensions

The [ViRaSPA-Extensions](https://github.com/RuzoOwzy/ViRaSPA-Extensions) repository holds the official optional packages, in two kinds:

- **Components** (`vs-card`, `vs-stat-tile`, `vs-login-form`…): custom elements.
- **Helpers** (planned: `forms`, `data-entry`, `filter`, `tooltip`): behaviour and APIs without an element of their own, each under one `Viraspa.<namespace>`, e.g. `Viraspa.forms`.

A project installs only the ones it uses:

```bash
node node-tools/install.js add component vs-card@0.1.0
```

- **Where it goes:** `components/vs-card/`, described by its `component-viraspa.json`.
- **Loading:** like core components, it loads the first time `<vs-card>` appears.
- **Not installed:** the console says so, with the command to install it.

Helpers install the same way:

```bash
node node-tools/install.js add helper forms@0.1.0
```

- **Where it goes:** `helpers/forms/`, described by its `helper-viraspa.json` (`name`, `version`, `releaseDate`, `frameworkVersion`, `namespace`, `scripts`, `styles`, `dependencies`).
- **Loading:** a component that needs a helper loads it by itself. For your own code, list it in `app/config/startup.js` (`helpers: ["forms"]`); helpers load before extensions and the app's files.
- **Locked:** once loaded, `Viraspa.<namespace>` can't be replaced.

**Dependencies.** A component or helper manifest may list what it needs:

```json
"dependencies": [{ "kind": "helper", "name": "forms", "version": "0.1.0" }]
```

`version` is the lowest version that works. `install.js add` installs and pins missing dependencies from the same download source, warns when a pinned one is older, and `remove` warns when something still needs what you remove.

**Extensions** are third-party bundles in `extensions/<name>/`, described by `extension-viraspa.json`. A minimal manifest:

```json
{
  "name": "owzy",
  "version": "1.0.0",
  "releaseDate": "2026-11-06",
  "author": { "name": "Owzy", "email": "…", "website": "https://…", "organization": "…" },
  "contributors": [{ "name": "…", "email": "…", "website": "…" }],
  "tagPrefix": "owzy",
  "frameworkVersion": { "min": "0.1.0", "max": "0.9.9", "supported": [], "excluded": ["0.1.3"] },
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
- **Theme variables and framework classes:** extensions may *use* `--vs-*` variables but not *define* them, and may not style the framework's own `.vs-*` classes. Styles that do are not applied.
- **Locked namespaces:** `Viraspa.core`, `services`, `utility`, `icons`, `toast`, `extensions`, `cache`, `session`, `busy`, `head`, `state`, `expressions`, `format` and `i18n` are frozen after startup, so no code can replace framework functions. Use the APIs instead, e.g. `Viraspa.core.setGuard(fn)`.

### Templates and bindings

One rule: **anything inside `{{ }}` is code; everything outside it is plain text.** It works the same in text, in attributes and in binding attributes.

Names are looked up in this order:

1. the block's own names (repeat items);
2. the page's or component's model (`.model.json` and props);
3. the page or component itself (its fields, signals, computed values and methods);
4. the helpers `t()` and `format`.

A plain value is filled in once. A **signal** stays live: when it changes, only the places that use it update.

| Syntax | Does |
| --- | --- |
| `{{x}}` | inserts a value as text, always escaped. Paths work: `{{user.address.city}}`. |
| `{{{x}}}` | inserts trusted raw HTML |
| `\{{` | writes a literal `{{` |
| `attribute="…{{x}}…"` | sets any attribute. A lone true/false toggles it: `disabled="{{ !canSave }}"`. |
| `data-bind-show-if="{{expr}}"` | hides or shows an element; it stays in the page |
| `<template data-bind-if="{{expr}}">` | adds or removes a block |
| `<template data-bind-repeat="{{list}}" data-bind-item="user" data-bind-key="{{user.id}}" data-bind-index="i">` | one block per item. With a key, blocks are reused when the list changes. |
| `data-bind-two-way="{{name}}"` | input ↔ value (text, number, checkbox, radio, select) |
| `data-bind-on-click="{{save}}"`, `data-bind-on-input="{{ remove(user) }}"` | calls a method on any event; `$event` is available |

**Expressions** are read by a small built-in parser, not `eval`, so templates work under a strict Content Security Policy. They can only reach the values listed above, never `window`, `document` or prototypes. They support:

- values, `a.b`, `a[0]`, calls, and `{ object }` and `[array]` literals;
- `! - + * / %`, comparisons, `&& || ??` and `a ? b : c`;
- **pipes:** `{{ total | currency }}`, `{{ d | date:"invoiceDate" }}`, `number`, `percent`, `time`, `relative`, `upper`, `lower`, `default`, `join`, `t`. Add your own with `Viraspa.format.addPipe(name, fn)`.

Anything more complex belongs in a `computed` in JavaScript.

**Safety:** text is always escaped. URL attributes (`href`, `src`, `action`, `formaction`, `poster`) never take `javascript:`, `vbscript:` or non-image `data:` values. Templates are parsed inert (in a `<template>`), so nothing loads before binding.

**Opt-in:** native pages (`native: true`) and native components are never processed.

### Signals

```js
const { signal, computed, effect, batch } = Viraspa.state;
const count = signal(0);
const double = computed(() => count.value * 2); // lazy, cached
effect(() => console.log(count.value, double.value)); // runs now and on every change
count.value++;
batch(() => { count.value = 5; count.value = 6; }); // the screen updates once
```

- **In pages and components:** fields that are signals are visible to the template. `this.effect(fn)` and `this.listen(target, type, fn)` are cleaned up automatically when the page is removed or the component leaves the page.
- **Other helpers:** `untracked(fn)` reads without subscribing; `signal.peek()` reads the current value; `signal.update(fn)` changes it.
- **Size:** about 2 KB of plain JavaScript.
- **Example:** see `app/pages/live-demo/` (`/live-demo`), a cart with a computed total, a keyed list, two-way inputs and events.

A simple shared **store** is just a module of signals:

```js
// app/state/cart.js
Viraspa.app = Viraspa.app || {};
Viraspa.app.cart = { items: Viraspa.state.signal([]), get count() { return this.items.value.length; } };
```

### Languages (i18n)

**Natural keys:** the text in your default language *is* the key, so templates stay readable and untranslated text still shows.

```js
Viraspa.i18n.configure({
  defaultLocale: "en",
  locales: [{ code: "en", name: "English", file: true }, { code: "sw", name: "Kiswahili" }],
});
```

**Where translations live:**
- **The app's:** `app/i18n/<code>.json`, e.g. `{ "Sign In": "Ingia" }`.
- **A page's own:** for a route with `i18n: true`, beside its files as `<name>.i18n.<code>.json`, one per language except the default (whose texts are the keys). To give the default language a file too (e.g. for plural forms), list the languages instead: `i18n: ["en", "sw"]`.
- **The default language** needs a file only for its plural forms (`file: true`).

**Plurals:** `{ "{count} item": { "one": "{count} item", "other": "{count} items" } }`, chosen with `Intl.PluralRules`. Exact counts such as `"=0"` work too.

**Using translations:**
- **In HTML:** `<h1 data-i18n>Users</h1>`, and `data-i18n-attr="placeholder,title"` for attributes.
- **In templates:** `{{ t("Welcome back, {name}.", { name: user.name }) }}`, which stays live.
- **In code:** `Viraspa.i18n.t(...)`.

**Changing the language:** `await Viraspa.i18n.setLocale("sw")`.
- The choice is remembered.
- It updates `<html lang>` and `dir`; right-to-left languages such as Arabic and Hebrew get `rtl`.
- It updates translations, menus, `data-i18n` and every live binding, and emits `viraspa:localeChanged`.

At startup the language is the saved choice, else the browser's languages, else the default.

### Formats

Formats are named once, in plain-language terms, and follow the current language:

```js
Viraspa.format.configure({
  dateFormats: [{ name: "invoiceDate", pattern: "dd-MMM-yyyy" }, { name: "long", preset: "long" }],
  numberFormats: [{ name: "default", minDecimalPlaces: 0, maxDecimalPlaces: 2 }],
  currencies: [{ code: "TZS", decimalPlaces: 0, display: "code" }],
  defaults: { currency: "TZS", dateFormat: "medium" },
});
format.date(invoice.date, "invoiceDate"); // 07-Nov-2026 / 07-Nov-2026 (sw: month names from Intl)
format.currency(1250000);                 // TZS 1,250,000
format.relative(lastSeen);                // 3 days ago / siku 3 zilizopita
```

- **What a date format accepts:** a name, a preset (`short`, `medium`, `long`, `full`) or a pattern.
- **Pattern tokens:** `yyyy yy MMMM MMM MM M dd d EEEE EEE HH H hh h mm ss a 'text'`.
- **Other functions:** `number`, `percent`, `time`, `dateTime`.
- **Who wins:** a value given in the call, then the user's preference (`Viraspa.format.setPreferences({ dateFormat, currency })`), then the app's `configure`.
- **Rare cases:** `intlOptions` on any entry is passed straight to `Intl`.

### Testing

```bash
node node-tools/test.js
```

- **Node tests:** `tests/node/*.test.js` run with `node --test`. They cover signals, expressions, formats, translations, manifest rules and the tools.
- **Browser tests:** `ViRaSPA/tests/browser/*.test.js` run in `ViRaSPA/tests/run.html`, in the installed Edge or Chrome in headless mode. You can also open `/tests/run.html` while `serve.js` runs.
- **Other engines and phones:** `--engine firefox,webkit` and `--device "iPhone 15,Pixel 7"` run the browser tests through Playwright, installed once outside the project (`--playwright-folder`). `--bundled` runs them on a bundled copy. See [Documents/mobile-testing.md](Documents/mobile-testing.md), which also has a DevTools device-mode checklist and how to test on a real phone.
- **CI:** a GitHub Actions workflow (`.github/workflows/tests.yml`) runs them on every push: Node tests, headless Chrome (plain and bundled), Firefox, WebKit, iPhone 15 and Pixel 7.

**Browser test helpers** (`Viraspa.testing`):

```js
const { test, assert, mount, render, mockEndpoint, fakeClock } = Viraspa.testing;
test("the card shows its heading", async () => {
  const card = await mount("vs-card", { heading: "Hello" });
  assert.equal(card.shadowRoot.querySelector(".heading").textContent, "Hello");
});
test("users load", async () => {
  mockEndpoint(Viraspa.endpoints.users.list, [{ id: 1, name: "A" }]); // no network
  const clock = fakeClock(); // controls Date.now and timers: clock.tick(ms)
});
```

`reset()` runs before every test: it signs out, clears saved settings, removes mounted elements and undoes mocks and clocks.

### Lifecycle events

Framework events are DOM `CustomEvent`s whose names start with `viraspa:`. Listen with `document.addEventListener("viraspa:pageAfterLoad", handler)`.

- **App:** `appInit`. Project init code registered with `Viraspa.core.onInit(async () => …)` in `app/config/init.js` is awaited before the layout and the first page.
- **Layout:** `layoutBeforeLoad`, `layoutOnLoad`, `layoutAfterLoad`.
- **Route guard:** `routeBeforeGuard`, `routeOnGuard`, `routeAfterGuard`. `routeChanged` fires after a page is shown: hook analytics page views to it. `layoutChanged` fires when the shell switches.
- **Session and busy:** `sessionChanged` (`{ signedIn, user, reason }`), `busyStart`, `busyEnd`.
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
| `title`, `head` | the tab title, and the page's head information (see [Head information and SEO](#head-information-and-seo)) |
| `nav` | `{ label, icon, menus, order, divider: "before" }` lists the route in a `vs-menu`.<br>• `menus` defaults to `["main"]`.<br>• `icon` is e.g. `"lucide:house"`.<br>• A list of such entries shows it differently per menu.<br>• Routes the user can't open are left out. |
| `layout` | `"public"`, `"private"` or `"inherit"` (the default): which shell surrounds the page (see [Layouts](#layouts)) |
| `access` | `"private"` needs a signed-in user |
| `requires` | `{ privileges: [...], match: "all" \| "any", roles: [...] }` needs those privileges or roles |
| `keepAlive` | `true` keeps the page's DOM and state when the user leaves, so coming back is instant. At most `settings.pageCache.maxPages` (default 5) pages are kept; the oldest goes first. Private pages are dropped on sign-out. |
| `native` | `true` for a plain page (see above) |
| `prerender` | `true`: `prerender.js` writes a ready-made copy (public routes only) |

**The guard** decides whether a route may open. The default, `Viraspa.session.guard`:

- sends signed-out users to the login page with `?returnTo=`;
- shows the session's `forbiddenRoute`, or the not-found page, to signed-in users who lack a privilege.

Replace it with `Viraspa.core.setGuard(async (route) => true | false | "/some/path")`.

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
- **Wrong URLs** show the not-found page. Once `prerender.js` has written `prerendered/routes.json`, `serve.js` and the server rules from `deploy.js` also answer them with status 404.
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

### Layouts

`index.html` can hold several shells around the one `#page-root`, e.g. a public website and a private app:

```html
<vs-header sticky>
  <vs-brand slot="brand" name="VSales"></vs-brand>
  <vs-menu menu="main" data-layout-only="public"></vs-menu>
  <a slot="end" href="/login" data-layout-only="public" data-visible-when="signed-out">Sign In</a>
  <vs-user-menu slot="end" source="session" data-visible-when="signed-in"></vs-user-menu>
</vs-header>
<div class="app-body">
  <vs-sidebar collapsible data-layout-only="private">
    <vs-menu orientation="vertical" menu="side"></vs-menu>
  </vs-sidebar>
  <main id="page-root"></main>
</div>
<vs-footer data-layout-only="public">© 2026</vs-footer>
```

- **Switching:** elements with `data-layout-only="private"` (a space-separated list) show only while the current route's `layout` is one of those names.
- **Built once:** all the shell elements stay in place, so switching between layouts never rebuilds them.
- **`"inherit"` (the default):** keeps the current layout, so pages like Features, About and Contact work in both. The first page without a layout gets `"private"` if it is private, else `"public"`.
- **From code:** `Viraspa.core.setLayout(name)` and `currentLayout()`.

### Session and privileges

The framework handles what every app needs:

- storing the session (`localStorage`);
- privilege and role checks;
- guarding routes;
- adding the token to API calls;
- reacting to `401` answers and to expiry;
- keeping browser tabs in step.

The project supplies an **adapter** that talks to its own backend, in `app/config/init.js` or `app/config/session.js`:

```js
Viraspa.session.configure({
  adapter: {
    async login({ username, password, rememberMe }) {
      // call your API; throw new Error("Wrong email or password.") on failure
      return { user: { id, name, email }, token, privileges: ["users.view"], roles: ["admin"], expiresIn: 3600 };
    },
    async logout(session) {},       // optional: tell the backend
    async loginWith(providerId) {}, // optional: OAuth etc. (the framework doesn't implement providers)
  },
  loginRoute: "/login",
  homeRoute: "/dashboard",
  forbiddenRoute: "/forbidden",
});
```

**Every automatic behaviour can be switched off or replaced:**

| Option | Default | Choices |
| --- | --- | --- |
| `onUnauthorized` (an API call answered 401) | `"logout"` | `"logout"` (with a message, then the login page), `"notify"` (a message only), `"ignore"`, or `function(info)` |
| `onExpired` | `"logout"` | same choices |
| `attachToken` | `true` | `true`: `Authorization: Bearer …` on calls to the endpoints' base URL only. `false`, or `(url) => boolean`. |
| `syncAcrossTabs` | `true` | signing in or out in one tab applies to the others |
| `slidingExpiry` | `0` | minutes added to the expiry on each successful API call |

**In code:**
- **Signing in and out:** `login(credentials)`, `loginWith(id)`, `logout({ navigate })`.
- **State:** `isSignedIn()`, `user()`.
- **Checks:** `hasPrivilege(p)`, `hasAnyPrivilege([...])`, `hasAllPrivileges([...])`, `hasRole(r)`, `canAccess(route)`.
- **After signing in:** `returnPath()` gives the page to go back to.

**In HTML** (applied after every render and whenever the session changes):

| Attribute | Meaning |
| --- | --- |
| `data-privilege-required="users.edit users.delete"` | needs these privileges |
| `data-privilege-match="any"` | any of them (default `all`) |
| `data-privilege-denied="hide"` | what happens without them: `hide` (default), `disable` or `readonly` (form fields inside become read-only) |
| `data-role-required="admin manager"` | needs any of these roles |
| `data-visible-when="signed-in"` / `"signed-out"` | follows the session |

Checks in the browser only shape what the user sees. **The backend must enforce every privilege itself.**

### Busy and cancellation

```js
const users = await Viraspa.busy.run(
  ({ signal }) => Viraspa.services.communication.call(Viraspa.endpoints.users.list, { signal }),
  { message: "Loading users...", target: ".table-wrap", signal: this.signal }
);
```

- **Indicator:** a `<vs-busy-indicator>` covers the `target`, or shows a small indicator at the top of the window when there's no target.
- **Delay:** it appears only after `delay` ms (default 200), so quick work never flashes a spinner.
- **Several runs:** runs on the same target share one indicator.
- **Cancelling:** the work gets a `signal` that aborts when the page's signal aborts (the user left) or when `Viraspa.busy.cancelAll()` runs.

### Remote mode

The framework's files are found relative to `viraspa.js`, so the framework can be served from a CDN instead of being installed, e.g. `<script src="https://cdn.jsdelivr.net/gh/RuzoOwzy/ViRaSPA@v0.1.0/ViRaSPA/viraspa/viraspa.js"></script>`. CDN files carry no token, since the URL already names the version. This works once version tags are published.

### Cache strategies

Every URL the framework loads carries a token, so browsers never use a stale copy after a release.

- **Framework files** use the framework version (`viraspa/core/router.js?v=0.1.0`).
- **App files** use the app token, chosen by `Viraspa.settings.cache.strategy` in `index.html`:

| Strategy | App token | Use when |
| --- | --- | --- |
| `release` (default) | `app.version` + the digits of `app.releaseDate`, e.g. `0.1.0-20261106120000` | you bump the version and date on each release |
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
- **What to commit:** `index.html`, `app/` and `node-tools/`. Git ignores `viraspa/`, `components/`, `helpers/`, `extensions/` and `lib/`.
- **On a new computer:** one command brings back exactly the same files.

```bash
node node-tools/install.js restore
```

| Command | Does |
| --- | --- |
| `add component vs-card@0.1.0` | installs and pins, with its dependencies (also `helper`, `extension`, `library`) |
| `update framework@0.3.0` | installs another version and updates the pin. For the framework it also updates `?v=` in `index.html`. |
| `remove component vs-card` | deletes the files and the pin |
| `restore` | reinstalls anything missing or changed, and refuses files that don't match their pin |
| `verify` | compares the installed files with the pins and changes nothing; exit code 1 on a problem |
| `list` | shows the pins |

**Download sources:**

- **`official`:** the ViRaSPA and ViRaSPA-Extensions GitHub repositories through jsDelivr.
- **`npm`:** npm packages through jsDelivr, for libraries.
- **Your own:** listed in `downloadSources`:
  ```json
  "downloadSources": [
    { "name": "company", "type": "folder", "location": "D:\\Shared\\ViRaSPA" },
    { "name": "offline", "type": "zip", "location": "D:\\Downloads\\viraspa-bundle.zip" },
    { "name": "extensions-repository", "type": "folder", "location": "../ViRaSPA-Extensions/{kind}/{name}" }
  ]
  ```
- **Layout under a location:**
  - `framework/<version>/`
  - `components/<name>/<version>/`
  - `helpers/<name>/<version>/`
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

## Head information and SEO

Each route describes its head information. On every navigation the framework updates `<title>`, the description, the canonical address, and the Open Graph and Twitter preview tags:

```js
head: {
  title: "About VSales",                     // falls back to the route's title
  description: "Who we are and what we do.",
  image: "app/assets/images/share/about.png", // the shared-link preview picture (about 1200×630)
  icon: "app/assets/icons/about.svg",         // optional: this page's own tab icon
}
```

- **Two different pictures:** the favicon stays site-wide in `index.html`; `image` is the preview card in WhatsApp, Facebook, LinkedIn, X and so on.
- **Data that arrives later:** a page sets its values with `this.setHeadData({ name })` (filling `{{name}}` placeholders in `head`) or `this.setHead({ title, description, image })`.

### Prerendering: prerender.js

Search engines and link-preview bots often don't run JavaScript. `prerender.js` writes a ready-made copy of every public route with `prerender: true` to `prerendered/<path>/index.html`, beside `index.html`:

```bash
node node-tools/prerender.js --live-site-address https://vsales.example.com
```

**How much it writes** is set by `renderLevel`:

- **`headTagsOnly`** (default, fast): index.html with that page's head tags. That's enough for link previews.
- **`fullPage`:** also the page's rendered content, using the Edge or Chrome already on the computer in headless mode. Nothing is downloaded.

**Where the pages come from:** a temporary local server it starts itself, so your own server isn't touched.

**Private routes are never prerendered.**

**Also written:** `prerendered/routes.json`, the list of known routes, so servers answer other addresses with a real 404.

**After it runs:**
- `serve.js` and the deploy server rules serve these copies automatically.
- The folder is created only by the tool and is ignored by git.
- In the browser, the app takes over the prerendered page seamlessly.

### Dynamic pages (profiles, products…)

Pages whose data changes, like `/profile/amina`, can't be prerendered. The standard answer is **head injection at request time** by whatever server serves `index.html`, in any backend language:

1. A request for `/profile/amina` arrives.
2. The server looks up the public profile and inserts its `<title>`, description and `og:image` into a copy of `index.html`, using the same tags `prerender.js` writes. A private profile gets only generic tags, so nothing private leaks.
3. A preview bot reads those tags; people get the normal app, which fills the same values with `this.setHeadData(...)`.

The route declares the placeholders (`head: { title: "{{name}} on VibeNet" }`), so the frontend and the server agree on one source. A ready-made Node reference hook is planned for the next plan.

## Deploying: deploy.js

A ViRaSPA site is static files, so deploying means copying the right files to the right place, safely:

```bash
node node-tools/deploy.js --target production --prerender
```

1. **Checks** that the framework, components and libraries match their pins, and restores them if not. So it also works on a server where nothing is installed yet (with Node.js there).
2. **Prerenders** public pages, with `--prerender`.
3. **Copies the site,** leaving out `app/project-viraspa.json`, `*.md`, `*.d.ts`, `*.map`, `tests/` and your `exclude` list.
4. **Writes `app/config/environment.js`** from the chosen environment's settings, e.g. the API address. The sample's `init.js` points the endpoints at `apiBaseAddress`. With `--bundle`, the release is then bundled (see [Bundling](#bundling-optional-bundlejs)).
5. **Writes `release.json`** (the `auto` cache strategy uses it) **and the server rules:** `web.config` for IIS (needs the URL Rewrite module), `.htaccess` for Apache (needs `mod_rewrite`, `mod_headers` and `AllowOverride All`), or two files beside the destination for nginx: `<destination>-nginx-http.conf` (include it in `http { }`) and `<destination>-nginx-server.conf` (include it in the site's `server { }`). The rules give you prerendered pages, the `index.html` fallback for routes (any letter case, with or without a trailing slash), real 404s, `no-cache` for every HTML answer and `release.json`, and they hide the tool settings.
6. **Copies into `<destination>.new`, then swaps it in at once.** The old release becomes `<destination>.previous-<its token>`; the newest `keepPrevious` are kept. If Windows or IIS holds the folder open, it copies over it in place instead.

`--rollback` puts the newest previous release back, `--zip <file>` writes the release as one file, and `--dry-run` shows the steps without doing them.

```json
"deploy": {
  "targets": [
    { "name": "production", "destination": "D:\\Sites\\vsales", "serverType": "iis", "environment": "production", "keepPrevious": 2 }
  ],
  "environments": [
    { "name": "production", "settings": { "apiBaseAddress": "https://api.vsales.example.com" } }
  ],
  "exclude": []
}
```

- **Remote uploads:** FTP, SSH and cloud uploads are not built in. Use `--zip` and your provider's own tools.
- **Checking a release:** `node node-tools/serve.js --site-folder <release folder> --port 8030` serves a deployed release.
- **Checking a real server:** `node node-tools/check-server.js --url https://staging.example.com` sends read-only requests and checks routes, prerendered pages, 404s, caching headers, the hidden settings file and file types (61 checks on the sample).
- **Tested with:** nginx 1.30.6 and Apache 2.4.70 (Apache Lounge) on Windows, all checks passing, with and without `--bundle`.

### Bundling (optional): bundle.js

A faster copy of the site, with the same behaviour. It is never required: the site works the same without it, and the source folder is never changed.

```bash
node node-tools/bundle.js
```

```bash
node node-tools/deploy.js --target production --bundle
```

The first writes the copy to `bundled/` (`--output-folder`); the second bundles the release while deploying it. Each step can be turned off (`--no-compact`, `--no-pack`…), or set in the `bundle` section of `app/project-viraspa.json`:

| Step | What it does |
| --- | --- |
| `framework` | `viraspa/viraspa.bundle.js`: the framework's files in the loader's order, plus the core components (handed to the component registry, so they still start only when first used). |
| `app` | `app/app.bundle.js` and `app/app.bundle.css`: the files listed in `app/config/startup.js`, in their order, plus the installed official components; `startup.js` is rewritten to load them. A remote (CDN) file keeps its place in the order. |
| `pack` | `app/viraspa-pack.js`: page and component templates, models, component CSS and manifests, served from memory (`assetLoader.addPack`) instead of one request each. Pages' own `.js` and `.css` still load when the page is opened. |
| `compact` | Comments, indentation and blank lines removed from `.js` and `.css`. Nothing is renamed or rewritten, line breaks stay, and strings, template literals and regular expressions are untouched. |
| `preload` | `<link rel="preload">` tags in `index.html`, so the bundles download while the loader starts. |

- **Same behaviour:** each file in a bundle runs in its own error boundary, so an error in one file doesn't stop the others (as with separate files). A file that declares names at its top level (`var`, `const`, `function`… outside any function) can't be wrapped; the report lists it. A syntax error stops the bundle with a clear message.
- **Checked:** `node node-tools/test.js --bundled` runs the browser tests against a bundled copy, and CI does it on every push.
- **Measured on the sample** (local server, About page): 88 requests become 22, and the first page shows in about 0.2–0.4 s instead of 0.9–1.2 s. The framework bundle is 32 KB gzip (28 KB brotli). Details in [the benchmark](Documents/benchmark.md).

**Secrets:** anything the frontend fetches is public, including `environment.js`, so never put secrets there. One frontend can also read a settings file an admin edits on each server: use `Viraspa.utility.assetLoader.fetchJson(path, { fresh: true })` in `init.js`.

## Documentation

See [Documents/](Documents/README.md):

- [Plans for the first version (0.1.0)](Documents/plans/README.md), milestone by milestone, with the [review](Documents/plans/M5-review.md) and the [N plan](Documents/plans/N-plan.md)
- [Benchmark](Documents/benchmark.md): ViRaSPA measured, compared with published figures for React, Angular, Vue, Svelte, Solid and Lit
- [Release notes](Documents/release-notes.md)
- [Framework design model](Documents/Modeling%20my%20Own%20Custom%20SPA%20Web%20Development%20Frontend%20Framework.txt) (a working draft)
