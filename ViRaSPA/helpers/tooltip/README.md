# tooltip

Tooltips from one attribute. API: `Viraspa.tooltip`.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer |

## Install

```bash
node node-tools/install.js add helper tooltip@0.1.0
```

Then add `"tooltip"` to `helpers` in `app/config/startup.js`.

## Usage

```html
<button data-tooltip="Save (Ctrl+S)">💾</button>
<span data-tooltip="Due in 3 days" data-tooltip-placement="bottom">Invoice 1042</span>
```

- **Shown** on hover (after 400 ms), on keyboard focus, and on a long press on touch screens; hidden on leave, blur, Escape or scrolling.
- **Placement:** `top` (default), `bottom`, `left`, `right`, flipped when there is no room.
- **Accessible:** `role="tooltip"`, linked with `aria-describedby` while shown; the text is translated with `Viraspa.i18n`.
- **Works inside components'** shadow roots.
- `Viraspa.tooltip.configure({ delay, touchDelay })`, `show(element)`, `hide()`.
- **Styling:** `.vs-tooltip`, `--vs-tooltip-background`, `--vs-tooltip-color`.

Rich content (HTML, buttons) in a tooltip is `vs-tooltip`, a component.

## Version history

- **0.1.0 (2026-11-08):** first version.