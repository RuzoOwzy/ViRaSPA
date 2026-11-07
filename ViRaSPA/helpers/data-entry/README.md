# data-entry

Data-entry mode, for screens where people type all day (sales, stock, accounting): the mouse is never needed. API: `Viraspa.dataEntry`.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer |

## Install

```bash
node node-tools/install.js add helper data-entry@0.1.0
```

Then add `"data-entry"` to `helpers` in `app/config/startup.js`.

## Usage

```html
<form data-entry-mode data-entry-submit> … </form>
```

Or for the whole app: `Viraspa.dataEntry.configure({ app: true })`.

Inside a `data-entry-mode` area:

| Key | Does |
| --- | --- |
| Enter | Next field (read-only, disabled and hidden ones are skipped) |
| Shift+Enter | Previous field |
| Enter on the last field | Fires a cancelable `vs-entry-end` event on the area (a data-entry table adds a row); with `data-entry-submit` on the form, submits it |

- **Kept as usual:** Enter in a textarea or rich text editor (a new line), on buttons and links, and in an open list. `data-enter="next"` or `data-enter="default"` on a field (or an area) changes that.
- **Number fields** select their text on focus (`configure({ selectOnFocus: false })` to stop it).
- **Your keys:** `Viraspa.keyboard.configure({ components: { "data-entry": { next: "enter", previous: false } } })`, or a `keys` attribute on the area: `keys='{"previous": "shift+tab"}'`. Your own keydown handler always wins (`event.preventDefault()`), and `data-keys="native"` switches it off inside an element.

## Version history

- **0.1.0 (2026-11-08):** first version.