# N9 report · Composite components

## Done

| Package | Highlights |
| --- | --- |
| `vs-pagination` | first/previous/page box/next/last, "21–40 of 135", page sizes, Alt+arrow keys |
| `vs-table` | `<td><div class="cell">` wrappers with full text on hover/focus; sorting (Shift for several columns, `aria-sort`); search (`search-scope`: auto/all/loaded/choose with "In this list / All records"); column filters; client or server paging (server mode sends page, sort, filters, search together); selection kept across pages; Enter/double-click opens; `row-menu` slot; column chooser; resizing by mouse or keyboard; `remember`; CSV export; totals; keyboard grid; `phone-layout="cards"`; print styles; loading/empty/no-match/error states |
| `vs-table-entry` | Enter cell to cell, a new row after the last (switchable: attribute or key map), Shift+Enter, Alt+Up/Down, Ctrl+Delete; editors text/number/select/date/check; computed columns; totals; per-cell validation with row messages; JSON form value |
| `vs-tree` | nested or flat data, children on demand, single/multiple/cascading selection, filter, full ARIA keyboard, add (Insert, +), rename (F2), delete (Delete, ×, leaves only), move (Ctrl+X/V or drag), locked nodes, save handlers that may refuse |
| `vs-select-tree` | single (leaves by default) or multiple with cascade, chips, filter, form value |
| `table-core` (helper) | columns, formatting with pipes, sorting, accent-insensitive search/filters, totals, CSV |

Dependencies install automatically: adding `vs-table` installed `table-core` and `vs-pagination` (vs-progress was already there); `vs-select-tree` installed `vs-tree`.

The sample's `/orders` page is the list-page example; `/showcase` now has the entry table, the chart-of-accounts tree and two tree-selects.

## Problems found and fixed during the review

- **`vs-tree` rendered nothing:** it named its drawing method `render()`, which replaced `Component.render()` (the template rendering). Renamed to `draw()`; the framework README now lists the method names a component must not reuse.
- **Space never matched** (framework): `Viraspa.keyboard.parse(" ")` trimmed the space away, so Space didn't select table rows (and wouldn't have opened `vs-select`). Fixed, with a test; components now write `"space"`.
- **`vs-table-entry`** crashed when `rows` was set after its script loaded but before it rendered; the rows now wait for the columns.
- **`vs-tooltip`** failed when its page was being removed (its root wasn't a document); it now checks.
- **Row classes couldn't be styled** from the page (they're inside the shadow root): `rowClass` names are now also part names (`vs-table::part(overdue)`).
- **The showcase used `Viraspa.tableCore` before any table had loaded;** the page waits for the component first, and the README shows that pattern.

## Verified

- Browser tests: 66 pass (6 new) in Edge (plain and bundled), Firefox 159 and WebKit 27.2.
- `/orders` in Edge: 10 of 120 rows with "1–10 of 120"; "elodie dar" finds only Élodie Mushi's Dar es Salaam orders; the status filter "overdue" leaves only overdue rows (shown red through `::part`); sorting by amount descending then Shift+click region gives a two-column sort; two selections enable "Delete selected (2)" and survive paging; arrows move between cells, Enter opens the order in a popup, Space selects the focused row; the server table pages, sorts and searches through the demo API with the "In this list / All records" switch.
- `/showcase` with real keys: in the entry table, typing 3 and Enter twice recomputes the amount (TZS 63,720 with VAT); Enter on the last cell adds a row with the defaults, which is reported as "Row 2: Product is required" until filled; Ctrl+Delete removes it. In the tree, Right opens Bank accounts and moves to CRDB, Insert + "Savings" + Enter adds it, F2 renames it, Ctrl+X/Ctrl+V moves it under Customers, and F2/Delete on the locked Cash account do nothing but say "Cash is locked."
- iPhone 15 (WebKit): `/orders` shows each row as a card, without sideways scrolling.
