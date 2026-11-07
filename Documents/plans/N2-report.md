# N2 report · Bundle tool

## Done

| Item | Where |
| --- | --- |
| `bundle.js` (framework, app, pack, compact, preload; each can be turned off; `bundle` config section) | `node-tools/bundle.js`, `node-tools/lib/bundle.js` |
| Compaction built on a small tokenizer: comments, indentation, blank lines; strings, templates and regexes untouched; `/*!` kept | `node-tools/lib/compact.js` |
| `deploy.js --bundle` (after the environment is written; preloads use the release token) | `node-tools/deploy.js` |
| Packed files in the asset loader (`addPack`, `isPacked`) | `viraspa/utility/asset-loader.js` |
| Bundled components run at first use (`components.provide`) | `viraspa/core/component-registry.js` |
| `test.js --bundled`, CI step, Node tests | `node-tools/test.js`, `.github/workflows/tests.yml`, `tests/node/tools.test.js` |
| Docs and measurements | README "Bundling (optional)", [benchmark](../benchmark.md), release notes |

## Problems found and fixed during the review

- **One failing file stopped the whole bundle.** The test page has no jQuery, so one app file throws while loading; in a single bundle that stopped every file after it (the routes never loaded). Each bundled file now runs in its own error boundary when that is safe, and files with top-level declarations are listed in the report.
- **Shell components started before the pack had loaded,** because the framework bundle defined them at once (unbundled, they are defined later). They are now handed to the registry and start at the same moment as before, so they use the pack.
- **`base.css`** was fetched again as text for shadow roots; it is in the pack now.
- **The output-folder check** misjudged folders on another drive; fixed.

## Verified

- `node node-tools/test.js`: 29 Node tests and 32 browser tests pass; `--bundled`: the same 32 browser tests pass on the bundled copy.
- Every framework and app `.js` file still parses after compaction, and compacting twice changes nothing.
- In the browser (source site on port 8028, bundled copy on 8030, both stopped afterwards): Home, About, Features, Live Demo, Login, Contact, Plain Native and the not-found page show without errors; sign-in and the Dashboard (stat tiles, Chart.js) work.
- `deploy.js --bundle` to a scratch folder: the release is bundled after its environment is written.

## Notes

- Pages' own `.js` and `.css` still load when a page is opened (pages can be large; loading them all at startup would slow the first page).
- A file that relies on `document.currentScript` would see the bundle instead; the framework doesn't, and the README says when a file is left unwrapped.
