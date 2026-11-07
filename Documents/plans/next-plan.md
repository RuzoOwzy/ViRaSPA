# Next plan (after 0.2.0): draft for your review

This carries over everything [the 0.2.0 review](M5-review.md) left open, the two items planned for "next" from the start, and the improvements suggested by [the benchmark](../benchmark.md). Like the 0.2.0 plan, it runs milestone by milestone, with verification by me and then by you. **Nothing here starts without your approval.**

## Step 1 · Release 0.2.0 (your decisions)

1. **Mark 0.2.0 as released:** move "Unreleased" in the release notes to `0.2.0 (date)`, and set the final release date in `viraspa.js` and `framework-viraspa.json`.
2. **Push version tags:**
   - `v0.2.0` on ViRaSPA;
   - `vs-card-v0.1.0`, `vs-stat-tile-v0.1.0` and `vs-login-form-v0.1.0` on ViRaSPA-Components.

   Then test the parts that depend on them:
   - the official download source (`install.js restore` from GitHub through jsDelivr);
   - remote mode (the framework loaded from the CDN);
   - `create-project.js` followed by `restore` on a clean machine.
3. **GitHub Pages for ViRaSPA-Components:** a `demo/` site using the framework in remote mode, with one demo page per component.

## Step 2 · Hardening

- **Server rules:** test the IIS, Apache and nginx rules on a staging server and fix what's needed.
- **Other browsers:** Firefox and Safari, and real phones (touch, the sidebar and menu at small widths).
- **Two small behaviours:**
  - a sign-out on a page with `layout: "inherit"` switches to the public layout;
  - `--rollback` prunes old `rolledback-*` folders.

## Step 3 · Server-side head injection (reference)

**What it is:** a small Node helper, `node-tools/lib/head-injection.js`, plus an example server. For dynamic pages (e.g. `/profile/{username}`), it fills the route's `head` placeholders with public data before sending `index.html`. Private data gets generic tags.

**Contract:** documented for other backends (.NET, PHP…), using the same tags `prerender.js` writes.

## Step 4 · Component migration, phase 1 (agreed 2026-10-30)

**Where it lives:** an extension or official components rewritten from OwzyComponents.js (CTC2Web-Backend, 11 Sep 2026) and EliteWeb (vsales.viramol.co.tz).

**The rules:**
- plain vanilla JS (jQuery only if there's a real advantage, and only after you agree);
- prefixed tag names;
- each component has a version, an ISO release date, docs and a demo;
- CKEditor is **not** migrated.

**The components:**
- **Number input:** full decimals while focused, formatted when not, using the M4 formats.
- **Entry table:** EliteWeb's Sale.aspx rows, adding a row, Enter moves to the next field, plus new sorting and filtering.
- **Date input.**
- **Select.**
- **Popup.**
- **Tabs.**
- **A showcase page.**

## Step 5 · Component migration, phase 2

Combo, tree combo, autocomplete, context menu, progress, scroll area, slider, image viewer, file viewer and image crop.

## Step 6 · Performance options (from the benchmark; each one your choice)

- **`deploy.js --combine`:** joins the framework files into one file at deploy time; development stays unbundled.
- **`deploy.js --minify`:** about 40–50% smaller, at deploy time only.
- **Preload hints** for the framework files.
- **Lazy framework groups:** load `format`, `i18n` and `session` only when used.
- **A ViRaSPA entry in js-framework-benchmark**, to measure DOM update speed. This requires downloading and running the benchmark.
