# ViRaSPA

**ViRaSPA** is a no-build frontend framework for single-page applications (SPAs), written in plain HTML, CSS and JavaScript.

It keeps the structure that makes frameworks like Angular pleasant to work in (pages, components, lifecycle events, services, routing) but drops the build step. There is no TypeScript to transpile and no bundler: what you write is exactly what the browser runs, served by a small static dev server.

> **Status:** early design / milestone 1. The framework model is still a working draft, see [Documentation](#documentation).

## Why ViRaSPA

- **No build step**: edit a file, refresh the browser. No compile, transpile or bundle stage between source and output.
- **Familiar structure**: pages, components, services and routes, laid out the way an Angular-style frontend framework would, but in vanilla JS.
- **Load only what's needed**: pages and components are fetched from the server on demand and cached, not shipped all at once.
- **No hidden dependencies**: the core framework uses no third-party library. jQuery, Tailwind, Bootstrap, etc. are opt-in and declared visibly in `index.html`.

## Key concepts

### Pages and components
Every page and component lives in its own kebab-case folder, with its files sharing the folder's name:

```
pages/home/
  home.html
  home.css
  home.js
  home.model.json   <- data-binding model
components/nav-bar/
  nav-bar.html
  nav-bar.css
  nav-bar.js
  nav-bar.model.json
```

A component always lives inside a page. Its events propagate up to the page, and it inherits the page's settings unless it overrides them.

A page's base class fetches and renders its own `.html`, `.model.json` and `.css` by default, so a page only writes code for what it does differently (calling `await super.onLoad()` first).

A component's template and default model are fetched once per session and reused by every instance of it, on any page; each instance still gets its own copy of the model.

### Lifecycle events
The core framework emits `Before` / `On` / `After` events for:

- **Application init**: the first time the single page loads. Project init code registered with `Viraspa.core.onInit(async () => …)` (in `config/init.js`) is awaited before the layout and first page load.
- **Load**: a page or component is fetched and rendered.
- **Data binding**: the model is bound to and from the HTML.
- **Validation**: input is checked before a request.
- **Request**: an HTTP call (Fetch/Ajax) is made.
- **Route guard**: access is checked before a page loads.

### Services
- **Data-binding services**: read values from page/component elements into the model for outgoing requests, and bind incoming response data back to the model and the HTML.
- **Communication services**: run Fetch/Ajax/WebSocket calls. Pages call named endpoints from `config/endpoints.js` (see [Endpoints](#endpoints)).
- **Grouped services** (planned): several backend calls combined into one service per page/component, a frontend-side alternative to a GraphQL-style API.

### Routing
Routes live in `routes/routes.js`. Each one maps a URL path to a page folder; the page's files are found by the naming convention:

```js
{ path: "/about", name: "about", page: "pages/about", title: "ViRaSPA — About", access: "public", nav: { label: "About" } }
```

- **`page`**: the folder. `pages/about` → `about.js`, `about.html`, `about.css`, `about.model.json`. The page's `.js` registers its class as `Viraspa.pages["about"]`, matching `name`.
- **`nav`** (optional): lists the route in the nav bar, which is built from `routes.js`.
- **`access`**: `public` or `private`, checked by a pluggable `Viraspa.core.guard(route)` (it allows every route by default).
- **`Viraspa.notFoundRoute`**, also in `routes.js`: the page shown when nothing matches.

How a URL reaches a page:

- **Clicking a link** to one of the routes: the router cancels the full page load, updates the address bar (History API) and loads only the page area. Ctrl/Shift-clicks, `target="_blank"`, `download` and links to other paths behave like normal links.
- **Typing a URL, refreshing or opening a bookmark**: the browser requests that path from the server, which returns `index.html` for any path without a file extension. The router then reads the address bar and loads the matching page.
- **Back / Forward**: the router loads the page for the new address.
- **Matching**: paths are matched case-insensitively and without a trailing slash, so `/About/` opens `/about` (and the address bar is corrected).
- **Wrong URLs** such as `/nope` or `/about/team` show the not-found page. This 404 is visual only: the server still answers 200, since only the router knows the routes. A missing file with an extension (`/missing.js`) gets a real 404 from the server.
- **A misconfigured route** (page folder or files not following the naming convention) logs a clear console error and shows the not-found page.

`index.html` has `<base href="/">`, so relative paths always resolve from the site root, whatever the URL depth. If the app is served from a sub-folder, change it to that folder.

### Endpoints
Backend endpoints are defined once in `config/endpoints.js`, not in routes, and shared by every page:

```js
Viraspa.endpoints = Viraspa.services.communication.defineEndpoints({
  baseUrl: "https://jsonplaceholder.typicode.com",
  users: { list: { method: "GET", path: "/users" }, get: { method: "GET", path: "/users/{id}" } },
});
```

A page calls one by name, with optional path parameters, query values and a JSON body:

```js
const user = await Viraspa.services.communication.call(Viraspa.endpoints.users.get, { params: { id: 7 } });
```

The definitions are frozen. The base URL is read on every call and can be replaced at runtime with `Viraspa.endpoints.setBaseUrl(url)`, which accepts only an absolute `http`/`https` URL. `Viraspa.services.communication.request(method, url, body)` is still available for one-off calls.

### App shell and loading
- `index.html` stays minimal: a small kernel plus `core/bootstrap.js`, which loads the rest of the framework from `core/manifest.js`.
- The nav bar and footer are mounted once in a persistent shell; only the page area changes on navigation.
- `core/version.js` holds the project's version and ISO release date (`2026-10-29T18:00:00`). Together they form a cache-busting token appended to every URL the loader fetches, e.g. `home.js?v=0.1.0-20261029180000`.

## Conventions

- **Files and folders** (anything that appears in a URL): `kebab-case`, e.g. `services/communication/http-service.js`.
- **JS identifiers**: `PascalCase` for classes, `camelCase` for functions, variables and properties.
- **Namespace**: code uses `window.Viraspa`. The stylized name **ViRaSPA** is used only in text people see.

## Repository layout

```
ViRaSPA/          <- the framework itself (served folder)
  index.html
  core/           <- kernel, lifecycle, loaders, router, framework.js, version.js
  services/       <- data-binding and communication services
  routes/         <- routes.js
  config/         <- project configuration: endpoints.js, init.js
  pages/          <- sample pages
  components/     <- sample components
  utility/        <- generic helpers
  assets/, lib/   <- CSS, images, opt-in libraries
node-server.js    <- static dev server with SPA fallback
jsconfig.json     <- VS Code editor settings (autocomplete); not part of the framework
Documents/        <- developer documentation, release notes, design model
```

## Running locally

ViRaSPA needs a static server, not a `file://` double-click, because pages fetch their `.html` and `.model.json` files. With [Node.js](https://nodejs.org/) installed, run:

```bash
node node-server.js
```

Then open http://localhost:8027/ (set the `PORT` environment variable to use another port). The server falls back to `index.html` for client-side routes.

## Versions and using ViRaSPA in a project

This repository is where the framework is developed. Each release has an `x.x.x` version and a release date, stored in [ViRaSPA/core/framework.js](ViRaSPA/core/framework.js) and described in [Documents/release-notes.md](Documents/release-notes.md). At runtime they are available as `Viraspa.framework` and logged to the browser console at boot.

A project takes a copy of a specific release's `ViRaSPA/` folder and builds or customises on top of it. In that project:

- **Don't edit** `core/framework.js`. It records which framework release the project is based on.
- **Do edit** `core/version.js`, which is the project's own release version and date used for cache-busting, along with `routes/`, `config/`, pages, components and services.

## Deploying one frontend to many servers

A project may be installed on several servers, each with its own backend. The framework doesn't prescribe how an installation finds its backend; it gives the developer the hooks to do it:

- Write init code in `config/init.js` with `Viraspa.core.onInit(async () => …)`. It runs once at startup and is awaited before the layout and first page load, so no page calls the default URL first. A failing handler is logged and startup continues with the default.
- Call `Viraspa.endpoints.setBaseUrl(url)` there. Every endpoint call after it uses the new URL.
- To read a settings file an admin edits on the server, use `Viraspa.utility.assetLoader.fetchJson(path, { fresh: true })`, which bypasses the browser cache. An edit then applies on the next page load, without a new release.
- Anything the frontend fetches is public. Never put secrets (API keys, passwords) in such a file.

## Documentation

See [Documents/](Documents/README.md):

- [Release notes](Documents/release-notes.md)
- [Framework design model](Documents/Modeling%20my%20Own%20Custom%20SPA%20Web%20Development%20Frontend%20Framework.txt) (a working draft, open to improvement). Once it is finalised, it will become a Markdown guide for developers and AI agents.
