# vs-pagination

Page navigation for long lists: first, previous, a page box, next, last, "21-40 of 135" and a page-size choice.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N9) |
| Isolation | `full` |
| Needs | nothing |

## Install

```bash
node node-tools/install.js add component vs-pagination@0.1.0
```

What it needs is installed with it. It loads the first time `<vs-pagination>` appears.

## Usage

```html
<vs-pagination total="135" page-size="20" page-sizes="10,20,50,100"></vs-pagination>
```

```js
pager.addEventListener("vs-page-change", (e) => load(e.detail.page, e.detail.pageSize));
```

## Attributes

`page` (from 1), `page-size`, `total`, `page-sizes` (a list, or `off`), `compact` (only the arrows and "of y"). Properties: `page`, `pageSize`, `total`, `pages`, `go(page)`.

## Keyboard

Type a page and press Enter. While focus is inside: Alt+Left / Alt+Right previous / next, Alt+Home / Alt+End first / last (`keys = { previous, next, first, last }`).

## Events

`vs-page-change` (`{ page, pageSize }`). Changing the page size keeps the first row in view.

## Version history

- **0.1.0 (2026-11-08):** first version (migrated from `bindCustomAjaxPagination`).