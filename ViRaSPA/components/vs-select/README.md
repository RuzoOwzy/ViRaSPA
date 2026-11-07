# vs-select

A select for a fixed list of options: a filter box, multiple choice with chips, groups, type-ahead and full keyboard support.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N8) |
| Isolation | `full` |

## Install

```bash
node node-tools/install.js add component vs-select@0.1.0
```

Nothing else to do: it loads the first time `<vs-select>` appears.

## Usage

```html
<label for="region">Region</label>
<vs-select id="region" name="region" placeholder="Choose a region" required clearable>
  <option value="dar">Dar es Salaam</option>
  <option value="aru">Arusha</option>
  <optgroup label="South"><option value="mbe">Mbeya</option></optgroup>
</vs-select>

<vs-select name="tags" multiple></vs-select>
```

```js
document.querySelector('[name="tags"]').options = [{ value: "vip", label: "VIP" }, { value: "debt", label: "Has debt", disabled: true }];
```

## Attributes and properties

| Name | Meaning |
| --- | --- |
| `<option>`, `<optgroup>` children, or `options` | The choices: `[{ value, label, disabled, group }]` (or plain strings). |
| `multiple` | Several choices, shown as chips; `value` is then an array and the form gets one entry per choice. |
| `filter` | `auto` (default: a filter box from 8 options on), any other value: always, `off`: never. Accent- and case-insensitive. |
| `clearable` | A × button to clear the choice. |
| `placeholder`, `name`, `required`, `disabled`, `readonly`, `value` | As usual (`value` with `multiple`: comma-separated). |

Properties: `value`, `selectedOptions`, `options`.

## Keyboard

| Key | Does |
| --- | --- |
| Enter, Space, Alt+Down, Down | Opens |
| Up / Down, Home / End, Page Up / Down | Moves |
| Enter | Chooses |
| Escape | Closes, putting back the earlier choice |
| Tab | Chooses the highlighted option and moves on |
| Letters | Jump to the next option starting with them (also when closed) |

Keys can be changed: `el.keys = { open, close, choose }`.

## Events

`input`, `change`.

## Parts and CSS variables

Parts: `control`, `chips`, `chip`, `text`, `clear`, `panel`, `filter`, `listbox`, `option`. Variables: `--vs-input-border`, `--vs-input-background`, `--vs-select-active`, `--vs-select-chip`.

## Version history

- **0.1.0 (2026-11-08):** first version (migrated from `selectX`, with `dynamicCombofy`'s on-demand items moved to vs-select-search).