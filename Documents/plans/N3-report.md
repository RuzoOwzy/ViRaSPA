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

## Not done

- **IIS:** this session has no administrator rights, which installing the URL Rewrite module and creating a site need. `setup-iis.ps1` does both (and gives IIS read access to the test folder); after it runs, `node node-tools/check-server.js --url http://localhost:8033` checks the bundled IIS release. The IIS rules (including the new outbound rule) are therefore not yet verified on a real IIS.
