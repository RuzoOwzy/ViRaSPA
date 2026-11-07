# vs-table

A data table for lists of records: sorting, searching, filtering, paging in the browser or on the server, selection, row actions, column choice and widths, CSV export, totals, keyboard navigation and phone layouts.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N9) |
| Isolation | `full` |
| Needs | `table-core` (helper), `vs-pagination`, `vs-progress` |

## Install

```bash
node node-tools/install.js add component vs-table@0.1.0
```

What it needs is installed with it. It loads the first time `<vs-table>` appears.

## Usage

```html
<vs-table key-field="number" page-size="20" search selectable="multiple" export column-chooser remember="orders" phone-layout="cards" label="Orders">
  <column field="number" label="Order" width="110"></column>
  <column field="customer.name" label="Customer" filterable></column>
  <column field="date" label="Date" format="date:'short'" width="120"></column>
  <column field="amount" label="Amount" format="currency:'TZS'" total="sum"></column>
  <button slot="toolbar" type="button">Delete selected</button>
  <vs-context-menu slot="row-menu"><button value="open">Open</button></vs-context-menu>
</vs-table>
```

```js
table.rows = orders;                       // data in the browser, or from the server:
table.source = async ({ page, pageSize, search, sort, filters, signal }) => {
  const r = await Viraspa.app.services.orders.list({ page, pageSize, search, sort, filters }, { signal });
  return { rows: r.items, total: r.count };
};
table.addEventListener("vs-row-open", (e) => openOrder(e.detail.row));
```

Every cell is `<td><div class="cell">…</div></td>`: one line with "…" when too long (the full text shows on hover and on focus), or wrapped with the column's `wrap`.

## Columns

As `<column>` children or the `columns` property (`[{ … }]`):

| Option | Meaning |
| --- | --- |
| `field` | The value (`customer.name` for nested ones). |
| `label` | The heading (translated). |
| `width`, `min-width`, `max-width` | Sizes (`120` = pixels, or any CSS size). Drag the heading edge (or focus it and use Left/Right) to resize. |
| `align` | `start`, `end`, `center` (numbers and money default to `end`). |
| `format` | A pipe: `currency:'TZS'`, `date:'short'`, `number`, your own (`Viraspa.templates.add`), or a function `(value, row) => text`. |
| `value` (property) | `(row) => value`: a computed column. |
| `render` (property) | `(row) => text or Node`: custom cell content. |
| `sortable` | Default on; `sortable="false"` turns it off. |
| `filterable` | A filter box under the heading (contains, accents and case ignored). |
| `hidden` | Hidden at first (the column chooser can show it). |
| `sticky="start"` | Stays in view while scrolling sideways. |
| `wrap` | Long text wraps instead of "…". |
| `total` | `sum`, `avg`, `count`, `min`, `max` or a function: a totals row. |

## Attributes

| Attribute | Meaning |
| --- | --- |
| `key-field` | The field that identifies a row (default `id`), for selection. |
| `page-size`, `page-sizes` | Paging (0 or absent: no paging); the sizes the user may choose. |
| `search` | A search box: every word somewhere in the shown columns. |
| `search-scope` | Server mode: `auto`/`all` (the server searches all records), `loaded` (only the rows shown), `choose` (a switch "In this list" / "All records" for the user). |
| `local-sort` | Server mode: sort the rows shown in the browser ("sorts this page only"); by default sorting goes to the server with paging. |
| `selectable` | `single` or `multiple` (checkboxes, select-all for the page; kept across pages). |
| `export`, `export-name` | An Export button: CSV of the matching rows (in server mode, those shown). |
| `column-chooser` | A Columns button to show or hide columns. |
| `remember` | A key: hidden columns, widths, sorting and page size are kept in this browser. |
| `height` | A maximum height: the body scrolls under a sticky header. |
| `phone-layout` | When narrower than 600px: `scroll` (default: sideways) or `cards` (each row as label/value lines). |
| `empty-text`, `label`, `debounce` | Text when there are no rows; the table's accessible name; ms to wait after typing. |

Properties: `rows`, `source`, `columns`, `page`, `selection` (keys), `selectedRows`, `menuRow`, `rowClass` (`(row) => "name"`: a class and a part name, e.g. `vs-table::part(overdue) { color: red }`), `refresh()`, `exportCsv(fileName)`.

## Keyboard

| Key | Does |
| --- | --- |
| Arrows | Move between cells (the grid has one Tab stop) |
| Home / End (with Ctrl: the first / last row) | Row start / end |
| Enter | Opens the row (`vs-row-open`) |
| Space | Selects the row |
| Page Up / Page Down | Previous / next page |
| Shift+click a heading | Sorts by several columns |

Change keys with `table.keys = { open, select, nextPage, previousPage }`.

## Events

`vs-row-click`, `vs-row-open`, `vs-row-contextmenu` (cancelable; the slotted `row-menu` opens otherwise), `vs-selection-change` (`{ rows, keys }`), `vs-sort-change`, `vs-load` (`{ rows, total }`), `vs-export`.

## States

Loading (dots), empty, "No records match" and errors with "Try again" are built in. Printing leaves out the toolbar and paging.

## Version history

- **0.1.0 (2026-11-08):** first version (with ideas from `simplifyFilterPage`, `exportTablesAsCSV`, `bindTextOverflowFlexViewable`).