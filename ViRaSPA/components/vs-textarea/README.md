# vs-textarea

A text area that grows with its text, with a maximum, an overlap mode (also inside table rows), a character count and an optional submit key.

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
<vs-textarea id="note" name="note" rows="2" max-rows="8" maxlength="500" show-count />

<!-- One line at rest; while typing it opens over what is below it. -->
<vs-textarea name="comment" overlap rest-rows="1" max-rows="8" />
```

It never has content of its own, so it may be written self-closing in page and component templates (or with `</vs-textarea>`; in `index.html` the closing tag is required).

## Attributes

| Attribute | Default | Meaning |
| --- | --- | --- |
| `rows` | `2` | The smallest height, in lines (honoured in every browser). |
| `max-rows` | none | The largest height; then it scrolls. |
| `overlap` | off | It rests at `rest-rows`, however long its text. While focused it opens over the content below (up to `max-rows`) instead of pushing it down, and goes back to its rest height on blur. It opens in the browser's top layer, so a scrolling container (such as a table) doesn't cut it off. The space it takes in the page never changes. |
| `rest-rows` | `1` | With `overlap`: its height, in lines, while it doesn't have focus. |
| `show-count` | off | `120 / 500` (with `maxlength`) or `120` under it, announced politely. |
| `value`, `name`, `required`, `minlength`, `maxlength`, `placeholder`, `disabled`, `readonly` | | As on a native textarea. |

The height is measured in whole lines. While it has focus it keeps one empty line ready below the text, so it grows before you reach its last line (as `bindTextAreaAutosize` did with `append: "\n"`).

In [vs-table-entry](../vs-table-entry/README.md), `editor="textarea"` puts one in each cell with `overlap rest-rows="1"`: rows stay one line high, and the cell you type in opens over the rows below.

## Keyboard

Enter is a new line, as in every editor (in a vs-table-entry cell, Enter moves on and Alt+Enter is the new line; `el.insertText(text)` types at the caret). No key submits by default; give one with `el.keys = { submit: "ctrl+enter" }`: the cancelable `vs-submit` event fires, then the form is submitted.

## Events

`input`, `change`, `vs-submit`.

## Parts and CSS variables

Parts: `wrap`, `textarea`, `count`. Variables: `--vs-input-border`, `--vs-input-background`, `--vs-input-padding`, `--vs-textarea-line`.

## Version history

- **0.1.0 (2026-11-08):** first version (migrated from `bindTextAreaAutosize`, including the Overlap mode). In development: grows a line ahead while focused, `rest-rows`, overlap in the top layer (works in table rows), `rows` honoured everywhere, `insertText()`, may be written self-closing.