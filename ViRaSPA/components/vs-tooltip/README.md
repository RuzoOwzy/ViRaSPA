# vs-tooltip

A tooltip with rich content (formatting, links, buttons) for another element. For plain text, the tooltip helper's data-tooltip="…" is simpler.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N8) |
| Isolation | `full` |

## Install

```bash
node node-tools/install.js add component vs-tooltip@0.1.0
```

Nothing else to do: it loads the first time `<vs-tooltip>` appears.

## Usage

```html
<button id="stock-info">Stock</button>
<vs-tooltip for="stock-info" placement="bottom">
  <strong>Dar es Salaam:</strong> 120 · <strong>Arusha:</strong> 35 <a href="/stock">Details</a>
</vs-tooltip>
```

## Attributes

| Attribute | Default | Meaning |
| --- | --- | --- |
| `for` | the previous element | The id of the element it describes. |
| `placement` | `top` | `top`, `bottom`, `left` or `right` (flipped when there is no room). |
| `delay` | `300` | Ms of hovering before it shows. |

It shows on hover and keyboard focus, stays while the pointer is over it (so its links work), and hides on leave, blur or Escape. Methods: `show()`, `hide()`. Events: `vs-show`, `vs-hide`.

## Accessibility

The target gets `aria-describedby` and an `aria-description` with the text while it's shown.

## Version history

- **0.1.0 (2026-11-08):** first version.