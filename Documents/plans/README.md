# ViRaSPA 0.2.0 plans

The 0.2.0 work is split into five milestones. Each one runs the same way:

1. Implement the milestone.
2. Self-verify it in a preview (on a port other than the developer's own server, stopped afterwards).
3. Write a verification report next to the plan (`M<n>-verification-report.md`).
4. The project owner verifies it. The next milestone starts only after that.

At every milestone, the docs, `.gitignore`, descriptions, About pages and the repository About are brought up to date. Nothing is committed or pushed without the owner asking.

After M5, the implemented and not-implemented items are reviewed, and the leftovers are carried into the next plan.

| Milestone | Plan | Status |
| --- | --- | --- |
| M1 · Foundation | [M1-foundation.md](M1-foundation.md) | Done ([report](M1-verification-report.md)) |
| M2 · Components and distribution | [M2-components-and-distribution.md](M2-components-and-distribution.md) | In verification ([report](M2-verification-report.md)) |
| M3 · App features | [M3-app-features.md](M3-app-features.md) | Planned |
| M4 · Reactivity, i18n, testing | [M4-reactivity-i18n-testing.md](M4-reactivity-i18n-testing.md) | Planned |
| M5 · Benchmark and review | [M5-benchmark-and-review.md](M5-benchmark-and-review.md) | Planned |

## Decisions that apply to every milestone

- **Namespace:** `window.Viraspa`, in PascalCase.
- **No build step:** classic scripts, plain HTML/CSS/JS, served as they are.
- **Native first:** pages, components and extensions can be written in 100% native HTML, CSS and JS. Every framework helper is opt-in.
- **Project layout:**
  - `viraspa/` is the framework and is never edited.
  - `components/` holds the official `vs-*` components.
  - `extensions/` holds third-party bundles.
  - `app/` holds the project's own code, including `app/project-viraspa.json`.
  - `lib/` holds libraries, in versioned folders.
- **Tools** live in `node-tools/` at the repository root, outside the served folder.
  - Every tool has `--help` and `--version`.
  - Each tool reads its own section of `app/project-viraspa.json`. Its flags are that section's keys in kebab-case (`outputFolder` ↔ `--output-folder`).
  - Precedence: command-line flag, then environment variable, then config file, then default.
  - `--save` writes the overrides back into the config.
- **Manifest names:** `project-viraspa.json`, `framework-viraspa.json`, `component-viraspa.json`, `extension-viraspa.json`, `catalog-viraspa.json`.
- **Framework events** use the `viraspa:` prefix, e.g. `viraspa:pageShown`.
