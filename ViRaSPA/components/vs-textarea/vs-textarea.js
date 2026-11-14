(function (Viraspa) {
  // A text area that grows with its text.
  //
  //   <vs-textarea name="note" rows="2" max-rows="8" maxlength="500" show-count />
  //   <vs-textarea name="comment" overlap rest-rows="1" max-rows="8" />
  //
  // - Grows between `rows` (default 2) and `max-rows` (then it scrolls).
  //   While it has focus it keeps one empty line ready below the text, so it
  //   grows before you reach its last line.
  // - `overlap`: it rests at `rest-rows` lines (default 1), however long its
  //   text. While focused it opens over the content below - up to `max-rows`
  //   - instead of pushing it down, and goes back to its rest height on
  //   blur. It opens in the browser's top layer, so it also escapes a
  //   scrolling table (vs-table-entry's editor="textarea" uses it this way).
  //   The space it takes in the page never changes.
  // - `show-count`: "120 / 500" (or just "120") under it.
  // - Enter is a new line, as in every editor. To let a key submit the form,
  //   give it one: keys = { submit: "ctrl+enter" } (off by default); the
  //   "vs-submit" event fires, then the form is submitted unless cancelled.
  // - insertText(text): types text at the caret (used by vs-table-entry for
  //   Alt+Enter, where Enter moves to the next cell).
  // - Works in forms: name, required, minlength, maxlength, disabled,
  //   readonly, placeholder, reset. Events: input, change.
  // It never has content of its own: it may be written <vs-textarea … />.
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const KEYS = { submit: false };
  const topLayer = typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;

  class VsTextarea extends Viraspa.core.Component {
    static tag = "vs-textarea";
    static folder = "components/vs-textarea";
    static isolation = "full";
    static content = "none"; // no content of its own: may be written self-closing
    static hasModel = false;
    static formAssociated = true;
    static delegatesFocus = true;
    static observedAttributes = ["value", "rows", "max-rows", "rest-rows", "overlap", "maxlength", "minlength", "disabled", "readonly", "required", "placeholder", "show-count"];

    constructor() {
      super();
      this._initial = null;
      this._pending = null;
      this._focused = false;
    }

    get value() {
      return this.area ? this.area.value : this._pending ?? this.getAttribute("value") ?? "";
    }
    set value(v) {
      if (this.area) {
        this.area.value = v ?? "";
        this.refresh();
      } else this._pending = v ?? "";
    }

    get overlap() {
      return this.hasAttribute("overlap");
    }

    async afterLoad() {
      this.area = this.componentRoot.querySelector("textarea");
      this.wrap = this.componentRoot.querySelector(".wrap");
      this.counter = this.componentRoot.querySelector(".count");
      this.area.value = this._pending ?? this.getAttribute("value") ?? "";
      this._initial = this.area.value;
      this.listen(this.area, "input", () => this.refresh());
      this.listen(this.area, "change", () => this.dispatchEvent(new Event("change", { bubbles: true, composed: true })));
      this.listen(this.area, "keydown", (e) => this.onKey(e));
      this.listen(this.area, "focus", () => {
        this._focused = true;
        this.toggleAttribute("data-focused", true);
        if (this.overlap) this.openOver();
        this.resize();
      });
      this.listen(this.area, "blur", () => {
        this._focused = false;
        this.removeAttribute("data-focused");
        this.closeOver();
        this.resize();
      });
      // A new width can change how many lines the text takes.
      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(() => !this._open && this.resize());
        observer.observe(this.wrap);
        this._scope.add(() => observer.disconnect());
      }
      this.sync();
    }

    attributeChangedCallback(name) {
      if (!this.area) return;
      if (name === "value") this.area.value = this.getAttribute("value") ?? "";
      this.sync();
    }

    sync() {
      const a = this.area;
      for (const attr of ["maxlength", "minlength", "placeholder"]) {
        if (this.hasAttribute(attr)) a.setAttribute(attr, this.getAttribute(attr));
        else a.removeAttribute(attr);
      }
      a.required = this.hasAttribute("required");
      a.readOnly = this.hasAttribute("readonly");
      a.disabled = this.hasAttribute("disabled") || this.hasAttribute("data-form-disabled");
      const label = this.getAttribute("aria-label") || this.labelText();
      if (label) a.setAttribute("aria-label", label);
      this.refresh();
    }

    refresh() {
      const a = this.area;
      this.setFormValue(a.value);
      if (a.validity.valid) this.setValidity({});
      else this.setValidity(a.validity, a.validationMessage, a);
      const max = Number(this.getAttribute("maxlength")) || 0;
      this.counter.hidden = !this.hasAttribute("show-count");
      this.counter.textContent = max ? `${a.value.length} / ${max}` : String(a.value.length);
      this.counter.setAttribute("aria-label", max ? t("{count} of {max} characters").replace("{count}", a.value.length).replace("{max}", max) : t("{count} characters").replace("{count}", a.value.length));
      this.resize();
    }

    metrics() {
      const s = getComputedStyle(this.area);
      const line = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.5;
      const padding = parseFloat(s.paddingTop) + parseFloat(s.paddingBottom);
      const border = parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth);
      return { line, padding, border, height: (lines) => lines * line + padding + border };
    }

    restRows() {
      return Math.max(1, Number(this.getAttribute("rest-rows")) || 1);
    }

    // The height follows the text, in whole lines, between the minimum and
    // max-rows; with focus, one empty line more.
    resize() {
      const a = this.area;
      if (!a) return;
      const m = this.metrics();
      const maxRows = Number(this.getAttribute("max-rows")) || Infinity;
      if (this.overlap) {
        const rest = m.height(this.restRows());
        this.wrap.style.height = `${rest}px`;
        if (!this._focused) {
          a.style.height = `${rest}px`;
          a.style.overflowY = "hidden";
          a.scrollTop = 0;
          return;
        }
      } else this.wrap.style.height = "";
      const minRows = this.overlap ? this.restRows() : Math.max(1, Number(this.getAttribute("rows")) || 2);
      const scroll = a.scrollTop;
      a.style.height = "0px";
      const lines = Math.max(1, Math.round((a.scrollHeight - m.padding) / m.line)) + (this._focused ? 1 : 0);
      const shown = Math.min(Math.max(lines, minRows), maxRows);
      a.style.height = `${m.height(shown)}px`;
      a.style.overflowY = lines > maxRows ? "auto" : "hidden";
      a.scrollTop = scroll;
    }

    // ---- overlap: open over the content below ---------------------------------

    openOver() {
      if (this._open) return;
      this._open = true;
      const a = this.area;
      if (topLayer) {
        a.setAttribute("popover", "manual");
        try {
          a.showPopover();
        } catch {
          // already open, or not allowed: fixed positioning still works
        }
      }
      this.toggleAttribute("data-open", true);
      const follow = () => {
        if (!this._open) return;
        const r = this.wrap.getBoundingClientRect();
        a.style.left = `${r.left}px`;
        a.style.top = `${r.top}px`;
        a.style.width = `${r.width}px`;
        this._frame = requestAnimationFrame(follow); // keeps up with any scrolling container
      };
      follow();
      // Moving into the top layer must not lose the caret.
      if (this.componentRoot.activeElement !== a) a.focus({ preventScroll: true });
    }

    closeOver() {
      if (!this._open) return;
      this._open = false;
      cancelAnimationFrame(this._frame);
      const a = this.area;
      if (topLayer && a.hasAttribute("popover")) {
        try {
          a.hidePopover();
        } catch {
          // not open
        }
        a.removeAttribute("popover");
      }
      this.removeAttribute("data-open");
      a.style.left = a.style.top = a.style.width = "";
    }

    insertText(text) {
      const a = this.area;
      if (!a || a.readOnly || a.disabled) return;
      a.setRangeText(text, a.selectionStart, a.selectionEnd, "end");
      a.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    }

    onKey(event) {
      const action = Viraspa.keyboard.actionFor(event, this.keymap(KEYS));
      if (action !== "submit") return;
      event.preventDefault();
      const submit = new CustomEvent("vs-submit", { bubbles: true, composed: true, cancelable: true });
      if (this.dispatchEvent(submit) && this.form) this.form.requestSubmit();
    }

    onFormReset() {
      this.area.value = this._initial;
      this.refresh();
    }
    onFormDisabled() {
      this.sync();
    }
    focus(options) {
      if (this.area) this.area.focus(options);
      else super.focus(options);
    }
  }

  Viraspa.core.defineComponent(VsTextarea);
})(window.Viraspa);
