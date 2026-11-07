# vs-table-entry

A table for typing rows quickly - sales lines, stock counts, journal entries - with the keyboard only.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N9) |
| Isolation | `full` |
| Needs | `table-core` (helper) |

## Install

```bash
node node-tools/install.js add component vs-table-entry@0.1.0
```

What it needs is installed with it. It loads the first time `<vs-table-entry>` appears.

## Usage

```html
<vs-table-entry name="lines" add-button delete-button label="Sale lines">
  <column field="product" label="Product" required></column>
  <column field="quantity" label="Qty" editor="number" min="1" width="90" total="sum"></column>
  <column field="price" label="Price" editor="number" decimals="2" width="130"></column>
  <column field="vat" label="VAT %" editor="select" options="0,18" width="100"></column>
  <column field="amount" label="Amount" format="currency:'TZS'" total="sum"></column>
</vs-table-entry>
```

```js
await Viraspa.core.components.load("vs-table-entry");      // before using Viraspa.tableCore in your code
lines.columns = Viraspa.tableCore.columnsFromChildren(lines).map((c) =>
  c.field === "amount" ? { ...c, value: (row) => row.quantity * row.price } : c);   // a computed column
lines.newRow = () => ({ quantity: 1, vat: "18" });
lines.rows = [{ product: "Rice 5 kg", quantity: 2, price: 18000 }];
```

## Columns

Like `vs-table` (`field`, `label`, `width`, `align`, `format`, `total`, `value`), plus:

| Option | Meaning |
| --- | --- |
| `editor` | `text` (default), `number` (`decimals`, `min`, `max`), `select` (`options`: `"a,b"` or `[{ value, label }]`), `date`, `check`, `none` (read-only). A column with `value` is computed and read-only. |
| `required` | The cell must be filled (in rows that have anything typed). |

## Keyboard

| Action | Default key | Does |
| --- | --- | --- |
| `next` | Enter | Next cell; after the last cell of the last row, a new row |
| `addRow` | Enter | The key that adds that row; `false` (or `add-row-on-enter="off"`) stops it |
| `previous` | Shift+Enter | Previous cell |
| `up` / `down` | Alt+Up / Alt+Down | Same column, row above / below |
| `deleteRow` | Ctrl+Delete | Removes the row (`confirm-delete` asks first) |

Change any of them: `lines.keys = { deleteRow: "alt+delete", addRow: false }`, a `keys` attribute with JSON, or app-wide with `Viraspa.keyboard.configure({ components: { "vs-table-entry": { … } } })`. Your own keydown handler wins (`preventDefault()`).

## Value and validity

`rows` (also `value`) are the row objects, edited in place. In a form, `name` sends the filled rows as JSON. Rows where nothing is typed don't count. Validity: required cells and number limits ("Row 2: Qty must be 1 or more"); `required` on the element needs at least one row.

## Attributes and events

`add-button`, `delete-button`, `confirm-delete`, `start-empty` (no blank first row), `label`, `name`, `required`, `disabled`, `readonly`. Events: `vs-cell-change` (`{ row, field, value, index }`), `vs-row-add`, `vs-row-remove` (cancelable), `vs-entry-end` (Enter on the last cell when adding is off), `input`, `change`.

## Version history

- **0.1.0 (2026-11-08):** first version (from EliteWeb's Sale.aspx entry rows).