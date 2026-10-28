# ViRaSPA release notes

Versions follow `x.x.x` (major.minor.patch). The current release is recorded in
[`ViRaSPA/core/framework.js`](../ViRaSPA/core/framework.js), which must match the
newest entry below.

## Unreleased

**Breaking for projects built on 0.1.0:** routes use `page` instead of
`script` and no longer have `api`/`service`; pages call endpoints from
`config/endpoints.js` instead of `this.route.api`. Suggested version: 0.2.0.

### Changed
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

### Added
- `config/endpoints.js`: shared, frozen endpoint definitions with a base URL,
  called with `Viraspa.services.communication.call(endpoint, { params, query, body })`.
- `Viraspa.endpoints.setBaseUrl(url)` and `Viraspa.core.onInit(fn)` (awaited
  at startup, from `config/init.js`), so a project can point each
  installation at its own backend.
- `fetchJson(path, { fresh: true })` to bypass the browser cache.
- `.gitattributes` (LF line endings) and a fuller `.gitignore`.

### Fixed
- URLs with an extra segment or a trailing slash (`/about/team`, `/about/`)
  loaded a blank page; `index.html` now has `<base href="/">`, so they show the
  not-found page or the right page.
- A route whose page files are missing or misnamed now logs a clear error and
  shows the not-found page instead of a blank page.

## 0.1.0 (2026-10-28)

First release from the dedicated ViRaSPA repository. The framework was first
built inside the VSales-Frontend-Web project and moved here unchanged, apart
from the items listed under "Added in this repository".

### Included
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

### Added in this repository
- `core/framework.js`: framework-internal name, version and release date,
  exposed as `Viraspa.framework` and logged to the console at boot.
