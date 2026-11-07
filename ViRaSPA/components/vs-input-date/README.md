# vs-input-date

A date field: type the date in the user's format, or pick it from a calendar. Date, month or date and time.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N8) |
| Isolation | `full` |

## Install

```bash
node node-tools/install.js add component vs-input-date@0.1.0
```

Nothing else to do: it loads the first time `<vs-input-date>` appears.

## Usage

```html
<label for="due">Due date</label>
<vs-input-date id="due" name="due" min="2026-01-01" required></vs-input-date>
<vs-input-date name="period" type="month"></vs-input-date>
<vs-input-date name="meeting" type="datetime"></vs-input-date>
```

```js
document.querySelector("#due").isDateDisabled = (iso) => new Date(iso).getDay() === 0;   // no Sundays
```

## Attributes and properties

| Name | Meaning |
| --- | --- |
| `type` | `date` (default), `month` or `datetime` (adds a time field). |
| `value` | ISO: `2026-11-08`, `2026-11` or `2026-11-08T14:30`; `""` when empty. |
| `min`, `max` | ISO limits; days outside are disabled in the calendar and invalid when typed. |
| `isDateDisabled` | A function `(iso) => true` for days that can't be chosen. |
| `name`, `required`, `disabled`, `readonly`, `placeholder` | As usual. |

Properties: `value`, `valueAsDate`.

**Typing:** in the language's order (`08/11/2026`, `11/8/2026`…), any separator, two-digit years mean 20xx; a four-digit first number is always year-first (ISO).

## Keyboard

| Where | Key | Does |
| --- | --- | --- |
| Field | Alt+Down | Opens the calendar (`el.keys = { open }`) |
| Calendar | Arrows | Day (Up/Down: week) |
| | Page Up / Down | Month (with Shift: year) |
| | Home / End | Start / end of the week |
| | Enter, Space | Chooses |
| | Escape | Closes |

The title switches to month and year views; the week starts on the language's first day; Today and Clear buttons.

## Events

`input`, `change`.

## Version history

- **0.1.0 (2026-11-08):** first version (migrated from `calendarfy` and the `date` helper).