# vs-media-viewer

A full-screen viewer for images, SVG, PDF, video and other documents. Images can be zoomed, panned and rotated, and several items open as a gallery.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N10) |
| Isolation | `full` |
| Needs | nothing |

## Install

```bash
node node-tools/install.js add component vs-media-viewer@0.1.0
```

It loads the first time `<vs-media-viewer>` appears.

## Usage

From code:

```html
<vs-media-viewer id="viewer" download></vs-media-viewer>
```

```js
viewer.open([
  { src: "receipts/1042.jpg", title: "Receipt 1042", caption: "Paid 8 Nov" },
  { src: "invoices/1042.pdf", title: "Invoice" },
  { src: "contracts/lease.docx" },
], 0);
```

As a gallery, where clicking an image or link inside opens the viewer at that item:

```html
<vs-media-viewer gallery>
  <img src="thumbs/1.jpg" data-full="photos/1.jpg" alt="Shop front" data-caption="Opened in March">
  <img src="thumbs/2.jpg" data-full="photos/2.jpg" alt="Store room">
  <a href="invoice.pdf">Invoice</a>
</vs-media-viewer>
```

Items: `src`, `title`, `caption` and `type`. `type` is `image`, `pdf`, `video` or `document`; it is guessed from the file extension when left out. In a gallery, `data-full` gives the large picture, `alt` (or the link text) the title, and `data-caption` the caption.

| Kind | Shown with |
| --- | --- |
| Images and SVG | The viewer itself: zoom, pan and rotate |
| PDF | The browser's own PDF viewer |
| Video | The browser's player |
| Other documents (Word, Excel…) | An "Open" / "Download" link |

## Attributes

| Attribute | Meaning |
| --- | --- |
| `gallery` | The images and links inside open the viewer. |
| `download` | Shows a download button. |
| `allow-external-viewer` | Shows Office documents with the Google Docs viewer. Off by default, because it sends the file's address to Google; the file must also be publicly reachable. |

Methods: `open(items, index)`, `close()`, `show(index)`, `fit()` and `rotate()`.

## Keyboard and mouse

| Key | Does |
| --- | --- |
| Left / Right, Page Up / Page Down | Previous / next |
| Home / End | First / last |
| + / − | Zoom in / out |
| 0 | Fit to the screen |
| R | Rotate 90° |
| Arrows (when zoomed) | Pan |
| Escape | Close (focus returns to where it was) |

The mouse wheel or a pinch zooms, dragging pans when zoomed, and a double-click zooms in or fits again. Swiping sideways at normal size goes to the next or previous item, with a finger or a mouse. Change keys with `viewer.keys = { next, previous, zoomIn, zoomOut, fit, rotate, first, last }`.

## Events

`vs-open`, `vs-close`, and `vs-change` (detail: `{ index, item }`).

## Version history

- **0.1.0 (2026-11-08):** first version.
