# vs-textarea

A text area that grows with its text, with a maximum, an overlap mode, a character count and an optional submit key.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N8) |
| Isolation | `full` |

## Install

```bash
node node-tools/install.js add component vs-textarea@0.1.0
```

Nothing else to do: it loads the first time `<vs-textarea>` appears.

## Usage

```html
<label for="note">Note</label>
<vs-textarea id="note" name="note" rows="2" max-rows="8" maxlength="500" show-count></vs-textarea>
```

## Attributes

| Attribute | Default | Meaning |
| --- | --- | --- |
| `rows` | `2` | The smallest height, in lines. |
| `max-rows` | none | The largest height; then it scrolls. |
| `overlap` | off | While focused it grows over the content below instead of pushing it down; back to its size on blur. |
| `show-count` | off | `120 / 500` (with `maxlength`) or `120` under it, announced politely. |
| `value`, `name`, `required`, `minlength`, `maxlength`, `placeholder`, `disabled`, `readonly` | | As on a native textarea. |

Growing uses the browser's own `field-sizing: content` where available, and measures the text otherwise.

## Keyboard

Enter is a new line, as in every editor. No key submits by default; give one with `el.keys = { submit: "ctrl+enter" }`: the cancelable `vs-submit` event fires, then the form is submitted.

## Events

`input`, `change`, `vs-submit`.

## Parts and CSS variables

Parts: `wrap`, `textarea`, `count`. Variables: `--vs-input-border`, `--vs-input-background`, `--vs-input-padding`, `--vs-textarea-line`.

## Version history

- **0.1.0 (2026-11-08):** first version (migrated from `bindTextAreaAutosize`, including the Overlap mode).