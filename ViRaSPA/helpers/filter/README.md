# filter

Type to filter a list, a table or a select. API: `Viraspa.filter`.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer |

## Install

```bash
node node-tools/install.js add helper filter@0.1.0
```

Then add `"filter"` to `helpers` in `app/config/startup.js`.

## Usage

```html
<input type="search" data-filter-for="#customers" data-filter-columns="0,2" data-filter-empty="No match" placeholder="Filter…">
<table id="customers"> … </table>
```

```js
const filter = Viraspa.filter.bind(input, list, { columns: [0, 2], maxItems: 50, empty: "No match" });
filter.apply("dar");   // filter.dispose() undoes everything
```

- **Matching** ignores letter case and accents ("elodie" finds "Élodie"); every word must appear. `exact: true` matches the whole text.
- **Targets:** a table (its body rows), `ul`/`ol` (items), a `select` (options), or any container (its children, or `items: ".card"`).
- **Hidden, not removed:** items get `hidden`; `data-filter-keep` keeps one always visible.
- **Highlighting:** matches are marked with the CSS Highlight API where the browser supports it (`::highlight(vs-filter)`, `--vs-filter-highlight`); the page's HTML is never rewritten.
- **Event:** `vs-filter` on the target, `detail: { shown, total, text }`.
- `data-filter-for` inputs are bound by themselves on every page shown.

## Version history

- **0.1.0 (2026-11-08):** first version.