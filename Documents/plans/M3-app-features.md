# M3 · App features

## Session and privileges
- **Core:** `Viraspa.session` covers the generic parts; the developer supplies an auth adapter.
- **Storage:** `localStorage`.
- **Checks:** `hasPrivilege`, `hasAnyPrivilege`, `hasAllPrivileges` and `hasRole`.
- **Switches:**
  ```js
  configure({ onUnauthorized: "logout" | "notify" | fn, onExpired, attachToken, syncAcrossTabs, slidingExpiry })
  ```
- **Attributes:** `data-privilege-required`, `data-privilege-match` (`all` | `any`), `data-privilege-denied` (`hide` | `disable` | `readonly`) and `data-role-required`.
- **Routes:** `requires: { privileges: [...] }`.

## Busy and cancellation
- `Viraspa.busy.run(fn, { message, target, delay })`.
- Events `viraspa:busyStart` and `viraspa:busyEnd`.
- `page.signal` (introduced in M1) is wired into the communication service.

## Shells and the private sample
- **Shells:** a public shell and a private shell, built once. Content can change mid-session.
- **`layout: "inherit"`:** lets a route appear in both shells.
- **Private left menu:**
  - Dashboard, Users, Settings
  - a divider
  - About, Contact, Website
- **Sample pages:**
  - Login (`vs-login-form`)
  - Dashboard (Chart.js 4.6.1, self-hosted)
  - Users, Settings, Profile, Change Credentials
- **Features page:** in both shells. It lists every core capability with links, plus a plain native page and a native component written with no `Viraspa.*` calls.

## Head and prerender
- **Route `head`:** `{ title, description, image, icon }`. `image` is the shared-link preview picture; the favicon stays in `index.html`.
- **Runtime meta:** tags updated on every navigation.
- **Dynamic head (design and docs):** `head` placeholders plus `headData`, with a backend contract for request-time head injection.
- **`node-tools/prerender.js`:**
  - `prerender: { outputFolder, liveSiteAddress, localSiteAddress, renderLevel: "headTagsOnly" | "fullPage" }`
  - `fullPage` uses the locally installed Edge or Chrome in headless mode; nothing is downloaded.
  - Output goes to `prerendered/` beside `index.html`, is created only by the tool, and is gitignored.
  - It writes a list of known routes, so servers can return real 404s.
- **Server rules:** for IIS (`web.config`), Apache (`.htaccess`) and nginx.
- **`viraspa:routeChanged`:** documented for analytics.

## Deploy
- **Command:** `node-tools/deploy.js --target <name>`, or `--destination <path>`.
- **Steps:**
  1. Restore and verify the framework (it is fetched only if missing).
  2. Copy with exclusions.
  3. Write the release stamp (`release.json`).
  4. Prerender, if `--prerender` is given.
  5. Write the server rules.
  6. Swap safely via `.new` and `.previous` folders.
- **Options:** `--rollback`, `keepPrevious`, `--dry-run` and `--zip`.
- **Targets and environments:**
  - `deployTargets: [{ name, destination, serverType, environment, keepPrevious }]`
  - `environments: [{ name, settings }]`, written into `app/config/environment.js`.
- **Not built:** FTP, SSH and cloud uploads (use `--zip`), and minification.
