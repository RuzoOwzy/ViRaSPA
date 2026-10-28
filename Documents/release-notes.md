# ViRaSPA release notes

Versions follow `x.x.x` (major.minor.patch). The current release is recorded in
[`ViRaSPA/core/framework.js`](../ViRaSPA/core/framework.js), which must match the
newest entry below.

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
