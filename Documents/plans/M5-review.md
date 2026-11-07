# M5 · Review of the 0.2.0 plan

**Date:** 2026-11-07.

This review checks every item of M1–M5, and the decisions agreed while planning, against what was built. It lists what was not done and why. The leftovers carry into [the next plan](next-plan.md).

Verification reports: [M1](M1-verification-report.md), [M2](M2-verification-report.md), [M3](M3-verification-report.md), [M4](M4-verification-report.md). Benchmark: [Documents/benchmark.md](../benchmark.md).
Automated tests at the end of M5: **56 passing** (24 Node + 32 browser), also passing in GitHub Actions (headless Chrome on Linux).

## M1 · Foundation: done

| Item | Status |
| --- | --- |
| Layout (`viraspa/`, `app/`, `lib/` versioned, `node-tools/` at the root); x-responsive moved out | Done |
| Option reader (flag > env > config > default, `--help`, `--version`, `--save`), site finder, `serve.js`, `help.js` | Done |
| `base.css` with `--vs-*` theme, noscript, browser feature check, favicon (SVG/ICO/Apple) | Done |
| Cache strategies: release, custom, auto, revalidate | Done |
| No-flicker navigation, last navigation wins, page file cache, keep-alive, focus and scroll | Done |
| Escaping, `{{{raw}}}`, `\{{`, URL check | Done (rebuilt on the binding service in M4) |
| Components as custom elements; `full`/`scoped`/`none`; `componentRoot`/`documentShadow`; slots in every mode | Done |
| Native pages and the `viraspa:page*` events; all events prefixed `viraspa:` | Done |

## M2 · Components and distribution: done, two items waiting for your decision

| Item | Status |
| --- | --- |
| Core components: `vs-header`, `vs-sidebar`, `vs-footer`, `vs-brand`, `vs-menu` (collapse, tooltips, hamburger), `vs-user-menu` (no Dashboard), `vs-icon`, `vs-busy-indicator`, `vs-toast` | Done |
| Icons: object form; Font Awesome Free 7.3.1, Lucide 1.70.0, `char`, `svg`, `image`; `register` | Done |
| Extensions: manifest fields, version precedence, reserved prefixes, events, `--vs-` variables, `Viraspa.*` frozen | Done |
| Reserved framework style names (`.vs-*` classes) | Done in M5 (was missing) |
| `allowedIsolation` | Done in M5 (was missing) |
| `framework-viraspa.json` with checksums; `project-viraspa.json` pins; download sources | Done |
| `install.js` (add, update, remove, restore, verify, list; overrides; no version override on restore; `name@version`) | Done |
| Remote mode (framework from jsDelivr) | Done in the loader. **The real CDN path is untested:** it needs version tags (see below). |
| `create-project.js`, `clean-sample.js`, the `?v=` rewrite on framework update | Done |
| ViRaSPA-Components repository with `vs-card`, `vs-stat-tile`, `vs-login-form`; documentation template | Done, and pushed to GitHub |
| GitHub Pages demos for the components | **Not done: needs your OK** (agreed: ask first) |

## M3 · App features: done

| Item | Status |
| --- | --- |
| Session: adapter, `localStorage`, privilege and role checks, all switches, attributes, `requires` | Done |
| Busy API and events; `page.signal` wired into requests | Done |
| Public and private shells, `layout: "inherit"`, the agreed side menu, sample pages with Chart.js 4.6.1 | Done |
| Features page in both shells, with a native page and a native component | Done |
| Route `head` with `image`, runtime meta, dynamic-head design and contract | Done. `headData` became `page.setHeadData(data)`. |
| `prerender.js` (headTagsOnly / fullPage, `routes.json`, output beside `index.html`) | Done |
| Server rules for IIS, Apache and nginx | Generated. **Not tested on real servers.** |
| `deploy.js` (restore, exclusions, `release.json`, prerender, rules, swap, rollback, `keepPrevious`, zip, dry run, environments) | Done |

## M4 · Reactivity, i18n, testing: done

| Item | Status |
| --- | --- |
| Signals (`signal`, `computed`, `effect`, `batch`; about 1.9 KB gzip; disposed with pages and components) | Done |
| One `{{ }}` rule, a safe parser (no `eval`), every binding in the plan's table, opt-in | Done |
| i18n Phase A: `data-i18n`, `t()` with plurals, per-page files, `lang`/`dir` | Done |
| Formats with plain-language config, presets/patterns, `intlOptions`, pipes, overrides (app / user / call) | Done |
| Testing: helpers (`reset`, `mount`, `mockEndpoint`, `fakeClock`, plus `render`), `node --test`, browser runner, CI | Done, plus `node-tools/test.js` |

## M5 · Benchmark and review: done

| Item | Status |
| --- | --- |
| Benchmark from published figures (nothing downloaded), each comparison point explained | Done: [benchmark.md](../benchmark.md) |
| ViRaSPA measured on its own sample (sizes, requests, time to first page, navigation) | Done |
| Review, and the next plan with the leftovers, the head-injection hook and the component migration | This file and [next-plan.md](next-plan.md) |

## Decisions from planning: checked

All of these were built as agreed:
- Shadow DOM only for components; pages keep `document`.
- `documentShadow` plus the uniform `componentRoot`.
- The `Viraspa` namespace in PascalCase.
- `vs-login-form` in the light DOM (scoped), so autofill works.
- The favicon kept apart from `head.image`.
- The prerendered folder beside `index.html`, created only by the tool.
- `node-tools/` at the repository root; flag names that match config keys.
- Vanilla JS throughout, with jQuery only as an opt-in example. jQuery 4 works with `componentRoot` in shadow roots (checked in M5).
- Chart.js and Font Awesome self-hosted.
- Nothing downloaded for the benchmark.
- Your port 8027 was never used by me.

## Not done, and why

| Item | Why | Where it goes |
| --- | --- | --- |
| GitHub Pages demos for ViRaSPA-Components | Needs your OK (agreed: ask first) | Next plan, step 1 |
| Version tags (`v0.2.0`, `vs-card-v0.1.0`, …) and marking 0.2.0 released | A release decision; it also enables the official download source and remote mode | Next plan, step 1 |
| Server rules on real IIS, Apache and nginx | No such servers here | Next plan: test on a staging server |
| Firefox, Safari and real-device testing | Only Chromium-based browsers (Edge, Chrome) were available | Next plan |
| Node reference hook for request-time head injection | Planned for the next plan from the start | Next plan |
| Component migration (OwzyComponents, EliteWeb) | Planned for the next plan from the start | Next plan, phases 1–2 |
| DOM update speed measured in js-framework-benchmark | Would need the benchmark downloaded and run; the M5 rule was published figures only | Next plan (your choice) |
