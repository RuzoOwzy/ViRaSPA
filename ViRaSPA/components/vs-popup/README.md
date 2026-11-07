# vs-popup

A modal popup on the browser's own <dialog>, plus Viraspa.popup for quick alert, confirm, prompt, flash and drop messages that return promises.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N8) |
| Isolation | `full` |

## Install

```bash
node node-tools/install.js add component vs-popup@0.1.0
```

Nothing else to do: it loads the first time `<vs-popup>` appears.

For `Viraspa.popup` from the start, load it at startup: in `app/config/startup.js`, `components: ["vs-popup"]`.

## Usage

```html
<vs-popup id="edit" heading="Edit customer" size="medium">
  …content…
  <div slot="footer"><button data-close>Cancel</button> <button data-close="save">Save</button></div>
</vs-popup>
```

```js
const result = await document.querySelector("#edit").open();   // "save", or null when cancelled

await Viraspa.popup.alert("Saved.");
if (await Viraspa.popup.confirm("Delete invoice 1042?", { okLabel: "Delete", danger: true })) { … }
const name = await Viraspa.popup.prompt("New name", { value: "Amina", required: true });   // null when cancelled
Viraspa.popup.flash("Copied", { seconds: 2 });
Viraspa.popup.drop("Connection lost", { seconds: 5 });
await Viraspa.popup.open({ heading: "Report", url: "/reports/1.pdf", size: "full" });
```

## Attributes

| Attribute | Default | Meaning |
| --- | --- | --- |
| `heading` | | The title (also its accessible name). |
| `size` | `medium` | `small`, `medium`, `large` or `full`. |
| `closable` | `true` | The ×, Escape and a click outside close it; `"false"` for a popup that needs an answer. |
| `close-on-outside` | `true` | `"false"` keeps it open on outside clicks. |
| `modal` | `true` | `"false"` opens it without blocking the page. |
| `open` | | Opens on load. |

Any element with `data-close` inside closes it, with its value as the result.

## Behaviour

- **Focus:** moves into the popup (`[autofocus]`, else the first field or button), stays there, and returns to where it was on close.
- **Queue:** alert, confirm and prompt wait for each other, so they never overlap.
- **Pages by URL** open in a frame with a loading message; unsafe URLs are refused.

## Events

`vs-open`, `vs-close` (`detail: { value }`), `vs-cancel` (cancelable: ask before losing unsaved changes).

## Parts and CSS variables

Parts: `dialog`, `head`, `heading`, `close`, `body`, `footer`. Variables: `--vs-popup-width`, `--vs-popup-radius`, `--vs-popup-background`, `--vs-popup-backdrop`.

## Version history

- **0.1.0 (2026-11-08):** first version (migrated from `popup` and `fullScreenPopup`).