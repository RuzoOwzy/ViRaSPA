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

### Lifecycle events
The core framework emits `Before` / `On` / `After` events for:

- **Application init**: the first time the single page loads.
- **Load**: a page or component is fetched and rendered.
- **Data binding**: the model is bound to and from the HTML.
- **Validation**: input is checked before a request.
- **Request**: an HTTP call (Fetch/Ajax) is made.
- **Route guard**: access is checked before a page loads.

### Services
- **Data-binding services**: read values from page/component elements into the model for outgoing requests, and bind incoming response data back to the model and the HTML.
- **Communication services**: run Fetch/Ajax/WebSocket calls, using the HTTP method declared on the route.
- **Grouped services**: several backend calls can be combined into one service per page/component, a frontend-side alternative to a GraphQL-style API.

### Routing
- Path-based routing with the History API (`/about`, not `#/about`).
- Internal links are intercepted and loaded in the background, with no full page reload.
- Unknown paths render a dedicated not-found page.
- Each route can be marked `public` or `private`, checked by a pluggable `Viraspa.core.guard(route)`.

### App shell and loading
- `index.html` stays minimal: a small kernel plus `core/bootstrap.js`, which loads the rest of the framework from `core/manifest.js`.
- The nav bar and footer are mounted once in a persistent shell; only the page area changes on navigation.
- A single version string in `core/version.js` cache-busts every URL the loader fetches.

## Conventions

- **Files and folders** (anything that appears in a URL): `kebab-case`, e.g. `services/communication/http-service.js`.
- **JS identifiers**: `PascalCase` for classes, `camelCase` for functions, variables and properties.
- **Namespace**: code uses `window.Viraspa`. The stylized name **ViRaSPA** is used only in text people see.

## Running locally

ViRaSPA needs a static server, not a `file://` double-click, because pages fetch their `.html` and `.model.json` files. The planned dev server, `node-server.js`, serves the app and falls back to `index.html` for client-side routes.

## Documentation

The full framework model (a working draft, open to improvement) is in
[Documents/Modeling my Own Custom SPA Web Development Frontend Framework.txt](Documents/Modeling%20my%20Own%20Custom%20SPA%20Web%20Development%20Frontend%20Framework.txt).
Once the model is finalised, it will be turned into a Markdown guide for developers and AI agents.
