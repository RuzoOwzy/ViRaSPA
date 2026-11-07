# N5 report · GitHub Pages demo

## Done

| Item | Where |
| --- | --- |
| Demo site: overview, `vs-card`, `vs-stat-tile`, `vs-login-form` (working sign-in demo with a handler and provider buttons), not-found page | ViRaSPA-Extensions: `index.html`, `404.html`, `app/` |
| Framework in remote mode from jsDelivr, pinned to commit `46b3531`; icon libraries from the CDN | `index.html`, `app/config/init.js` |
| `<base>` set to the Pages sub-folder automatically on `*.github.io` | `index.html` |
| Framework support for sites in a sub-folder | `viraspa/core/router.js`, `core/session.js`, `vs-menu`, `vs-brand`, `vs-user-menu`; README "Serving from a sub-folder" |

## Problem found and fixed

GitHub Pages serves a project from `/<repository>/`, and the router matched routes against the full address, so no route would have matched there. The router now converts between the address and the app's own paths using `<base href>`; with `<base href="/">` nothing changes (all 32 browser tests pass as before).

## Verified

- The sample under a test server at `/sub/` (Edge through Playwright): deep link, menu and brand links (`/sub/…`), a click, Back, `navigate("/contact")`, `/sub/dashboard` → `/sub/login?returnTo=%2Fdashboard`, `/sub/About/` → `/sub/about`, not-found page; no errors or failed requests.
- The demo site locally with the real jsDelivr framework (port 8028, stopped afterwards): all four pages and the not-found page render; icons load from the CDN; the sign-in demo shows the error for wrong details and the success message for `demo@example.com` / `demo`.

## Waiting for the owner

GitHub settings need a signed-in owner (the browser pane is not signed in):

1. Rename the repository `ViRaSPA-Components` to `ViRaSPA-Extensions` (Settings → General → Repository name). GitHub redirects the old address.
2. Turn on Pages: Settings → Pages → Source "Deploy from a branch", branch `main`, folder `/ (root)`.

The demo is then at <https://ruzoowzy.github.io/ViRaSPA-Extensions/>.
