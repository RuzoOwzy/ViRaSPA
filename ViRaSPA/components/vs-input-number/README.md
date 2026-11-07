# vs-input-number

A number field for money, quantities and measures: the user's number format, only valid typing, steps, min/max, and form support.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N8) |
| Isolation | `full` |

## Install

```bash
node node-tools/install.js add component vs-input-number@0.1.0
```

Nothing else to do: it loads the first time `<vs-input-number>` appears.

## Usage

```html
<label for="price">Unit price</label>
<vs-input-number id="price" name="price" decimals="2" min="0" step="50" prefix="TZS" required></vs-input-number>
```

```js
const field = document.querySelector("#price");
field.value = 18000;          // a Number, or null when empty
console.log(field.value);     // 18000
```

## Attributes

| Attribute | Default | Meaning |
| --- | --- | --- |
| `value` | empty | The starting value (a plain number, e.g. `1250000.5`). |
| `decimals` | `0` | Decimal places kept and shown. |
| `min`, `max` | none | Limits; values outside are invalid (and steps stop there). |
| `step` | `1` | Arrow keys and spin buttons change the value by this much. |
| `negative` | off | Allows a minus sign (also allowed when `min` is below 0). |
| `grouping` | on | `grouping="false"` hides thousands separators. |
| `prefix`, `suffix` | none | Text before/after the number, e.g. `TZS`, `kg`. |
| `spin` | off | Shows up/down buttons (press and hold to repeat). |
| `select-on-focus` | on | `"false"` keeps the cursor instead of selecting the number. |
| `name`, `required`, `disabled`, `readonly`, `placeholder` | | As on a native input. |

## Behaviour

- **Shown** in the user's format (`1,250,000.00`, or `1.250.000,00` in other languages) and as a plain number while editing.
- **Typing:** only digits, one decimal separator and (when allowed) a leading minus. Pasted text is cleaned: `TZS 2.500,75` becomes 2500.75; when both `.` and `,` appear, the last one is the decimal point.
- **Events:** `input` while typing, `change` when the value is committed (leaving the field, Enter, a step).

## Keyboard

| Key | Does |
| --- | --- |
| Arrow Up / Down | `step` up / down |
| Page Up / Down | 10 × `step` |
| Enter | Commits the value (the data-entry helper then moves on) |

Change or switch off keys: `field.keys = { increment: "alt+arrowup", incrementMore: false }` (actions: `increment`, `decrement`, `incrementMore`, `decrementMore`), or app-wide with `Viraspa.keyboard.configure({ components: { "vs-input-number": { … } } })`.

## Parts and CSS variables

Parts: `field`, `input`, `prefix`, `suffix`, `spin-button`. Variables: `--vs-input-border`, `--vs-input-background`, `--vs-input-padding`, `--vs-input-number-align` (default `right`).

## Accessibility

`role="spinbutton"` with `aria-valuemin`/`max`/`now`; the field's `<label>` names the inner input; validity messages come from the component (translated with `Viraspa.i18n`).

## Version history

- **0.1.0 (2026-11-08):** first version (migrated from FIITNumber, `.NumericField`, `valX`).