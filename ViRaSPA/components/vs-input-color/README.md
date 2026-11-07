# vs-input-color

A friendly colour picker: swatches, recent colours, a hex field, the browser's full picker and an eyedropper where supported.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N8) |
| Isolation | `full` |

## Install

```bash
node node-tools/install.js add component vs-input-color@0.1.0
```

Nothing else to do: it loads the first time `<vs-input-color>` appears.

## Usage

```html
<label for="color">Label colour</label>
<vs-input-color id="color" name="color" value="#1e8449"></vs-input-color>
<vs-input-color palette="#c0392b,#d68910,#1e8449,#2e86c1" no-custom></vs-input-color>
```

## Attributes

| Attribute | Meaning |
| --- | --- |
| `value` | `#rrggbb` (`#abc` is expanded); `""` for no colour. |
| `palette` | Comma-separated colours; a friendly default set otherwise. |
| `no-custom` | Only the palette (no hex field, full picker or eyedropper). |
| `name`, `required`, `disabled`, `readonly` | As usual. |

The last 8 colours chosen are offered as "Recent" (kept in this browser).

## Keyboard

Enter/Space (or Alt+Down) opens; arrows move between swatches; Enter chooses; Escape closes.

## Events

`input`, `change`.

## Version history

- **0.1.0 (2026-11-08):** first version (replaces JSColor, which is GPL-licensed).