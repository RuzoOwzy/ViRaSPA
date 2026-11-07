# N1 report · Housekeeping

## Done

| Item | Where |
| --- | --- |
| Framework version 0.1.0, `stage: "development"`, console "in development" | `viraspa/viraspa.js`, `core/bootstrap.js`, `framework-viraspa.json` (restamped) |
| Sample and docs say 0.1.0; the release notes fold "0.2.0" into 0.1.0 in development; the old "0.1.0 (2026-10-28)" entry is now the starting point | `index.html`, `project-viraspa.json`, README, release notes, benchmark, plans |
| Components repository renamed to ViRaSPA-Extensions (local folder, GitHub, `official` source, docs, tests) | `node-tools/lib/sources.js`, README, ViRaSPA-Extensions README and release notes |
| New `helper` kind: manifest rules, install/stamp support, runtime loading (`startup.helpers`, `loadHelper`, locked namespace) | `core/manifest-rules.js`, `core/component-registry.js`, `core/bootstrap.js`, `node-tools/install.js`, `stamp.js`, project template |
| `dependencies` in component and helper manifests, installed by `install.js`, loaded before a component at runtime | same files |
| Official components require framework 0.1.0 (restamped, re-pinned in the sample) | ViRaSPA-Extensions `components/*` |
| The approved plan saved; the draft removed | [N-plan.md](N-plan.md) |

## Verified

- `node node-tools/test.js`: all Node tests (two new: helper/dependency rules, helper download locations) and 32 browser tests pass.
- A throwaway project (scratchpad) with a component depending on a helper: `install.js add component vs-demo@0.1.0` installed and pinned the helper too; `remove helper … --dry-run` warned that the component needs it.
- In the browser (temporary server on port 8029, stopped afterwards): `<vs-demo>` loaded its helper first and rendered with it; `Viraspa.demoHelp` was locked; the console showed `ViRaSPA v0.1.0 (in development, 2026-11-08)` and no errors.
- `install.js verify` in the sample: everything matches its pin.

## Not done / notes

- No helpers exist yet; the first ones arrive in N7.
- GitHub keeps redirecting the old repository address, but links should use the new name.
