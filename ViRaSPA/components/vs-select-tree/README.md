# vs-select-tree

A select whose choices are a tree: categories, accounts, locations.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N9) |
| Isolation | `full` |
| Needs | `vs-tree` |

## Install

```bash
node node-tools/install.js add component vs-select-tree@0.1.0
```

What it needs is installed with it. It loads the first time `<vs-select-tree>` appears.

## Usage

```html
<label for="category">Category</label>
<vs-select-tree id="category" name="category" placeholder="Choose a category" filter></vs-select-tree>
<vs-select-tree name="regions" multiple cascade></vs-select-tree>
```

```js
category.items = [{ id: "food", label: "Food" }, { id: "rice", label: "Rice", parent: "food" }];
```

## Attributes and properties

| Name | Meaning |
| --- | --- |
| `nodes`, `items`, `load` | The tree's data, as in `vs-tree` (`id-field`, `parent-field`, `label-field`). |
| `multiple` | Several choices (checkboxes), shown as chips; `cascade` picks a branch at once. |
| `select-parents` | Single choice of any node; by default only leaves (a branch opens instead). |
| `filter` | A filter box in the list. |
| `name`, `required`, `disabled`, `readonly`, `placeholder`, `value` | As usual (with `multiple`, one form entry per id). |

## Keyboard

Enter, Space or Down opens; the tree keys work inside; Escape closes.

## Events

`input`, `change`.

## Version history

- **0.1.0 (2026-11-08):** first version (migrated from `treeCombofy`).