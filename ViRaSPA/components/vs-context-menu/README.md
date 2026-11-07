# vs-context-menu

A context menu (right-click menu) for an element or a group of elements, with full keyboard and touch support.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N8) |
| Isolation | `full` |

## Install

```bash
node node-tools/install.js add component vs-context-menu@0.1.0
```

Nothing else to do: it loads the first time `<vs-context-menu>` appears.

## Usage

```html
<vs-context-menu for="#orders tbody tr">
  <button value="open" data-icon="lucide:external-link" data-shortcut="Enter">Open</button>
  <button value="edit" data-icon="lucide:pencil" data-shortcut="F2">Edit</button>
  <hr>
  <button value="delete" data-icon="lucide:trash-2" class="danger">Delete</button>
</vs-context-menu>
```

```js
menu.addEventListener("vs-menu-open", (e) => {
  const row = e.detail.target;                                  // the row that was right-clicked
  e.detail.items.find((b) => b.value === "delete").disabled = row.dataset.locked === "true";
});
menu.addEventListener("vs-menu-select", (e) => act(e.detail.value, e.detail.target));
```

## Attributes and items

- `for`: a CSS selector matched in the same document (or shadow root); without it, the parent element.
- **Items:** `<button>` with `value`, `disabled`, `data-icon`, `data-shortcut` (shown, and given as `aria-keyshortcuts`), `class="danger"`; `<hr>` for a divider.

## Opening

Right-click, a long press on touch screens, or the keyboard on a focused target: the Menu key or Shift+F10 (`el.keys = { open }`).

## Keyboard in the menu

Up/Down/Home/End move, Enter/Space choose, letters jump to the next item starting with them, Escape and Tab close. Focus returns to where it was.

## Events

`vs-menu-open` (cancelable; `detail: { target, items }`), `vs-menu-select` (`detail: { value, item, target }`).

## Version history

- **0.1.0 (2026-11-08):** first version (migrated from `contextMenuX`).