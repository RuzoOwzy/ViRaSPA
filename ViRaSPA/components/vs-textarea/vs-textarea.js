(function (Viraspa) {
  // A text area that grows with its text.
  //
  //   <vs-textarea name="note" rows="2" max-rows="8" maxlength="500" show-count></vs-textarea>
  //
  // - Grows between `rows` (default 2) and `max-rows` (then it scrolls).
  // - `overlap`: while focused it grows over the content below instead of
  //   pushing it down (the old "Overlap" mode); back to its size on blur.
  // - `show-count`: "120 / 500" (or just "120") under it.
  // - Enter is a new line, as in every editor. To let a key submit the form,
  //   give it one: keys = { submit: "ctrl+enter" } (off by default); the
  //   "vs-submit" event fires, then the form is submitted unless cancelled.
  // - Works in forms: name, required, minlength, maxlength, disabled,
  //   readonly, placeholder, reset. Events: input, change.
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const KEYS = { submit: false };
  const nativeSizing = typeof CSS !== "undefined" && CSS.supports("field-sizing", "content");

  class VsTextarea extends Viraspa.core.Component {
    static tag = "vs-textarea";
    static folder = "components/vs-textarea";
    static isolation = "full";
    static hasModel = false;
    static formAssociated = true;
    static delegatesFocus = true;
    static observedAttributes = ["value", "rows", "max-rows", "maxlength", "minlength", "disabled", "readonly", "required", "placeholder", "show-count"];

    constructor() {
      super();
      this._initial = null;
      this._pending = null;
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

    async afterLoad() {
      this.area = this.componentRoot.querySelector("textarea");
      this.counter = this.componentRoot.querySelector(".count");
      this.area.value = this._pending ?? this.getAttribute("value") ?? "";
      this._initial = this.area.value;
      this.listen(this.area, "input", () => this.refresh());
      this.listen(this.area, "change", () => this.dispatchEvent(new Event("change", { bubbles: true, composed: true })));
      this.listen(this.area, "keydown", (e) => this.onKey(e));
      this.listen(this.area, "focus", () => {
        // overlap: keep the space it takes now, so the page below doesn't move.
        this.style.setProperty("--vs-textarea-rest-height", `${this.area.offsetHeight}px`);
        this.toggleAttribute("data-focused", true);
      });
      this.listen(this.area, "blur", () => {
        this.removeAttribute("data-focused");
        this.resize();
      });
      this.sync();
    }

    attributeChangedCallback(name) {
      if (!this.area) return;
      if (name === "value") this.area.value = this.getAttribute("value") ?? "";
      this.sync();
    }

    sync() {
      const a = this.area;
      a.rows = Math.max(1, Number(this.getAttribute("rows")) || 2);
      for (const attr of ["maxlength", "minlength", "placeholder"]) {
        if (this.hasAttribute(attr)) a.setAttribute(attr, this.getAttribute(attr));
        else a.removeAttribute(attr);
      }
      a.required = this.hasAttribute("required");
      a.readOnly = this.hasAttribute("readonly");
      a.disabled = this.hasAttribute("disabled") || this.hasAttribute("data-form-disabled");
      const label = this.labelText();
      if (label) a.setAttribute("aria-label", label);
      this.style.setProperty("--vs-textarea-max-rows", Number(this.getAttribute("max-rows")) || 0);
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

    // Height follows the text (the browser's own field-sizing where it has it).
    resize() {
      const a = this.area;
      if (nativeSizing) return;
      const style = getComputedStyle(a);
      const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
      const extra = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      const minRows = a.rows;
      const maxRows = Number(this.getAttribute("max-rows")) || Infinity;
      a.style.height = "auto";
      const wanted = a.scrollHeight + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      const height = Math.min(Math.max(wanted, minRows * line + extra), maxRows * line + extra);
      a.style.height = `${height}px`;
      a.style.overflowY = wanted > height ? "auto" : "hidden";
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
