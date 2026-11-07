# vs-tree

A tree - categories, a chart of accounts, folders - with children loaded on demand, selection, a filter, full keyboard support and optional editing.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N9) |
| Isolation | `full` |
| Needs | nothing |

## Install

```bash
node node-tools/install.js add component vs-tree@0.1.0
```

What it needs is installed with it. It loads the first time `<vs-tree>` appears.

## Usage

```html
<vs-tree id="accounts" selectable="single" filter editable delete-leaves-only label="Chart of accounts"></vs-tree>
```

```js
accounts.nodes = [{ id: 1, label: "Assets", locked: true, expanded: true, children: [{ id: 11, label: "Cash" }] }];
accounts.items = flatList;                      // or a flat list (id-field, parent-field "parent", label-field)
accounts.load = async (node, { signal }) => api.children(node.id);   // nodes with hasChildren: true
accounts.onAdd = async (parent, label) => ({ id: await api.add(parent.id, label), label });
accounts.onRename = async (node, label) => api.rename(node.id, label);
accounts.onDelete = async (node) => api.remove(node.id);
accounts.onMove = async (node, to) => api.move(node.id, to.id);
```

Each handler saves to your server and may throw to refuse (its message is shown).

## Nodes

`id`, `label`, `children`, `icon`, `expanded`, `hasChildren` (loaded when opened), `locked` (no rename, delete or move), `disabled`.

## Attributes

| Attribute | Meaning |
| --- | --- |
| `selectable` | `single` or `multiple` (checkboxes); `cascade` checks a whole branch (parents show "mixed"). |
| `filter` | A filter box; matches stay visible with their parents. |
| `editable` | Add, rename, delete and move; `actions="add,rename"` keeps only some. Hover a row for + and ×. |
| `delete-leaves-only` | Only items without sub-items can be deleted. |
| `label` | The tree's accessible name. |

Properties: `nodes`, `items`, `value`, `selectedNodes`, `node(id)`, `parent(node)`, `focusNode(node)`, `toggle(node, open)`.

## Keyboard

| Key | Does |
| --- | --- |
| Up / Down, Home / End | Move |
| Right / Left | Open, or go to the first child / close, or go to the parent |
| Enter | Opens the node (`vs-node-open`; selects it with `selectable="single"`) |
| Space | Selects / checks |
| * | Opens all siblings |
| Letters | Jump to the next node starting with them |
| Insert, F2, Delete | Add a child, rename, delete (editable) |
| Ctrl+X, then Ctrl+V | Move a node under the focused one |

Change editing keys with `tree.keys = { add, rename, delete, cut, paste }`. Moving can also be done by dragging.

## Events

`vs-node-select`, `vs-node-open`, `vs-node-toggle`, `vs-selection-change`, `vs-node-add`, `vs-node-rename`, `vs-node-delete`, `vs-node-move`.

## Version history

- **0.1.0 (2026-11-08):** first version (from EliteWeb's Chart of Accounts tree).