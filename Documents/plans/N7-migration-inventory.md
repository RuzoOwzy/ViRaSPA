# N7 · Migration inventory

Features of each old piece, taken from the newest sources, and what the new package keeps, improves or drops. **For the owner's review**: anything marked "dropped" or missing here can still be added before or after its milestone.

Sources (newest first):
- **O** = `CTC2\Published(CTC2Web-Backend)\…\wwwroot\JS\OwzyComponents.js` (5,237 lines, 11 Sep 2026)
- **G** = the same folder's `General.js` (11 Sep 2026)
- **E** = EliteWeb (`F:\Development\Elite\EliteWeb\EliteWeb\EliteWeb`): Sale.aspx entry rows, Company\ChartOfAccounts.aspx

Common improvements for every package: no jQuery; no inline style objects (CSS with `--vs-*` variables and `::part`); keyboard rules (N7 foundations) with overridable keys; labels translatable (`Viraspa.i18n`); works in forms (form-associated custom elements: `name`, `required`, `disabled`, reset, validity); light and dark-friendly colours; documented events; a README in the component template.

## Popups → `vs-popup` (N8)

**Found (O 5–510, 2690–2778):** `popup.alert(msg, fn, args, queued, shade)`, `confirm(msg, fn, args, queued, focusOk)`, `window(content, fn, args, showCancel, queued, fullScreen, ownButtons)`, `flash(msg, seconds, …)` (closes by itself), `drop(msg, seconds, …)` (slides from the top); a queue so popups don't overlap; button texts and titles as settings; `fullScreenPopup({ sourceUrl, isSourceInCurrentPage, forGoogleDocViewer, … })` with a header and tools.

**New:** `<vs-popup>` element (any content, header/body/footer slots, sizes `small | medium | large | full`) plus `Viraspa.popup.alert / confirm / prompt / flash / drop` returning promises (`if (await Viraspa.popup.confirm("Delete?")) …`); the queue kept; focus trapped and restored; Escape closes (switchable); page or URL content (iframe) with a loading state; the Google Docs viewer goes to `vs-media-viewer` as an opt-in. Built on the native `<dialog>`.

## Numbers → `vs-input-number` (N8)

**Found (O 972–1198, 2779 `valX`; G 979 `registerNumericFields`):** classes `.NumericField`, `.Dec` (decimals), `.Neg` (negatives), `.Money` (shows separators, raw value while editing); key filtering (digits, one dot, one leading minus; Ctrl+C/V/X/A allowed); up/down buttons with press-and-hold and min/max; `numberWithCommas`, `valX(value, decimalPlaces)` reading/writing the numeric value.

**New:** `<vs-input-number decimals="2" min max step negative grouping>`; `value` is a number (`valueAsNumber`), text shows the app's number format (`Viraspa.format`, the user's locale) and the raw number while editing; paste is cleaned; arrow keys and optional spin buttons (press-and-hold); select-on-focus (data-entry option); currency prefix/suffix.

## Dates → `vs-input-date` (N8)

**Found (O 772–971 `date`, 2202–2689 `calendarfy`):** a calendar popup with month and year views, previous/next month, out-of-month days, a popup trigger, `onDateSelectedFn`, disabled class; date parsing from many separators (`d/m/y`…), formatting, `dateDiff`.

**New:** `<vs-input-date>` (and `type="datetime"`, `type="month"`): typed input in the app's date format with a calendar popup (month/year views, today, keyboard arrows), `min`/`max`, disabled days (function), week start from the locale; values as ISO strings. Parsing/formatting through `Viraspa.format`; the old `date` helper is dropped.

## Selects → `vs-select`, `vs-select-search`, `vs-select-tree` (N8, N9)

**Found:** `selectX` (O 4224–4796): styled select with a filter box (watermark), max height, no-match text, inactive options, keyboard selection, revert on Escape, read-only class. `dynamicCombofy` (O 4984–5237): items loaded on demand. `bindTextBoxDropDown` (O 3007–3198): a text box that suggests rows from a hidden table: shown columns, filter columns, a column appended to the text, max rows. `dropdown.bindFilter` / `filterList` (G 1603). `treeCombofy` (O 3300–3621): a tree from a flat list (`categoryId`, `pCategoryId`, `level`, `isHeader`), multi- or single-select, header selection rules, filter, default values, bullets.

**New:** `vs-select` (fixed options, optional filter box, multi-select with chips); `vs-select-search` (type-ahead from a list, table columns or the server handler, columns shown in the list, "free text allowed" switch, min characters, debounce); `vs-select-tree` on top of `vs-tree` (same flat-list shape with configurable field names, header rules as options). All keyboard-complete and form-associated.

## Tabs → `vs-tabs` (N8)

**Found (O 2071–2200):** headers, selected index, `tabSelectedFn`, styles. **New:** `<vs-tabs>` with `<vs-tab label>` children; ARIA tablist with arrow keys; remember the last tab (option); lazy panels; events.

## Progress → `vs-progress` + core top line (N7, N8)

**Found (O 1798–1979 `FIITPrg`; G `showAjaxProgress`, `InProgressInformer`):** types `INFERNO` (growing) and `BAR`, start percent, speed; area overlays (dots, chart, infinity animations as GIFs); a spinner with text. **New:** core thin top-line loader (N7) for navigation and `Viraspa.busy`; `vs-progress` (bar, ring, dots; determinate or not; label) in CSS, no GIFs.

## Context menu → `vs-context-menu` (N8)

**Found (O 4797–4983):** items, `onContextShowFn`, `itemSelectedFn`, triggers by selector or element. **New:** right-click, long-press on touch and Shift+F10/Menu key; items with icons, dividers, disabled states, sub-menus later; per-item shortcuts shown.

## Viewers → `vs-media-viewer` (N10)

**Found (O 1199–1798, `FIITImgViewer`, `FIITGeneralViewer`; G `bindImageView`, `bindSVGZoomNPanning`):** previous/next with availability flags, caption, title, buttons on hover, zoom and pan for SVG, Google Docs viewer for documents. **New:** one viewer for images, PDF (browser viewer), SVG and video; zoom (wheel, pinch, buttons), pan, rotate, gallery navigation, keyboard; Google Docs viewer only as an opt-in (it sends the file address to Google).

## Cropping → `vs-image-cropper` (N10)

**Found (O 1980–2070, `imageTool` 4033):** crop width/height, `afterCropFn`, `onCropFn`, cropping points. **New:** fixed or free aspect ratio, minimum size, zoom/rotate, output as Blob/data URL at a chosen size and type, upload through a handler.

## Tooltips → helper `tooltip` (N7)

**Found (G 1835 and `ToolTiped` classes, 505 uses):** native `title` mostly; a custom tooltip marked unfinished in the source. **New:** `data-tooltip="…"` on any element (hover, focus, long-press), placement and delay, plus `vs-tooltip` for rich content.

## Forms → helper `forms` (N7)

**Found (G 851 `registerRequiredFields`, `validateForm`; G 1039 `registerReadOnlyFields`; 681 + 589 uses):** a `*` mark after required fields (`.NoMark` to skip, `.RequiredFieldMarked` on labels); validation that focuses the first invalid field; read-only mode for every field type (selects keep their value, checkboxes disabled), cached previous values. **New:** `Viraspa.forms` (`validate(form)`, `markRequired`, `setReadOnly(container, on)`, `snapshot()`/`restore()`, dirty check) using the browser's validity API, with messages from i18n.

## Data entry → helper `data-entry` (N7)

**Found (G 1236 `registerEnterKeyFocusNext`, 157 uses):** Enter moves to the next visible field (inputs, selects, SelectX links), not in textareas or on buttons; limited to a container. **New:** see the keyboard rules in the N plan: Enter/Shift+Enter, skips read-only fields, select-on-focus, per-field `data-enter`, every key overridable.

## Filter → helper `filter` (N7)

**Found (G 1603 `filterList`, `dropdown.bindFilter`, 226 uses):** filter a list or table by a keyword, chosen columns, max items, hide mismatches, header rows, exact match, excluded items. **New:** `Viraspa.filter.bind(input, listOrTable, { columns, exact, maxItems, highlight })`, accent- and case-insensitive.

## Tables → `vs-pagination`, `vs-table`, `vs-table-entry` (N9)

**Found:** `bindCustomAjaxPagination` (G 2946: page box, total pages, previous/next); `exportTablesAsCSV` (G 3032: file name, several tables); `bindTextOverflowFlexViewable` (G 1875: click a truncated cell to see all); `simplifyFilterPage` (G 1941, page-specific: filters drop-down, row selection and current record, multi-select and delete-selected, double-click to open); EliteWeb Sale.aspx entry rows (Enter to next cell, a new row on the last cell, totals, numeric cells). **New:** as in the N plan: cell wrappers, columns, sorting, filtering, server handler contract, selection, row actions, CSV export, full-text view of truncated cells, totals, phone layouts; `vs-table-entry` with Enter-adds-row (switchable).

## Tree → `vs-tree` (N9)

**Found (E ChartOfAccounts.aspx):** header and leaf nodes (leaves with bullets), hover "+" to add below, placeholder for a new node, locked system nodes, move to a new parent, delete only leaves, scroll into view. **New:** `<vs-tree>` with data or a children handler (load on expand), single/multi select with checkboxes, keyboard (arrows, Home/End, type-ahead), optional editing actions (add, rename, move, delete) each switchable and guarded by node rules (`locked`, `leafOnly`).

## Others

- **Textarea autosize (G 932, 132 uses):** `vs-textarea` grows with its text (native `field-sizing: content` where supported), min/max rows, the "Overlap" mode (grows over content below), character count.
- **Password eye (G 3012):** `vs-input-password` with a show/hide button, caps-lock hint, optional strength meter.
- **Countdown (G 2344):** `vs-countdown` to a date/time, format and `finished` event.
- **Colour picker (EliteWeb uses JSColor, GPL):** our own `vs-input-color` (swatches, recent colours, hex/RGB input, eyedropper where supported).
- **Rich text editor:** our own `vs-rich-text-editor` (N10); CKEditor add-ons are not migrated.
- **Dropped:** FIITScroll (custom scrollbars), slideshow, FIITwaterMark (placeholder), the `date` helper and `numberWithCommas` (Viraspa.format), `simplifyFilterPage` (ideas moved into `vs-table`), jQuery helpers (`bindFirst`, `nextIn`, `cssX`, `pressAndHold`…, replaced by plain DOM code where needed).
