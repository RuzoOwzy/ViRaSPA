# ViRaSPA release notes

Versions follow `x.x.x` (major.minor.patch). The version is recorded in
[`ViRaSPA/viraspa/viraspa.js`](../ViRaSPA/viraspa/viraspa.js) (`FRAMEWORK`), which
must match the newest entry below.

## 0.1.0 · in development (first version, not released yet)

ViRaSPA has not been released yet: everything below is the first version,
still in development. Work is split into milestones, see [plans/](plans/README.md).
(Milestones M1–M5 were planned under the working number "0.2.0"; that number
was never released and is folded into 0.1.0.)

### Milestone N3 · Real web servers

- **Tested on real servers:** nginx 1.30.6 and Apache 2.4.70 on Windows, with deployed releases (prerendered pages; with and without `--bundle`): every check passes and the app works in the browser. IIS is prepared (`setup-iis.ps1` for an administrator) but not yet run.
- **`node-tools/check-server.js`:** read-only checks of a running server against what the server rules promise (routes in any letter case and with a trailing slash, prerendered pages, real 404s, `no-cache` for HTML, the hidden settings file, file types).
- **Fixed:** prerendered pages and `/` were served without `no-cache` on nginx and IIS, so a browser could keep an old entry page after a release. Every HTML answer is now `no-cache` (nginx: a map on the content type; IIS: an outbound rule).
- **nginx rules** are now two files beside the destination, `-nginx-http.conf` (for `http { }`) and `-nginx-server.conf` (for `server { }`), instead of one file to split by hand.

### Milestone N2 · Bundle tool (optional)

- **`node-tools/bundle.js`** writes a faster copy of the site, and **`deploy.js --bundle`** bundles a release. Steps, each optional: `framework` (`viraspa/viraspa.bundle.js`, with the core components), `app` (`app/app.bundle.js` + `.css` from `startup.js`, with the official components), `pack` (templates, models, component CSS and manifests in `app/viraspa-pack.js`), `compact` (comments and indentation removed; nothing renamed) and `preload`.
- **Same behaviour as separate files:** each bundled file runs in its own error boundary; component code is handed to the registry (`Viraspa.core.components.provide`) and still starts only when first used; syntax errors stop the bundle at build time.
- **`Viraspa.utility.assetLoader.addPack()`** and `isPacked()`: `fetchText`, `fetchJson` and `fetchStyleText` serve packed files from memory.
- **`test.js --bundled`** runs the browser tests on a bundled copy; CI runs it too. New Node tests for compaction and bundling.
- **Measured** (sample, `/about`): 88 requests become 22; the first page shows in 0.2–0.4 s instead of 0.9–1.2 s ([benchmark](benchmark.md)).

### Milestone N1 · Housekeeping

- **Version:** the framework is 0.1.0 in development (`Viraspa.framework.stage: "development"`); the console says "in development". Official components now require framework 0.1.0 or newer.
- **ViRaSPA-Extensions:** the components repository is renamed (it was ViRaSPA-Components) and holds official components and official helpers. The `official` download source points at it.
- **Helpers,** a new installable kind: `helpers/<name>/helper-viraspa.json` (`namespace`, `scripts`, `styles`); `install.js add helper …`; `startup.js` `helpers: []`; `Viraspa.core.components.loadHelper(name)`; a helper's `Viraspa.<namespace>` is locked once loaded.
- **Dependencies** in component and helper manifests (`[{ kind, name, version }]`): `install.js add` installs missing ones from the same source, warns about older pins, and `remove` warns about packages that still need what is removed. At runtime a component's helpers load before it.
- **Plans:** the approved [N plan](plans/N-plan.md) replaces the draft next plan.

### Milestone M5 · Benchmark and review

- **[benchmark.md](benchmark.md):**
  - ViRaSPA's measured runtime size (about 47 KB gzip / 40 KB brotli, unminified), startup requests, time to first page and navigation times;
  - next to published figures for React, Angular, Vue, Svelte, Solid and Lit, with each comparison point explained.
- **Review** of every plan item ([plans/M5-review.md](plans/M5-review.md)) and the next plan (now [N-plan.md](plans/N-plan.md)).
- **Added during the review:**
  - `allowedIsolation`: a component may let pages choose its isolation mode with `isolation="…"`;
  - extensions may not style the framework's `.vs-*` classes;
  - `manifestRules.reservedCssProblem` and isolation checks in manifests;
  - a `performance.mark("viraspa:pageShown")` on every page shown.

### Milestone M4 · Reactivity, i18n, testing

#### Added
- **Signals** (`Viraspa.state`, about 2 KB): `signal`, `computed` (lazy, cached), `effect` (with cleanup), `batch`, `untracked` and scopes. Pages and components get `this.effect()` and `this.listen()`, disposed automatically.
- **Safe template expressions** (`Viraspa.expressions`):
  - a parser, with no `eval` (CSP-safe);
  - values, members, calls, object and array literals, operators, ternaries and pipes;
  - prototype access is blocked.
- **Live template bindings:**
  - `{{x}}` stays live for signals; attribute interpolation; boolean attributes;
  - `data-bind-show-if`, `<template data-bind-if>` and keyed `<template data-bind-repeat>`;
  - `data-bind-two-way` and `data-bind-on-*`;
  - templates are parsed inert before binding.
- **`Viraspa.i18n`:**
  - natural keys, plurals (`Intl.PluralRules`, `=N`) and interpolation;
  - app files (`app/i18n/<code>.json`) and per-page files (route `i18n: true`);
  - `data-i18n` and `data-i18n-attr`;
  - `<html lang>` and `dir` with right-to-left detection;
  - the language is saved and picked from the browser;
  - live `t()` in templates and the `viraspa:localeChanged` event.
- **`Viraspa.format`:**
  - named `dateFormats`, `numberFormats` and `currencies` with plain-language options (`minDecimalPlaces`, `decimalPlaces`, `display`);
  - presets, patterns and `intlOptions`;
  - `number`, `currency`, `percent`, `date`, `time`, `dateTime` and `relative`;
  - user preferences and pipes, with `addPipe`.
- **Testing:**
  - `Viraspa.testing` (`viraspa/core/testing.js`): `test`, `assert`, `mount`, `render`, `mockEndpoint`, `fakeClock`, `reset` and `run`;
  - `tests/run.html` with 31 browser tests;
  - `tests/node` with 23 Node tests;
  - `node-tools/test.js` (Node tests plus headless browser tests);
  - the GitHub Actions workflow `tests.yml`.
- **Sample:** the Live Demo page (cart: signals, computed values, a keyed list, two-way inputs, events, formats); English and Swahili with a header language picker; translated menus and the user menu.

#### Changed
- **Rendering:** pages and components now render through the binding service (`Viraspa.services.databinding.render`). Plain `{{key}}` templates behave as before.
- **Component cleanup:** components dispose of their effects and listeners when removed from the page, and load again if added back.
- **Core components:** `vs-menu`, `vs-user-menu` and `vs-sidebar` use `this.listen` and translate their labels.

### Milestone M3 · App features

#### Added
- **`Viraspa.session`** (generic parts plus the project's adapter):
  - `login`, `loginWith`, `logout`, `isSignedIn`, `user`;
  - `hasPrivilege`, `hasAnyPrivilege`, `hasAllPrivileges`, `hasRole`, `canAccess`, `returnPath`;
  - stored in `localStorage`;
  - switches `onUnauthorized` and `onExpired` (`logout` / `notify` / `ignore` / function), `attachToken` (own API only by default), `syncAcrossTabs` and `slidingExpiry`;
  - the event `viraspa:sessionChanged`.
- **Privilege attributes:** `data-privilege-required`, `data-privilege-match`, `data-privilege-denied` (`hide` / `disable` / `readonly`), `data-role-required` and `data-visible-when`, applied after every render and on session changes.
- **Routes:** `access: "private"` and `requires: { privileges, match, roles }`. The default guard redirects to the login page with `?returnTo=`, or to `forbiddenRoute`. Guards may return a path to redirect to.
- **`Viraspa.busy`:** `run(fn, { message, target, delay, signal })` and `cancelAll()`, with the events `busyStart` and `busyEnd`.
- **Layouts:** route `layout` (`public` / `private` / `inherit`), `data-layout-only` on shell elements, `Viraspa.core.setLayout()` and the event `viraspa:layoutChanged`.
- **Head information:** route `head { title, description, image, icon }`; runtime updates of the title, description, canonical, Open Graph and Twitter tags; `page.setHead()` and `page.setHeadData()` with `{{placeholders}}`.
- **Prerendered content:** the router replaces it smoothly when the app starts.
- **Component changes:**
  - `vs-menu`: hides routes the user can't open, takes a list of `nav` entries per route, `nav.divider`, and drops stray dividers;
  - `vs-user-menu`: `source="session"`;
  - `communication.request`: adds the token, reports to the session, and handles `headers`, 204 responses and text answers.
- **Node tools:**
  - **`prerender.js`:**
    - `headTagsOnly`, or `fullPage` through the local Edge or Chrome in headless mode;
    - its own temporary server;
    - `routes.json` of known routes;
    - private routes refused.
  - **`deploy.js`:**
    - targets and environments, with `environment.js`;
    - `release.json` and the server rules (IIS / Apache / nginx);
    - an atomic swap with `keepPrevious`, a locked-folder fallback, `--rollback`, `--zip` and `--dry-run`;
    - it restores pinned items first.
  - **`serve.js`:**
    - serves prerendered `/`;
    - real 404 status for unknown routes;
    - can serve a deployed release (`--site-folder`).
  - **`lib/server-rules.js`, `lib/routes.js`;** zip writing; folder replacement with retries and an in-place fallback on Windows locks.
- **Sample app:**
  - **Shells:** public and private; Sign In and Dashboard header actions.
  - **Demo session adapter:** `admin@example.com` / `admin` and `viewer@example.com` / `viewer`.
  - **Pages:** Login (`vs-login-form`), Dashboard (`vs-stat-tile` plus Chart.js 4.6.1, loaded on demand), Users, Settings (read-only for viewers), Profile, Change Credentials, No Access, and Features (in both shells, with live demos).
  - **`native-counter`:** a plain custom element.
  - **Config:** `app/config/environment.js`, plus example deploy targets and environments.
- **Project template:** `environment.js` and an init example for the session.

#### Changed
- **The default guard** is now `Viraspa.session.guard` (it allows every public route as before).
- **Locked namespaces:** `Viraspa.session`, `busy` and `head` are locked like the other namespaces.

### Milestone M2 · Components and distribution

#### Added
- **Core components** in `viraspa/components/`, loaded the first time their tag appears (autoload): `vs-header`, `vs-brand`, `vs-menu` (from routes or items; vertical, collapsed with tooltips, and a small-screen toggle), `vs-sidebar` (collapsible, remembered), `vs-user-menu` (a dropdown panel, keyboard support), `vs-footer`, `vs-icon`, `vs-busy-indicator` and `vs-toast`, plus `Viraspa.toast.show()`.
- **Icons:** `Viraspa.icons` with the sets `fontawesome` (Free 7.3.1), `lucide` (1.70.0), `char`, `svg` and `image`; the short form `set:name[:style]`; `register()` and `configure()`.
- **Component registry and autoload** (`Viraspa.core.components`):
  - core components;
  - official components in `components/<tag>/` (`component-viraspa.json`);
  - extensions in `extensions/<name>/` (`extension-viraspa.json`, listed in `startup.js` `extensions`).
- **Manifest rules** shared by the browser and the tools (`viraspa/core/manifest-rules.js`):
  - framework-version compatibility (excluded > supported > min/max);
  - author and contributors;
  - reserved tag prefixes;
  - extensions may not define `--vs-*` variables.
- **`viraspa/framework-viraspa.json`:** the framework's manifest, with file checksums.
- **Remote mode:** framework files are found relative to `viraspa.js`, so the framework can come from a CDN.
- **Component API:** `Component.render()`, `prepareModel(model)`, `static hasModel` / `hasStyles`, and `ready` now waits for inner components.
- **Node tools:**
  - **`install.js`:** `add`, `update`, `remove`, `restore`, `verify` and `list`, with `name@version`. Sources are `official`, `npm` or your own web/folder/zip; `--download-source` and `--from` override them for one run; checksums are verified.
  - **`stamp.js`:** for publishers.
  - **`create-project.js`** and **`clean-sample.js`**, using a minimal project template.
  - **Also:** download retries, and BOM-tolerant JSON.
- **The ViRaSPA-Components repository (local, not yet published):**
  - components `vs-card`, `vs-stat-tile` and `vs-login-form` (scoped isolation, providers, message position);
  - a documentation template for components.

#### Changed (breaking)
- **Sample shell:** it now uses `vs-header`, `vs-brand`, `vs-menu` and `vs-footer`. The sample's `app-nav-bar`, `app-footer` and `app-card` were removed; `vs-card` replaces `app-card`.
- **Guard:** `Viraspa.core.guard = fn` is replaced by `Viraspa.core.setGuard(fn)`.
- **Frozen namespaces:** `core`, `services`, `utility`, `icons`, `toast`, `extensions` and `cache` are frozen after startup.
- **`defineComponent`:** it refuses `vs-` and `viraspa-` tags except for core and official components. The `allowReservedPrefix` option is gone.
- **Libraries in this repository:**
  - `lib/` is no longer tracked, and is restored with `install.js restore`;
  - `jquery.d.ts` moved to `app/assets/jquery-extensions/`.

### Milestone M1 · Foundation

#### Changed (breaking)
- **New layout:**
  - the framework moved to `viraspa/` (`viraspa.js`, `core/`, `services/`, `utility/`, `styles/`);
  - the project's code moved to `app/` (`config/`, `pages/`, `components/`, `assets/`);
  - libraries moved to versioned folders (`lib/jquery/4.0.0/`).
- **Startup files:**
  - `index.html` now loads one framework script, `viraspa/viraspa.js?v=<framework version>`;
  - the framework's file list lives in that loader, and the app's in `app/config/startup.js` (replacing `core/manifest.js`);
  - `routes/routes.js` moved to `app/config/routes.js`.
- **Versions:**
  - `core/version.js` was replaced by `Viraspa.settings` in `index.html` (`app.version`, `app.releaseDate`, `cache.strategy`);
  - `core/framework.js` was merged into `viraspa/viraspa.js`.
- **`node-server.js`** was replaced by `node node-tools/serve.js`, with the tools kept in `node-tools/` at the repository root.
- **`assets/css/general.css`** became `viraspa/styles/base.css`, with theme variables (`--vs-*`).
- **Events** are prefixed `viraspa:` and camel-cased, e.g. `page:beforeLoad` becomes `viraspa:pageBeforeLoad` and `app:init` becomes `viraspa:appInit`. `Viraspa.core.emit(name)` adds the prefix.
- **Components** are custom elements:
  - they extend `Viraspa.core.Component` (an `HTMLElement`) with `static tag`, `folder` and `isolation`, and are registered with `Viraspa.core.defineComponent`;
  - `mountComponent()` returns the element once it's ready.
- **`{{key}}`** is now HTML-escaped. Use `{{{key}}}` for trusted raw HTML.
- **The x-responsive grid** (and the jQuery extensions it uses) moved out of the framework into `app/assets/`.
- **Page templates** no longer use `<main>`: `#page-root` is the `<main>`.

#### Added
- **Browser feature check** with a clear "needs a newer browser" message, and a `<noscript>` message.
- **Favicon:** a crimson "V" with an upward arrow, as SVG, ICO and Apple touch icon.
- **Cache strategies:** `release`, `custom`, `auto` (`release.json` or the ETag of `index.html`) and `revalidate`. Framework files use the framework version as their token.
- **No-flicker navigation:**
  - a page's CSS is loaded before it is shown, and each page keeps its own stylesheet, switched on and off;
  - page files are fetched once per session;
  - the last navigation wins, and superseded ones are aborted.
- **Page features:**
  - `page.signal` (an `AbortSignal`) and `page.display()`;
  - `keepAlive` routes, limited by `settings.pageCache.maxPages`.
- **Route-change behaviour:**
  - focus moves to the new page's `<h1>`, with an announcer fallback;
  - scroll position is restored on Back/Forward;
  - same-page `#hash` links only scroll.
- **Isolation modes** for components: `full` (Shadow DOM, with `base.css` shared), `scoped` (`@scope`, or tag-prefixed selectors as a fallback) and `none`.
  - `componentRoot` and `documentShadow`;
  - `<slot>` works in every mode.
- **Native pages** (`native: true`) and the page events `viraspa:pageCreated`, `pageShown`, `pageHidden`, `pageRemoved` and `routeChanged`.
- **URL check** for placeholders in `href`/`src`/`action`/`formaction`/`poster`.
- **Reserved component prefixes:** `vs-` and `viraspa-`.
- **`node-tools/`:**
  - a shared option reader (flag > environment > config > default; `--help`, `--version`, `--save`)
  - the site-folder finder
  - `serve.js`: ETag/304, HEAD, no-cache, prerendered pages, a full MIME map, and it never serves `app/project-viraspa.json` or dot-files
  - `help.js`
- **`app/project-viraspa.json`**, the settings file for the node tools.
- **`signal`** option for `communication.call()`/`request()`.
- **Samples:** `/plain-native`, a page with no `Viraspa.*` calls, and `<app-note>`, a scoped component with a slot, on About.

#### Fixed
- **Flicker:** the page content appeared before its stylesheet had loaded.
- **Out of order:** overlapping navigations could finish out of order and show the wrong page.
- **Dev server path check:** it accepted sibling folders whose names started with the site folder's name.

### Earlier unreleased changes (before M1)

Routes use `page` instead of `script` and no longer have `api`/`service`;
pages call endpoints from `config/endpoints.js` instead of `this.route.api`.

#### Changed
- Routes take a page folder (`page: "pages/home"`); the page's files are
  derived by naming convention. `Page` has a default `onLoad` that renders
  the page's own files, so pages no longer call `fetchPage(...)` themselves.
- The not-found route moved from `core/router.js` to `routes/routes.js`
  (`Viraspa.notFoundRoute`).
- The nav bar builds its links from routes with a `nav` entry.
- Route paths are matched case-insensitively and without a trailing slash;
  the address bar is corrected to the route's own spelling.
- `core/version.js` has an ISO release date (`YYYY-MM-DDTHH:mm:ss`), and the
  cache token is `<version>-<date digits>`, e.g. `0.1.0-20261029180000`.
- Component templates and models are fetched once per session and shared by
  every instance; each instance gets its own copy of the model. Home mounts
  its cards in parallel.
- `jsconfig.json` (VS Code editor settings) moved to the repository root, so
  it's no longer served.

#### Added
- `config/endpoints.js`: shared, frozen endpoint definitions with a base URL,
  called with `Viraspa.services.communication.call(endpoint, { params, query, body })`.
- `Viraspa.endpoints.setBaseUrl(url)` and `Viraspa.core.onInit(fn)` (awaited
  at startup, from `config/init.js`), so a project can point each
  installation at its own backend.
- `fetchJson(path, { fresh: true })` to bypass the browser cache.
- `.gitattributes` (LF line endings) and a fuller `.gitignore`.

#### Fixed
- URLs with an extra segment or a trailing slash (`/about/team`, `/about/`)
  loaded a blank page; `index.html` now has `<base href="/">`, so they show the
  not-found page or the right page.
- A route whose page files are missing or misnamed now logs a clear error and
  shows the not-found page instead of a blank page.

### Starting point (2026-10-28)

The framework was first built inside the VSales-Frontend-Web project and moved
into this repository unchanged, apart from the items listed under "Added in this
repository". (This was a starting point, not a release.)

#### Included
- Page and component folders (`.html`, `.css`, `.js`, `.model.json`) with
  `Before`/`On`/`After` lifecycle events.
- Minimal kernel in `index.html`, with the rest of the framework loaded
  group by group from `core/manifest.js` by `core/bootstrap.js`.
- On-demand page/component loading (`core/page-loader.js`,
  `core/component-loader.js`), with per-page CSS swapping.
- Path-based routing with the History API, a visual not-found page, and a
  pluggable `Viraspa.core.guard(route)` for public/private routes (stub only:
  it allows every route).
- Persistent app shell: nav bar and footer mounted once at boot.
- Data-binding and communication services, with the HTTP method driven by
  the route's `api.method`.
- Cache-busting through the project version in `core/version.js`.
- Sample pages (home, about, contact, not-found) and components (nav-bar,
  footer, card).
- An "Explicit includes" section in `index.html` for opt-in libraries and
  the x-responsive grid.
- `node-server.js` static dev server with an SPA fallback.

#### Added in this repository
- `core/framework.js`: framework-internal name, version and release date,
  exposed as `Viraspa.framework` and logged to the console at boot.
