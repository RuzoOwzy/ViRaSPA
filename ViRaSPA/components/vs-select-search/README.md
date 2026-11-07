# vs-select-search

Type to search, then choose: from a list in memory, a table on the page, or your server.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N8) |
| Isolation | `full` |

## Install

```bash
node node-tools/install.js add component vs-select-search@0.1.0
```

Nothing else to do: it loads the first time `<vs-select-search>` appears.

## Usage

```html
<label for="customer">Customer</label>
<vs-select-search id="customer" name="customer" columns="phone" placeholder="Search customers…"></vs-select-search>
```

```js
// From the server: you give the function, the component does the rest.
document.querySelector("#customer").source = async ({ text, limit, signal }) =>
  (await Viraspa.app.services.customers.search(text, { limit, signal })).items;   // [{ id, name, phone }]

// From a list in memory:
products.items = [{ value: "R5", label: "Rice 5 kg", price: "TZS 18,000" }];
```

```html
<!-- From a table on the page (cells by column index): -->
<vs-select-search table="#products" value-column="0" label-column="1" columns="2"></vs-select-search>
```

## Attributes and properties

| Name | Default | Meaning |
| --- | --- | --- |
| `source` | | `async ({ text, limit, signal }) => items` (an array, or `{ rows }`). Pass `signal` to fetch/call so outdated requests are cancelled. |
| `items` | | A list in memory (searched accent- and case-insensitively). |
| `table`, `value-column`, `label-column` | | A table's rows as the list. |
| `value-field`, `label-field` | `value`/`id`, `label`/`name` | Which fields hold the value and the text. |
| `columns` | | Extra fields (or column indexes) shown in each row. |
| `min-chars` | `1` | Characters before searching. |
| `limit` | `20` | Rows asked for. |
| `debounce` | `250` | Ms to wait after typing stops before asking. |
| `free-text` | off | The typed text is the value when nothing is chosen. |
| `name`, `required`, `disabled`, `readonly`, `placeholder` | | As usual. Without `free-text`, typed text that wasn't chosen is invalid. |

Properties: `value` (the chosen item's value), `item` (the whole item; settable).

Built on `Viraspa.data.createSource`: answers that arrive after newer typing are ignored, and a failed search shows "Try again".

## Keyboard

Down opens or moves down, Up moves up, Enter chooses, Escape closes (a second Escape clears the text), Tab chooses the highlighted row and moves on. Change keys with `el.keys = { choose, close }`.

## Events

`vs-select` (`detail: { item }`), `input`, `change`.

## Version history

- **0.1.0 (2026-11-08):** first version (migrated from `bindTextBoxDropDown` and `dynamicCombofy`).