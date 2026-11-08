# vs-image-cropper

Crops an image such as a profile photo, a product picture or a scanned receipt. You can move and resize the crop box, zoom and rotate, then get the result as a Blob, a data URL, a form file or an upload.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N10) |
| Isolation | `full` |
| Needs | nothing |

## Install

```bash
node node-tools/install.js add component vs-image-cropper@0.1.0
```

It loads the first time `<vs-image-cropper>` appears.

## Usage

```html
<form id="profile">
  <vs-image-cropper name="photo" aspect="1" output-width="400" output-type="image/jpeg" quality="0.85" required></vs-image-cropper>
</form>
```

```js
const blob = await cropper.toBlob();          // the cropped image
const url = cropper.toDataURL();              // or as a data URL
const box = cropper.crop;                     // { x, y, width, height } in the image's pixels

cropper.upload = async (blob) => (await api.uploadPhoto(blob)).url;
const saved = await cropper.save();           // calls upload; fires vs-upload
```

The image comes from `src`, from the "Choose image" button (or `cropper.chooseFile()`), or from a file dropped onto the cropper. Inside a form, the cropped image is sent as a file under `name`.

## Attributes

| Attribute | Meaning |
| --- | --- |
| `src` | The image to crop. It must be on the same site, or allow cross-origin use, or the result can't be read. |
| `aspect` | `1`, `16/9`, `4/3`…; leave it empty to crop freely. |
| `min-size` | The smallest crop, in output pixels. |
| `output-width`, `output-height` | The size of the result. If only one is given, the other follows the crop's shape; with neither, the crop keeps its own size. |
| `output-type` | `image/png` (default), `image/jpeg` or `image/webp`. |
| `quality` | 0–1 for JPEG and WebP (default 0.92). |
| `required` | In a form, an image must be chosen. |

Methods: `chooseFile()`, `loadFile(file)`, `rotate()`, `toBlob()`, `toDataURL()` and `save()`. Properties: `crop`, `loaded` and `upload`.

## Keyboard and mouse

Drag the box to move it, drag one of its 8 handles to resize it, and use the slider or the wheel to zoom.

| Key (on the box) | Does |
| --- | --- |
| Arrows | Move the box (Shift: 10 pixels at a time) |
| Alt+arrows | Resize the box |
| + / − | Zoom |
| R | Rotate 90° |

Change keys with `cropper.keys = { zoomIn, zoomOut, rotate }`.

## Events

`vs-image-load` (detail: `{ width, height }`), `vs-crop` while the box changes (detail: the crop in image pixels), and `vs-upload` (detail: `{ url }`).

## Version history

- **0.1.0 (2026-11-08):** first version.
