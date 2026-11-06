# M2 verification report

**Date:** 2026-11-06.
**How it was checked:**
- a preview on port 8028 (`node node-tools/serve.js --port 8028`) in the in-app browser (Chromium), stopped afterwards; port 8027 was not touched;
- the node tools, run from the command line.

## Results

| Area | Check | Result |
| --- | --- | --- |
| Shell | `vs-header`, `vs-brand`, `vs-menu` and `vs-footer` load by themselves from `index.html` markup; the menu is built from routes with Lucide icons; the active link has `aria-current` and follows navigation | Pass |
| `vs-menu` small screen | At 375 px the toggle shows and the list is hidden; clicking it opens the panel (`aria-expanded="true"`); it closes on a link, an outside click or Escape | Pass |
| `vs-sidebar` | The collapse button collapses the sidebar and its menus to icons (60 px), remembers the choice, and switches its label to "Expand menu"; hovering an icon shows the label as a tooltip | Pass |
| `vs-user-menu` | Name, initials and email; the panel opens and closes on an outside click; ArrowDown focuses the first item; selecting fires `vs-select`, runs the item's action and closes the panel | Pass |
| `vs-icon` | Lucide, Font Awesome (solid and brands), `char`, `image` and `svg` all render inside shadow roots; `label` gives `role="img"` and `aria-label` | Pass |
| `vs-busy-indicator`, `vs-toast` | The spinner and message show when `active`; toasts for success (`status`) and error (`alert`); auto-close after `duration`; `close()` works | Pass |
| Official components | `vs-card` (Home and About), `vs-stat-tile` and `vs-login-form` load from `components/` by convention. A missing one logs "not installed" with the install command | Pass |
| `vs-login-form` | Light DOM (no shadow root); autocomplete `username` / `current-password`; labels linked to fields; required message; busy state; a handler error shown with focus back on the password; the success event clears the password; the provider event can be cancelled | Pass |
| Extensions at runtime | A valid extension loads and its component renders. Rejected or blocked with clear console messages: an incompatible framework version (`max 0.1.9`), a missing extension, and an extension whose CSS defines `--vs-*` (it loads without those styles) | Pass |
| Reserved names | App code can't define `vs-fake`; `Viraspa.core.navigate` can't be overwritten (frozen) | Pass |
| Remote mode | With an absolute script URL, framework files load from that base without tokens, app files keep their tokens, and the shell renders | Pass (simulated on localhost; the real CDN needs published tags) |
| `install.js add` | Components from the local components repository (folder source with `{name}`); jQuery, Font Awesome 7.3.1 (6 files) and Lucide 1.70.0 (2,323 files, 1.1 MB) from npm via jsDelivr | Pass (Lucide needed a retry: the network dropped during 2,323 downloads, and retries were then added) |
| `install.js verify` / `restore` | A tampered component shows as `changed` and a deleted library as `missing` (exit code 1); `restore` brings back both, checked against the pins | Pass |
| Install-time checks | Extensions rejected: framework too new for `max`, version in `excluded`, reserved `tagPrefix` "vs". From a `.zip` (made by Windows, with backslash paths) it installs with the same checksum as from the folder | Pass |
| `stamp.js` | The three components and the framework were stamped (49 files); manifests were checked against the rules | Pass |
| `create-project.js` | Creates `node-tools/`, `site/` (template app plus the framework copy), `.gitignore`, `README.md` and `.gitattributes`; `install.js verify` in the new project reports the framework `ok` | Pass |
| `clean-sample.js` | Refuses to run in the framework repository; `--dry-run --force` lists exactly the sample paths and template resets | Pass |
| Regression (M1) | Navigation between all pages, keep-alive Home, the native page, Back, focus on `h1`; no console errors | Pass |

## Not verified

- **Official web source:** `install.js` reading the framework and components from GitHub through jsDelivr. It needs the repositories pushed and tagged (`v0.2.0`, `vs-card-v0.1.0`…), which hasn't happened. The npm source was verified for real.
- **Other browsers and devices:** Firefox and Safari, and real touch devices.
- **The new project in a browser:** it was created and verified with the tools, but not opened in a browser.

## Deviations from the plan

- **Version syntax:** `install.js` takes `name@version` instead of a `--version` flag, because `--version` is the standard "show the tool's version" flag on every tool.
- **Libraries no longer in git:** `lib/` is no longer tracked in this repository. Run `node node-tools/install.js restore` once after cloning.
- **Official components tracked for now:** `components/` (vs-card, vs-stat-tile, vs-login-form) stays tracked here until the components repository is published.
- **The components repository is local only:** it was built at `F:\Development\ViRaSPA\ViRaSPA-Components` (in the existing folder, with docs in `Documents/`). It was **not** created on GitHub and is not a git repository yet. That needs your go-ahead, and so does GitHub Pages.
- **No demo site yet:** the components repository has no demo site for GitHub Pages; it's planned together with the Pages decision.
- **No `allowedIsolation`:** the optional `allowedIsolation` manifest field wasn't added. Each component's author picks its mode, and nothing yet needs it.

## Proposed repository About (ViRaSPA)

> A no-build SPA framework in plain HTML, CSS and JavaScript: custom-element components with Shadow DOM, scoped or no isolation; routing; icons; and install/restore tools that pin every dependency by checksum. Write it 100% native if you like.

## Proposed repository About (ViRaSPA-Components)

> Official optional components for ViRaSPA, the no-build SPA framework: vs-card, vs-stat-tile, vs-login-form. Install one at a time with node-tools/install.js.
