# M4 · Reactivity, i18n, testing

## Signals and bindings
- **API:** `Viraspa.state.signal`, `computed`, `effect` and `batch`.
  - It lives in `viraspa/core/state.js`, about 2–3 KB.
  - Effects are disposed when their page or component unloads.
- **One rule:** anything inside `{{ }}` is code, everywhere. A signal stays live; a plain value is filled once.
- **Expressions:** a small safe parser, with no `eval` (CSP-safe). Complex logic belongs in a `computed`.
- **Bindings:**

  | Syntax | Does |
  | --- | --- |
  | `{{x}}` | inserts a value as escaped text; live if it's a signal |
  | `{{{x}}}` | inserts trusted raw HTML |
  | `attribute="…{{x}}…"` | sets any attribute |
  | `data-bind-show-if="{{expr}}"` | shows or hides an element; it stays on the page |
  | `<template data-bind-if="{{expr}}">` | adds or removes a block |
  | `<template data-bind-repeat="{{list}}" data-bind-item="name" data-bind-key="{{name.id}}">` | repeats a block for each item |
  | `data-bind-two-way="{{x}}"` | input field ↔ value |
  | `data-bind-on-<event>="{{method}}"` | calls a page or component method on that event |

- **Opt-in:** templating stays opt-in. Native pages and components are never processed.

## i18n Phase A
- **Text:**
  - `data-i18n` with natural keys
  - `t()` with plurals via `Intl.PluralRules`
  - translation files per page
- **Document direction:** the `lang` and `dir` attributes.
- **Formatting:** `format.number`, `currency`, `date`, `time` and `relative`, all built on `Intl`, with pipes in templates.
- **Config:** fixed-key arrays with plain-language names.
  ```js
  {
    dateFormats: [{ name, pattern }],
    numberFormats: [{ name, minDecimalPlaces, maxDecimalPlaces }],
    currencies: [{ code, decimalPlaces, display }],
  }
  ```
  - `dateFormat` accepts either a pattern or a preset name.
  - Advanced `intlOptions` are passed straight through.
- **Overrides:** at app level, by user preference, and per call.

## Testing
- **Test helpers:** `Viraspa.testing.reset`, `mount`, `mockEndpoint` and `fakeClock`, with dependency injection.
- **Runners:** `node --test` for the logic, and a browser runner at `tests/run.html`.
- **CI:** a GitHub Actions workflow.
