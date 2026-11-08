# vs-rich-text-editor

A rich text editor written entirely in our own code (no third-party library). It edits paragraphs and headings, formatting, lists, quotes, alignment, links and images, and its output is always clean, safe HTML.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N10) |
| Isolation | `scoped` (no Shadow DOM, because editing inside a shadow root is not reliable in every browser yet) |
| Needs | nothing (it uses `Viraspa.popup` for the image prompt when available) |

## Install

```bash
node node-tools/install.js add component vs-rich-text-editor@0.1.0
```

It loads the first time `<vs-rich-text-editor>` appears.

## Usage

```html
<label for="body">Message</label>
<vs-rich-text-editor id="body" name="body" toolbar="standard" maxlength="5000" show-count placeholder="Write your message…"></vs-rich-text-editor>
```

```js
body.value = "<p>Hello <strong>Amina</strong></p>";   // clean HTML in…
const html = body.value;                             // …and out (always sanitized)
const plain = body.text;                             // the text without formatting
body.uploadImage = async (file) => (await api.upload(file)).url;   // optional: images are uploaded, not linked
```

Inside a `<form>` it behaves like a native field: its value is sent under `name`, and it supports `required`, reset and `disabled`. Use `format="text"` to send plain text instead of HTML.

## The toolbar

`toolbar` takes a preset, button names and groups, with `|` as a separator. A name starting with `-` removes that button, and `none` hides the toolbar.

| Preset | Buttons |
| --- | --- |
| `minimal` | bold italic, bullets numbers, link |
| `standard` (default) | block, bold italic underline, lists, link, undo redo |
| `full` | block, bold italic underline strike, lists indents, quote, align, link image hr, clear, undo redo |

Buttons: `block` (Paragraph, Heading 1–3), `bold`, `italic`, `underline`, `strike`, `bullets`, `numbers`, `indent`, `outdent`, `quote`, `left`, `center`, `right`, `link`, `image`, `hr`, `undo`, `redo`, `clear`.
Groups: `text`, `lists`, `indents`, `align`, `history`.

```html
<vs-rich-text-editor toolbar="minimal underline -link"></vs-rich-text-editor>
<vs-rich-text-editor toolbar="bold italic | lists | link"></vs-rich-text-editor>
```

## Attributes

| Attribute | Meaning |
| --- | --- |
| `toolbar` | Which buttons to show (see above). |
| `placeholder` | Shown while the editor is empty. |
| `value` | The starting HTML (or set the `value` property). |
| `maxlength` | The most characters allowed; typing and pasting stop at the limit. |
| `show-count` | Shows "120 / 5000 characters · 21 words" under the editor. |
| `required`, `readonly`, `disabled` | As for native fields. In read-only mode the toolbar is hidden. |
| `paste="plain"` | Pasted content always arrives as plain text (by default it is cleaned but keeps its formatting). |
| `image-paste` | A pasted or dropped image file is uploaded with `uploadImage` and inserted. |
| `link-target="_blank"` | New links open in a new tab by default (they always get `rel="noopener noreferrer"`). |
| `format="text"` | The form value is plain text rather than HTML. |
| `sticky-toolbar` | The toolbar stays visible while a long text scrolls. |
| `aria-label` | The editor's accessible name if it has no `<label>`. |

Height: `--vs-rte-min-height` (default 8rem) and `--vs-rte-max-height` (default none; the text area scrolls past it).

Properties: `value`, `text`, `uploadImage`, `keys`, `allowed`. Methods: `run(name)` runs a button (for example `run("bold")`), `sanitize(html)` and `focus()`.

## Keyboard

The keys behave as they do in common editors. On a Mac, Ctrl means Cmd.

| Key | Does |
| --- | --- |
| Ctrl+B / I / U | Bold, italic, underline |
| Ctrl+Shift+X | Strikethrough |
| Ctrl+Shift+8 / 7 | Bulleted / numbered list |
| Tab / Shift+Tab in a list, Ctrl+] / Ctrl+[ | Indent / outdent |
| Ctrl+Shift+9 | Quote |
| Ctrl+Shift+L / E / R | Align left / centre / right |
| Ctrl+K | Link (edit or remove a link the cursor is on) |
| Ctrl+\\ | Clear formatting |
| Ctrl+Z / Ctrl+Y | Undo / redo (the browser's own) |
| Enter, Shift+Enter | New paragraph, line break |
| Alt+F10 | Go to the toolbar; arrows move along it, Escape returns to the text |

Tab outside a list leaves the editor as usual, so keyboard users are never trapped. Change or turn off shortcuts with `editor.keys = { bold: "mod+b", link: false }`, or for every editor with `Viraspa.keyboard.configure({ "vs-rich-text-editor": { … } })`.

## The HTML it produces

All HTML goes through the sanitizer: what you set, what is pasted and what the browser creates. Only these tags remain:

`p`, `br`, `h1`–`h3`, `strong`, `em`, `u`, `s`, `ul`, `ol`, `li`, `blockquote`, `hr`, `a` (href, title, target) and `img` (src, alt, title, width, height). `text-align` is kept on blocks.

- `b`, `i`, `strike`/`del`, `div` and `h4`–`h6` become `strong`, `em`, `s`, `p` and `h3`. Other tags are unwrapped and their text is kept.
- `script`, `style`, `iframe`, forms, SVG and similar are removed with their content, and so are every `on…` attribute and every `style` except alignment.
- Links keep only `http`, `https`, `mailto`, `tel` and relative addresses, so `javascript:` is removed. Images keep only `http(s)`, relative, `blob:` and `data:image/…` addresses.
- Bold, italic and underline written as Word or Google Docs `<span style>` become real tags. Lists nested the wrong way are fixed, empty paragraphs are dropped, and loose text is wrapped in `<p>`.

The sanitizer is also available on its own, for example to clean HTML on display: `customElements.get("vs-rich-text-editor").sanitize(html)`. **Always sanitize again on the server** before you store or show HTML that came from a browser.

## Events

`input` (while typing) and `change` (when the editor loses focus with a changed value).

## Limits of version 1

There are no tables, colours, font sizes or code blocks yet. Undo and redo use the browser's own history. The engine is the browser's editing commands behind a small adapter (`exec`/`state`), so later versions can replace it piece by piece without changing the output.

## Version history

- **0.1.0 (2026-11-08):** first version.
