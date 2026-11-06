# M3 verification report

**Date:** 2026-11-07.

**How it was checked:**
- a preview on port 8028 in the in-app browser (Chromium);
- temporary servers on 8029 (a deployed release) and 8030 (a new project);
- the node tools, from the command line.

All servers were stopped and all test output was deleted afterwards. Port 8027 was not touched.

## Results

| Area | Check | Result |
| --- | --- | --- |
| Signed out | `/features` is in the public layout with the main menu (Home, Features*, About, Contact); Sign In is shown; the user menu, sidebar and Dashboard link are hidden; the side menu has no stray divider; `data-visible-when` and `data-privilege-required` demos are correct | Pass |
| Private route | `/dashboard` while signed out redirects to `/login?returnTo=%2Fdashboard` | Pass |
| Login | `vs-login-form` with the Google and Microsoft provider buttons; a wrong password shows "Wrong email or password."; the right one returns to `/dashboard` | Pass |
| Private layout | Sidebar (Dashboard*, Users, Settings, divider, Features, About, Contact, Website), the user menu with the name from the session, no footer or main menu; four `vs-stat-tile`s; Chart.js loaded on demand under a busy indicator and drawn | Pass |
| Viewer privileges | Users: no Add button and Edit buttons disabled (10 rows). Settings: fields read-only, the select disabled, Save hidden, the read-only note shown | Pass |
| Admin privileges | Users: Add shown and Edit enabled; Settings: editable, Save shown, no note | Pass |
| Missing privilege | With `users.view` removed: `/users` redirects to `/forbidden` (No Access) and Users leaves the side menu | Pass |
| Other tab | A simulated `storage` event (session removed) signs this tab out | Pass |
| Sign Out | From the user menu: back to `/` in the public layout; the session removed from storage; kept-alive private pages dropped | Pass |
| User menu | Items: Profile, Change Credentials, Sign Out (no Dashboard) | Pass |
| Token and 401 | The `Authorization: Bearer` header goes only to the endpoints' base URL, never to another host; a 401 signs out, shows "Your session is no longer valid…" and goes to `/login?returnTo=%2Fusers` | Pass |
| Busy | `Viraspa.busy.run` without a target shows the top indicator and removes it afterwards; with a target it covers the table, the chart or the form | Pass |
| Head | Title, description, `og:*`, Twitter and canonical tags update per page | Pass |
| Native component | `<native-counter>` (no `Viraspa.*`) counts | Pass |
| `prerender.js` headTagsOnly | Four pages plus `routes.json`; correct title, description, canonical and `og:` tags; private `/dashboard` refused; an unknown route reported; no `liveSiteAddress` gives a clear note | Pass |
| `prerender.js` fullPage | Rendered with the installed Edge in headless mode from its own temporary server; the page content is inside `#page-root`; only the original three scripts | Pass |
| Prerendered in the browser | `/about` served prerendered; the app takes over with a single page (no duplicate content) | Pass |
| Real 404s | With `routes.json`: `/`, `/about` and `/dashboard` → 200; `/no-such-page` and `/about/team` → 404 (the app still shows its not-found page) | Pass |
| `deploy.js` | Dry run; real deploys; `--prerender`; `keepPrevious: 2` keeps two previous releases, named by their own token; `--rollback` restores the right release; staging `environment.js` written; tool settings and `*.md` left out; `web.config` (IIS) and nginx snippet written; `--zip` read back (2,476 entries, with environment and nginx rules); refuses a non-empty, non-release folder without `--force` | Pass |
| Deployed release in the browser | Served from the release folder on 8029: `production` environment, API address applied; 404 for unknown pages, the tool settings and `.htaccess` | Pass |
| `create-project.js` | A new project served on 8030 and opened in the browser: its name in the brand and title, Home menu, development environment, no console errors | Pass (this closes an M2 open item) |
| Regression | Home (5 cards, keep-alive), About, Contact, plain native page, not-found, Back; no console errors | Pass |

## Not verified

- **Real web servers:** the IIS, Apache and nginx rules were generated but not run on those servers. The local checks used `serve.js`, which follows the same rules. Test the rules on a staging server before production.
- **Expiry:** session expiry (`onExpired`) and `slidingExpiry` weren't waited out in real time. Their code shares the 401 path, which was tested.
- **Other browsers and real tabs:** Firefox and Safari weren't tested. Two real browser tabs weren't tested either; the "other tab" check was simulated with a `storage` event.
- **Server-side head injection:** documented with its contract only. The Node reference hook is planned for the next plan.

## Deviations and notes

- **`deploy.js` settings location:** its targets and environments are in the `deploy` section of `app/project-viraspa.json` (`deploy.targets`, `deploy.environments`, `deploy.exclude`), following the rule that each tool reads its own section. The plan said top-level `deployTargets` and `environments`.
- **The Website link:** a route's `nav` can be a list, so Home appears as "Home" in the public menu and "Website" in the side menu.
- **Sign-out on public pages:** signing out while on a public page that "inherits" the layout (e.g. No Access, Features) keeps the current layout until the next navigation.
- **Old rolled-back releases:** `<destination>.rolledback-*` folders from `--rollback` aren't pruned automatically.
