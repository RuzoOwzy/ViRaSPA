# vs-input-password

A password field with a show/hide button, a Caps Lock warning and an optional strength meter.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N8) |
| Isolation | `scoped (no Shadow DOM, so password managers find the field)` |

## Install

```bash
node node-tools/install.js add component vs-input-password@0.1.0
```

Nothing else to do: it loads the first time `<vs-input-password>` appears.

## Usage

```html
<label for="password">Password</label>
<vs-input-password id="password" name="password" autocomplete="current-password" required></vs-input-password>

<label for="new">New password</label>
<vs-input-password id="new" name="newPassword" autocomplete="new-password" minlength="8" strength></vs-input-password>
```

The real `<input>` is in the page and takes the element's `id` and `name`, so `<label for>`, autofill, password managers and native validation all work as with a plain input.

## Attributes

| Attribute | Meaning |
| --- | --- |
| `strength` | A meter under the field: weak / fair / good / strong, from the length and the kinds of characters. A hint, not a policy. |
| `autocomplete` | `current-password` (default) or `new-password`. |
| `name`, `required`, `minlength`, `maxlength`, `pattern`, `placeholder`, `disabled`, `readonly` | Passed to the input. |

Properties: `value`, `strength` (0–3, or -1 when empty), `toggle(show?)`.

## Keyboard

The eye button (Tab to it, Enter/Space) or Alt+F8 shows or hides the text (`el.keys = { toggle: … }` to change it). Caps Lock on shows a warning.

## Parts

`field`, `input`, `eye`, `caps`, `meter`.

## Version history

- **0.1.0 (2026-11-08):** first version (migrated from `bindPasswordEye`).