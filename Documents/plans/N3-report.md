# N3 report · Real web servers

## Done

| Item | Where |
| --- | --- |
| nginx 1.30.6 (2.8 MB, nginx.org) and Apache 2.4.70 Win64 VS18 (14.5 MB, Apache Lounge) downloaded and configured on ports 8031 and 8032 | `F:\Development\ViRaSPA\Miscellaneous\test-servers` (outside git, with a README) |
| Three releases deployed with `deploy.js` (prerendered; nginx unbundled, Apache and IIS bundled) | `test-servers\sites\` |
| `check-server.js`: read-only checks of a running server | `node-tools/check-server.js` |
| No-cache for every HTML answer; nginx rules as two files | `node-tools/lib/server-rules.js`, `node-tools/deploy.js` |
| IIS set-up and removal scripts for an administrator | `test-servers\setup-iis.ps1`, `remove-iis.ps1` |

## Problems found and fixed

- **Stale entry pages possible.** On nginx, `/` and prerendered pages (`/about`, served from `prerendered/about/index.html`) came without `Cache-Control: no-cache`; IIS had the same gap (its rule covered only the root `index.html`). After a release, a browser could have kept an old page pointing at old files. nginx now marks every HTML answer `no-cache` (a map on the content type); IIS gets an outbound rewrite rule for `text/html`. Apache already covered it (`FilesMatch` on `index.html` matches prerendered copies too). The checker now tests every route for it.
- **The nginx rules had to be split by hand** (a `map` for `http { }`, the rest for `server { }`). deploy.js now writes two files and says where to include each.

## Verified

- `check-server.js` against nginx (unbundled) and Apache (bundled): 61 of 61 checks pass, including known routes in other letter case and with trailing slashes, prerendered copies, 404 with the app for unknown addresses and sub-addresses, 404 for missing files, the hidden `app/project-viraspa.json`, `no-cache` on HTML and `release.json`, and the file types of `.js`, `.css`, `.json`, `.svg` and `.woff2`.
- In the browser, on both servers: deep links, navigation between pages, the not-found page and the staging environment settings work, with no errors.
- Node tests: 29 pass (the server-rules test now checks both nginx files and no-cache).
- Both servers were stopped afterwards.

## IIS (done 2026-11-09)

The owner ran `setup-iis.ps1` as administrator. It installed URL Rewrite and created the site "ViRaSPA-test" on `http://127.0.0.1:8033` for the bundled release.

The site is bound to 127.0.0.1 only. `localhost` resolves to IPv6 `::1` first, so use `http://127.0.0.1:8033`, or every answer is http.sys's "400 Bad Request". This is a quirk of the test site, not of ViRaSPA.

The first check found **4 of 61 failing**, all in the generated `web.config`:
- **Every 404 became 200.** The error page used `responseMode="ExecuteURL"`, which answers with `index.html`'s own status. Unknown addresses and missing files answered 200, and so did the hidden `app/project-viraspa.json`: its rule's 404 was replaced by the app with 200. It is now `responseMode="File"`, which keeps the 404.
- **The known-routes test could never match.** It read `{URL}`, which starts with "/", while the pattern doesn't. The first problem hid this one. It now reads the matched path `{R:0}`, which is also right when the site is in a sub-folder.

After the fix, all **61 of 61 checks pass** on IIS 10 with URL Rewrite. In the browser:
- `/about` loads from the bundle and deep links work.
- `/no-such-page` shows the app's not-found page with status 404.
- A missing `.js` file and `app/project-viraspa.json` answer 404, and the settings file's content is not sent.

A Node test now checks both points of the IIS rules.

Releases deployed before this fix carry the old `web.config`; deploying again writes the new one.
