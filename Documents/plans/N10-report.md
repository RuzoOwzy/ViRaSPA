# N10 report · Media viewer, image cropper, rich text editor v1

## Done

All three components are written entirely in our own code, with no third-party library.

| Package | Highlights |
| --- | --- |
| `vs-media-viewer` | `open(items, index)` or `gallery` mode (clicking a child image or link opens it, with `data-full` and `data-caption`); images and SVG with zoom (wheel, pinch, buttons, + / −), pan (drag; arrows when zoomed), fit (0, double-click), rotate (R), and a swipe for next/previous at normal size; PDF and video in the browser's own viewers; other documents as an open/download link, with the Google viewer only through `allow-external-viewer`; previous/next/Home/End; Escape closes and focus returns; overridable keys; `vs-open` / `vs-close` / `vs-change` |
| `vs-image-cropper` | image from `src`, "Choose image" or a dropped file; `aspect` (1, 16/9… or free), `min-size`; the box dragged by its body or 8 handles; zoom by slider or wheel; rotate 90°; keys (arrows, Shift ×10, Alt+arrows resize, + − R); `output-width` / `output-height` / `output-type` / `quality`; `toBlob()`, `toDataURL()`, `save()` with an `upload` handler; a form file under `name`; `required` |
| `vs-rich-text-editor` | paragraphs and H1–H3, bold/italic/underline/strike, lists with Tab indent, quote, alignment, links (a small form: edit, remove, new tab), images (address and description, or `uploadImage`, paste and drop with `image-paste`), horizontal line, undo/redo, clear formatting; `minimal` / `standard` / `full` toolbars with added and removed buttons; cleaned or `paste="plain"` paste; `maxlength` enforced while typing and pasting; `show-count`; `required`, `readonly`, `disabled`, reset; `format="text"`; `sticky-toolbar`; min/max height variables; shortcuts as in common editors and overridable; Alt+F10 to the toolbar with roving arrows |

The editor's engine is the browser's editing commands behind a two-method adapter (`exec`, `state`). Every value, whether set, pasted or produced by the browser, passes through our own allow-list sanitizer (`VsRichTextEditor.sanitize`), so browser differences and unsafe markup never reach the output.

## Problems found and fixed during the review

- **Arrow keys did nothing on a zoomed image** in the viewer: they were only used for previous/next. When zoomed they now pan, which is what the plan asked for.
- **The editor's output had an empty `<p></p>`** after a list or heading, and **invalid nested lists** (`<ul><li>a</li><ul>…</ul></ul>`, which browsers create when indenting). The sanitizer now drops empty paragraphs and moves a nested list into the item before it.
- **The README promised a swipe on phones that the viewer didn't have;** the swipe was added (at normal size only, so it never fights panning).
- **The viewer stopped on synthetic pointer events** (`setPointerCapture` throws for a pointer that isn't active); it now drags without capture in that case.

## Verified

- Browser tests: 71 pass (5 new in `tests/browser/media.test.js`) in Edge (plain and bundled), Firefox 159, WebKit 27.2, and on iPhone 15 (WebKit) and Pixel 7 (Chromium).
- The sanitizer removes `javascript:` links, `on…` attributes, scripts and iframes; converts `b`/`i`/`div`/`h4` and Word-style spans; keeps centring; fixes nested lists; and adds `rel="noopener noreferrer"` to new-tab links.
- `/showcase` with real keys in Edge:
  - **Editor:** typing with Ctrl+B gives `<p>Hello <strong>Amina</strong></p>`; Ctrl+Shift+8 makes a list and Tab indents it; Ctrl+K links the selection; the count reads "22 / 2000 characters · 4 words"; a pasted `h4` becomes `h3`, a table cell becomes a paragraph, and plain paste works.
  - **Media viewer:** opens from the gallery at "1 / 4" with its caption; + zooms to 125%, R rotates 90°, the arrows pan, 0 fits, End reaches the document item with its "Open or download it" link, swipes move next/next/back (and pan instead when zoomed), and Escape closes.
  - **Cropper:** Shift+Left moves the box 10 pixels and Alt+Left resizes it (still square); "Crop" gives a 128-pixel PNG.
- At phone width (375 px), the editor's toolbar wraps onto several lines and the page has no sideways scrolling.
