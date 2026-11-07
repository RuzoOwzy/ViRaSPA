# N7 report · Migration study and foundations

## Done

| Item | Where |
| --- | --- |
| Feature inventory of every component to migrate, from the newest sources | [N7-migration-inventory.md](N7-migration-inventory.md) |
| Keyboard foundations: shortcuts, override rules, key maps, focus helpers, skip link, `?` overlay | `viraspa/core/keyboard.js`, `core/page.js`, `core/component.js`, `styles/base.css` |
| Template helpers (call and pipe) | `viraspa/core/templates.js`, `services/databinding/data-binding-service.js` |
| Server-handler contract | `viraspa/core/data.js` |
| Top-line loader (navigation and global busy work) | `viraspa/core/busy.js`, `core/router.js`, `styles/base.css` |
| Form-associated components | `viraspa/core/component.js` |
| `Viraspa.app` conventions | `core/bootstrap.js`, project template READMEs, sample `app/utils`, `app/services` |
| ES-module libraries in startup groups | `utility/asset-loader.js`, `core/bootstrap.js`, `node-tools/lib/bundle.js` |
| Helpers `forms`, `data-entry`, `filter`, `tooltip` | ViRaSPA-Extensions `helpers/`, installed in the sample |
| Sample `/data-entry` page | `app/pages/data-entry/` |

The plan said the inventories would wait for review before building. The owner then asked to run every milestone to the end, so N8 starts from this inventory; changes from the review can still be made in any later milestone.

## Problems found and fixed during the review

- **Select-on-focus came too late:** number fields selected their text one frame after focus, so a fast typist's first key was added to the old value ("1" + "3" = "31"). They now select at once.
- **Tooltip closed at once on keyboard focus:** focusing a button scrolls it into view, and the tooltip closed on scroll. A tooltip for the focused element now follows the scroll; hover tooltips still close.
- **Help overlay off-centre:** the base CSS reset removed the dialog's own centring margins.
- **Highlight name mismatch** in the filter helper (each filter used its own name, the CSS one shared name): one shared highlight now.
- **`vs-menu`** used `data-tooltip` for its collapsed labels, which the tooltip helper would have treated as tooltips: renamed to `data-menu-label`.
- **Listener order:** the keyboard core and data-entry listen on `window`, so the app's own handlers on elements and on `document` always run first.

## Verified

- Browser tests: 50 pass in Edge (plain and bundled), Firefox 159 and WebKit 27.2. New: 11 foundation tests (helpers as calls and pipes, live; shortcuts and `preventDefault`; `data-keys="native"` and typing; specificity; key maps; roving and focus trap; data source debounce, cancelling and late answers; errors and retry; `localSource`; the top line; a form-associated component in a real form) and 5 helper tests.
- Node tests: 31 pass.
- The sample's `/data-entry` page with real key presses (Edge, port 8028, stopped afterwards): Enter through Customer, Product (the price fills in), Quantity (typing replaces the selected value), Price, past the read-only Discount, Note (`data-enter="next"`), Save; Enter on Save saves the row, resets the form and returns to Customer; Shift+Enter goes back; Alt+L locks and unlocks (the lock button keeps working); Alt+F jumps to the filter, and "elodie" finds "Élodie Mushi"; `?` lists the four page shortcuts; Tab to Save shows its tooltip, Escape hides it.
