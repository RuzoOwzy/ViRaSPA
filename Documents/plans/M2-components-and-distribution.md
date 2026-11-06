# M2 · Components and distribution

## Core basic components (in the framework)
- **Shell:** `vs-header`, `vs-sidebar`, `vs-footer`, `vs-brand`.
- **`vs-menu`:** horizontal or vertical; collapses to icons with tooltips; a hamburger on small screens.
- **`vs-user-menu`:** a dropdown panel below the user's name. It never lists Dashboard.
- **Utilities:** `vs-icon`, `vs-busy-indicator`, `vs-toast`.
- Link text in Title Case.

## Icons
- An icon is an object, `{ set, name, style }`. New providers are registered with `Viraspa.icons.register`.
- **Providers:**
  - Font Awesome Free 7.x, self-hosted. Its `@font-face` is declared at document level so it works inside shadow roots.
  - Lucide (latest)
  - `char`, `svg` and `image`
- **Libraries** go in versioned folders, e.g. `lib/fontawesome/7.x/`.

## Extensions
- **Folder and manifest:** `extensions/<name>/` with an `extension-viraspa.json` manifest.
- **Manifest fields:**
  - `name`, `version`, `releaseDate`
  - `author { name, email, website, organization }`
  - `contributors [{ name, email, website }]`
  - `tagPrefix`, `files`
  - `frameworkVersion { min?, max?, supported[], excluded[] }`
- **Version precedence:** excluded > supported > min/max. A missing `min` or `max` means no limit on that side. Only `supported` given means list-only. Nothing given means any version, with a warning.
- **Reserved names:**
  - the `vs-` and `viraspa-` tag prefixes
  - the `viraspa:` event prefix
  - `--vs-` CSS variables
  - framework style names
  - `Viraspa.*`, which is frozen

  An extension that conflicts with these is rejected with a clear message.
- **Isolation:** an extension declares its isolation mode per component, with an optional `allowedIsolation`.

## Distribution
- **`viraspa/framework-viraspa.json`:** version, release date, file list and SHA-256 checksums.
- **`app/project-viraspa.json`:** fixed-key arrays. Each entry has a `checksum` (SHA-256 of downloaded content only, never of `app/`).
  - The framework, components, extensions and libraries are pinned here.
  - `downloadSources: [{ name, type: "web" | "folder" | "zip", location }]`, which entries reference with `downloadSource`.
- **`node-tools/install.js`:**
  - commands `add`, `update`, `remove`, `restore` and `verify`
  - `--download-source` and `--from` overrides
  - versions can't be overridden on `restore`
  - remote mode via jsDelivr
- **`node-tools/create-project.js`:** new project skeleton plus a project `.gitignore` that ignores `viraspa/`, `components/`, `extensions/` and `lib/`.
- **`node-tools/clean-sample.js`:** removes the sample app (`--dry-run`).
- **`index.html`:** `install.js update` rewrites the framework script's `?v=` token.

## Components repository
- **`RuzoOwzy/ViRaSPA-Components`** (structure approved), containing:
  - `vs-card`
  - `vs-stat-tile`
  - `vs-login-form`
- **`vs-login-form`** uses scoped isolation (for autofill).
  - Configurable: fields, labels, Remember Me, Forgot Password, the message position, and `providers[]` buttons that call the developer's adapter.
  - It submits through `Viraspa.session.login`.
- **GitHub Pages demos:** ask before enabling Pages.

## Docs
- Component documentation template; the Features page lists the new components.
