# N6 report · Dynamic pages

The plan item was the optional Node helper for previews of dynamic pages. Working on it showed that the router had no route parameters, so a page like `/people/3` couldn't exist as one route. Parameters were added first.

## Done

| Item | Where |
| --- | --- |
| Route parameters (`/customers/:id`), shared matching rules | `viraspa/core/route-paths.js`, `core/router.js`, `core/page.js`, `core/session.js`, `vs-menu` |
| Head placeholders filled from parameters; no half-filled values | `core/router.js`, `core/head.js` |
| Parameters in the tools | `node-tools/lib/routes.js`, `serve.js`, `lib/server-rules.js`, `prerender.js`, `check-server.js` |
| Node head injector, `serve.js --head-lookups` | `node-tools/lib/head-injector.js`, `serve.js`, `server-side/head-lookups.js` |
| ASP.NET Core reference | `server-side/aspnetcore/ViraspaSite.cs`, `server-side/README.md` |
| Routes in `release.json` for any backend | `node-tools/deploy.js` |
| Sample page `/people/:id`, linked from Home | `app/pages/person/`, `app/config/routes.js` |

## Problems found and fixed during the review

- **Half-filled titles:** `"{{name}} · ViRaSPA Sample"` showed " · ViRaSPA Sample" until the data arrived. A value with an unfilled placeholder now falls back to the route's plain title.
- **ASP.NET Core:** the first version also caught API endpoints (`/api/ping` answered 404), and the canonical link used the request's letter case. Endpoints now pass through, and the canonical uses the route's spelling.
- **A failing lookup** (database down) could turn a page into an error. Both injectors now log it and send the page with the route's plain tags.
- **One unexplained run:** the very first ASP.NET run answered 500 for `/people/*`; it never happened again in later cold starts and checks. The lookup hardening above means a lookup failure can no longer cause a 500.

## Verified

- Browser tests: 34 pass (two new: matching rules, and a `/People/3/` visit giving `this.params`, the corrected address and the filled title), plain and bundled.
- Node tests: 31 pass (new: parameter matching identical in the tools and the browser; the server rules for `/people/:id`; the head injector with lookups, 404s, private pages and a failing lookup).
- `serve.js --head-lookups server-side/head-lookups.js`: `/people/3` → 200 with "Clementine Bauch · ViRaSPA Sample" in `<title>` and the preview tags; `/people/999` and `/people/abc` → 404; prerendered pages unchanged.
- ASP.NET Core 10 test host (port 8034, stopped afterwards) serving a deployed sample release: `check-server.js` 65 of 65; `/people/3` and `/People/3/` → own title, description and canonical `…/people/3`; `/people/999` → 404; `/api/ping` → "pong".
