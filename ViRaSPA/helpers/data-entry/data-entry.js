(function (Viraspa) {
  // Data-entry mode: for screens where people type all day (sales, stock,
  // accounting), so the mouse is never needed.
  //
  //   <form data-entry-mode> ... </form>      a form, a page, a table - or <body> for the whole app
  //   Viraspa.dataEntry.configure({ app: true })   the same for the whole app
  //
  // Inside such an area:
  //   Enter          moves to the next field (read-only, disabled and hidden ones are skipped)
  //   Shift+Enter    moves back
  //   On the last field, Enter fires a cancelable "vs-entry-end" event on the
  //   area (a data-entry table adds a row there); with data-entry-submit on a
  //   form, the form is submitted instead.
  //   Number fields select their text on focus, so typing replaces it.
  //
  // What stays as usual: Enter in a textarea or a rich text editor (new line),
  // on a button or link (press it), and in an open list (choose). A field can
  // say data-enter="next" (always move on) or data-enter="default" (never).
  // The keys are overridable like any component's:
  //   Viraspa.keyboard.configure({ components: { "data-entry": { next: "tab", previous: false } } })
  // and the developer's own keydown handler always wins (preventDefault).

  const settings = { app: false, selectOnFocus: true };
  const DEFAULT_KEYS = { next: "enter", previous: "shift+enter" };
  const AREA = "[data-entry-mode]";

  const area = (el) => (el && el.closest ? el.closest(AREA) : null) || (settings.app ? document.body : null);

  // The element really focused, also inside components' shadow roots.
  function focusedField(event) {
    return event.composedPath().find((n) => n instanceof Element && (/^(input|select|textarea|button|a)$/i.test(n.localName) || n.isContentEditable || (n.constructor && n.constructor.formAssociated)));
  }

  function keepsEnter(field) {
    const choice = field.getAttribute("data-enter") || (field.closest && field.closest("[data-enter]") && field.closest("[data-enter]").getAttribute("data-enter"));
    if (choice === "next") return false;
    if (choice === "default") return true;
    if (/^(textarea|button|a)$/i.test(field.localName) || field.isContentEditable) return true;
    if (field.localName === "input" && /^(submit|button|reset|image|file)$/i.test(field.type)) return true;
    if (field.getAttribute("aria-expanded") === "true") return true; // an open list: Enter chooses
    return false;
  }

  // Fields in the area, in Tab order, that can take input now.
  function stops(container) {
    return Viraspa.keyboard
      .tabbables(container)
      .filter((el) => !el.readOnly && !el.hasAttribute("readonly") && !el.disabled && el.getAttribute("aria-disabled") !== "true" && !el.closest("[data-entry-skip]"));
  }

  function move(container, from, step) {
    const list = stops(container);
    const host = list.find((el) => el === from || el.contains(from) || (el.shadowRoot && el.shadowRoot.contains(from)));
    const index = list.indexOf(host || from);
    const next = list[index + step];
    if (next) {
      next.focus();
      return true;
    }
    return false;
  }

  function onKeyDown(event) {
    if (event.defaultPrevented || event.isComposing) return;
    const field = focusedField(event);
    if (!field) return;
    const container = area(field.getRootNode().host || field);
    if (!container) return;
    const keys = Viraspa.keyboard.keymap("data-entry", DEFAULT_KEYS, container);
    const action = Viraspa.keyboard.actionFor(event, keys);
    if (!action) return;
    if (action === "next" && keepsEnter(field) && Viraspa.keyboard.matches(event, "enter")) return;
    event.preventDefault();
    if (action === "previous") {
      move(container, field, -1);
      return;
    }
    if (move(container, field, 1)) return;
    // The last field.
    const end = new CustomEvent("vs-entry-end", { bubbles: true, cancelable: true, detail: { field } });
    container.dispatchEvent(end);
    if (!end.defaultPrevented) {
      const form = field.form || container.closest("form") || (container.localName === "form" ? container : null);
      if (form && form.hasAttribute("data-entry-submit")) form.requestSubmit();
    }
  }

  function onFocusIn(event) {
    if (!settings.selectOnFocus) return;
    const field = event.composedPath()[0];
    if (!(field instanceof HTMLInputElement) || !area(field)) return;
    const numeric = field.type === "number" || /^(decimal|numeric)$/.test(field.inputMode) || field.closest("vs-input-number");
    if (!numeric || field.readOnly) return;
    // At once, so the very next key typed replaces the value; a mouse click's
    // own mouseup would undo the selection, so that one mouseup is ignored.
    field.select();
    field.addEventListener("mouseup", (e) => e.preventDefault(), { once: true });
  }

  function configure(options = {}) {
    Object.assign(settings, options);
  }

  // On window, so the app's own handlers (on elements and on document) run
  // first; the keyboard rules (data-keys="native", preventDefault) apply.
  window.addEventListener("keydown", onKeyDown);
  document.addEventListener("focusin", onFocusIn);

  Viraspa.dataEntry = { configure, settings: () => ({ ...settings }), next: (field) => move(area(field), field, 1), previous: (field) => move(area(field), field, -1) };
})(window.Viraspa);
