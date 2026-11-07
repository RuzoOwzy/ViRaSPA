# forms

Everyday form work on top of the browser's own validation (`required`, `min`, `max`, `pattern`, `type="email"`…), for native fields and form-associated components alike. API: `Viraspa.forms`.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer |

## Install

```bash
node node-tools/install.js add helper forms@0.1.0
```

Then add `"forms"` to `helpers` in `app/config/startup.js` (components that need it load it by themselves).

## Usage

```js
const form = this.container.querySelector("form");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!Viraspa.forms.validate(form).valid) return;       // focuses and explains the first problem
  await Viraspa.app.services.customers.save(Viraspa.forms.values(form));
});

const before = Viraspa.forms.snapshot(form);               // later: Viraspa.forms.isDirty(form, before)
Viraspa.forms.setReadOnly(form, !Viraspa.session.hasPrivilege("customers.edit"));
```

| Function | What it does |
| --- | --- |
| `markRequired(root)` | Adds a `*` to the label of each required field (`data-required-mark="off"` skips one). Runs by itself on every page shown. |
| `validate(root, { focus, messages })` | `{ valid, invalid }`. Messages `"inline"` (under the field, default) or `"browser"` (the browser's bubble); `data-error-message` gives your own text. Messages go away once the field is fixed. |
| `setReadOnly(root, on)` | Text fields read-only (still copyable), selects/checkboxes/buttons disabled, components `readonly`; `false` restores each exactly. `data-readonly-keep` leaves one alone. |
| `values(form)`, `fill(form, data)` | Read or write the fields by name. |
| `snapshot(root)`, `restore(root, snap)`, `isDirty(root, snap)` | Undo and "unsaved changes" checks. |
| `configure({ markRequired, messages })` | App-wide defaults. |

## Styling

`.vs-required-mark`, `.vs-field-error` and `[aria-invalid="true"]` use `--vs-color-danger`.

## Version history

- **0.1.0 (2026-11-08):** first version.