(function (Viraspa) {
  // A number field for money, quantities and measures.
  //
  //   <vs-input-number name="price" decimals="2" min="0" step="50" prefix="TZS" required></vs-input-number>
  //
  // - Shows the number in the user's format (1,250,000.00) and the plain number
  //   while editing; `value` is a Number (or null when empty).
  // - Only valid characters can be typed or pasted (digits, one decimal
  //   separator, a leading minus when negatives are allowed).
  // - Arrow Up/Down step, Page Up/Down step ×10 (keys overridable: keys =
  //   { increment, decrement, incrementMore, decrementMore }); optional spin
  //   buttons (`spin`), press and hold to repeat.
  // - Works in forms: name, required, min, max, disabled, readonly, reset.
  // Events: input (while typing), change (when committed).
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const KEYS = { increment: "arrowup", decrement: "arrowdown", incrementMore: "pageup", decrementMore: "pagedown" };

  class VsInputNumber extends Viraspa.core.Component {
    static tag = "vs-input-number";
    static folder = "components/vs-input-number";
    static isolation = "full";
    static hasModel = false;
    static formAssociated = true;
    static delegatesFocus = true;
    static observedAttributes = ["value", "min", "max", "step", "decimals", "disabled", "readonly", "required", "placeholder", "prefix", "suffix", "grouping"];

    constructor() {
      super();
      this._value = null;
      this._initial = null;
    }

    // ---- attributes -------------------------------------------------------
    num(name, fallback = null) {
      const raw = this.getAttribute(name);
      if (raw === null || raw === "") return fallback;
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    }
    get decimals() {
      return Math.max(0, Math.min(10, this.num("decimals", 0)));
    }
    get min() {
      return this.num("min");
    }
    get max() {
      return this.num("max");
    }
    get step() {
      return this.num("step", 1) || 1;
    }
    get allowNegative() {
      return this.hasAttribute("negative") || (this.min !== null && this.min < 0);
    }

    // ---- value ------------------------------------------------------------
    get value() {
      return this._value;
    }
    set value(v) {
      this._value = v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : this.round(Number(v));
      this.update();
    }
    get valueAsNumber() {
      return this._value === null ? NaN : this._value;
    }

    round(n) {
      const f = 10 ** this.decimals;
      return Math.round(n * f) / f;
    }

    locale() {
      return Viraspa.i18n ? Viraspa.i18n.locale.peek() : undefined;
    }
    separator() {
      const part = new Intl.NumberFormat(this.locale()).formatToParts(1.5).find((p) => p.type === "decimal");
      return part ? part.value : ".";
    }

    // The text shown when not editing: grouped, with the decimals.
    display(n) {
      if (n === null) return "";
      return new Intl.NumberFormat(this.locale(), {
        minimumFractionDigits: this.decimals,
        maximumFractionDigits: this.decimals,
        useGrouping: this.getAttribute("grouping") !== "false",
      }).format(n);
    }
    // The text while editing: no grouping, the locale's decimal separator.
    editing(n) {
      if (n === null) return "";
      const fixed = this.decimals ? n.toFixed(this.decimals).replace(/\.?0+$/, "") : String(Math.round(n));
      return fixed.replace(".", this.separator());
    }
    // Text typed or pasted -> a number (null when empty, NaN when invalid).
    // Rules: anything but digits, "-", "." and "," is dropped (spaces,
    // currency). Then:
    //   - both "." and "," present: the last one is the decimal point
    //     ("2.500,75" and "2,500.75" are both 2500.75);
    //   - one kind, several times: grouping ("1.234.567");
    //   - one kind, once: the locale's decimal separator is the decimal point;
    //     the other mark is too when at most `decimals` digits follow it
    //     ("12.5" typed where the separator is ","), else grouping ("2,500").
    parse(text) {
      const sep = this.separator();
      let s = String(text).replace(/[^0-9.,-]/g, "");
      if (!s || s === "-") return null;
      const negative = s.startsWith("-");
      s = s.replace(/-/g, "");
      const dots = (s.match(/\./g) || []).length;
      const commas = (s.match(/,/g) || []).length;
      let point = -1;
      if (dots && commas) point = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
      else if (dots + commas === 1) {
        const at = s.search(/[.,]/);
        if (s[at] === sep || (this.decimals > 0 && s.length - at - 1 <= this.decimals)) point = at;
      }
      const whole = (point === -1 ? s : s.slice(0, point)).replace(/[.,]/g, "");
      const fraction = point === -1 ? "" : s.slice(point + 1).replace(/[.,]/g, "");
      if (!whole && !fraction) return null;
      const n = Number(`${negative ? "-" : ""}${whole || "0"}${fraction ? `.${fraction}` : ""}`);
      return Number.isFinite(n) ? n : NaN;
    }
    // ---- rendering ----------------------------------------------------------
    async afterLoad() {
      const root = this.componentRoot;
      this.input = root.querySelector("input");
      this.up = root.querySelector(".up");
      this.down = root.querySelector(".down");
      this.up.setAttribute("aria-label", t("Increase"));
      this.down.setAttribute("aria-label", t("Decrease"));
      if (this.hasAttribute("value")) this._value = this.parseAttr();
      this._initial = this._value;

      this.listen(this.input, "beforeinput", (e) => this.onBeforeInput(e));
      this.listen(this.input, "input", () => {
        const n = this.parse(this.input.value);
        if (n === null || Number.isFinite(n)) this._value = n === null ? null : n;
        this.validate();
        this.setFormValue(this._value === null ? "" : String(this._value));
      });
      this.listen(this.input, "focus", () => {
        if (this.readOnly) return;
        this.input.value = this.editing(this._value);
        if (this.getAttribute("select-on-focus") !== "false") this.input.select();
      });
      this.listen(this.input, "blur", () => this.commit());
      this.listen(this.input, "keydown", (e) => this.onKey(e));
      for (const [button, dir] of [[this.up, 1], [this.down, -1]]) {
        this.listen(button, "pointerdown", (e) => this.hold(e, dir));
      }
      this.update();
    }

    parseAttr() {
      const n = Number(this.getAttribute("value"));
      return this.getAttribute("value") === "" || !Number.isFinite(n) ? null : this.round(n);
    }

    attributeChangedCallback(name) {
      if (!this.input) return;
      if (name === "value") this._value = this.parseAttr();
      this.update();
    }

    get readOnly() {
      return this.hasAttribute("readonly");
    }
    get disabled() {
      return this.hasAttribute("disabled") || this.hasAttribute("data-form-disabled");
    }

    update() {
      if (!this.input) return;
      const focused = this.componentRoot.activeElement === this.input;
      this.input.value = focused ? this.editing(this._value) : this.display(this._value);
      this.input.inputMode = this.decimals ? "decimal" : "numeric";
      this.input.placeholder = this.getAttribute("placeholder") || "";
      this.input.readOnly = this.readOnly;
      this.input.disabled = this.disabled;
      this.input.required = this.hasAttribute("required");
      this.input.setAttribute("aria-valuemin", this.min ?? "");
      this.input.setAttribute("aria-valuemax", this.max ?? "");
      if (this._value !== null) this.input.setAttribute("aria-valuenow", this._value);
      else this.input.removeAttribute("aria-valuenow");
      const label = this.labelText();
      if (label) this.input.setAttribute("aria-label", label);
      this.componentRoot.querySelector(".prefix").textContent = this.getAttribute("prefix") || "";
      this.componentRoot.querySelector(".suffix").textContent = this.getAttribute("suffix") || "";
      this.componentRoot.querySelector(".spin").hidden = !this.hasAttribute("spin");
      this.setFormValue(this._value === null ? "" : String(this._value));
      this.validate();
    }

    validate() {
      const v = this._value;
      const typed = this.input ? this.parse(this.input.value) : v;
      if (this.input && Number.isNaN(typed)) return this.setValidity({ badInput: true }, t("Enter a number."), this.input);
      if (v === null && this.hasAttribute("required")) return this.setValidity({ valueMissing: true }, t("Please fill in this field."), this.input);
      if (v !== null && this.min !== null && v < this.min) return this.setValidity({ rangeUnderflow: true }, t("The value must be {min} or more.").replace("{min}", this.display(this.min)), this.input);
      if (v !== null && this.max !== null && v > this.max) return this.setValidity({ rangeOverflow: true }, t("The value must be {max} or less.").replace("{max}", this.display(this.max)), this.input);
      this.setValidity({});
    }

    // Only characters that can make a valid number.
    onBeforeInput(event) {
      if (!event.data || event.inputType.startsWith("delete")) return;
      const sep = this.separator();
      const { selectionStart: start, selectionEnd: end, value } = this.input;
      const next = value.slice(0, start) + event.data + value.slice(end);
      const allowed = new RegExp(`^${this.allowNegative ? "-?" : ""}[0-9]*${this.decimals ? `([${sep === "." ? "\\." : sep}.][0-9]{0,${this.decimals}})?` : ""}$`);
      // Pasted, dropped or several characters at once (autofill, some
      // keyboards): cleaned into a number instead of refused.
      if (event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop" || event.data.length > 1) {
        event.preventDefault();
        const n = this.parse(event.data);
        if (n !== null && Number.isFinite(n)) {
          this.input.value = this.editing(this.round(this.allowNegative ? n : Math.abs(n)));
          this.input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return;
      }
      if (!allowed.test(next)) event.preventDefault();
    }

    onKey(event) {
      if (this.readOnly || this.disabled) return;
      const action = Viraspa.keyboard.actionFor(event, this.keymap(KEYS));
      if (!action) {
        if (event.key === "Enter") this.commit(); // the value is final; data-entry may move on
        return;
      }
      event.preventDefault();
      const size = action.endsWith("More") ? 10 : 1;
      this.stepBy((action.startsWith("increment") ? 1 : -1) * size);
    }

    stepBy(times) {
      const base = this._value === null ? (this.min !== null && this.min > 0 ? this.min : 0) : this._value;
      let n = this.round(base + times * this.step);
      if (this.min !== null) n = Math.max(this.min, n);
      if (this.max !== null) n = Math.min(this.max, n);
      if (!this.allowNegative) n = Math.max(0, n);
      this._value = n;
      this.input.value = this.componentRoot.activeElement === this.input ? this.editing(n) : this.display(n);
      this.setFormValue(String(n));
      this.validate();
      this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }

    // Press and hold a spin button: repeats, faster after a moment.
    hold(event, dir) {
      if (this.readOnly || this.disabled) return;
      event.preventDefault();
      this.input.focus();
      this.stepBy(dir);
      let delay = 400;
      const repeat = () => {
        this.stepBy(dir);
        delay = Math.max(40, delay * 0.8);
        timer = setTimeout(repeat, delay);
      };
      let timer = setTimeout(repeat, delay);
      const stop = () => {
        clearTimeout(timer);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      };
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    }

    commit() {
      if (!this.input) return;
      const n = this.parse(this.input.value);
      const before = this._lastCommitted;
      if (n === null) this._value = null;
      else if (Number.isFinite(n)) this._value = this.round(this.allowNegative ? n : Math.abs(n));
      if (this.componentRoot.activeElement !== this.input) this.input.value = this.display(this._value);
      this.setFormValue(this._value === null ? "" : String(this._value));
      this.validate();
      if (before !== this._value) {
        this._lastCommitted = this._value;
        this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      }
    }

    onFormReset() {
      this._value = this._initial;
      this._lastCommitted = this._value;
      this.update();
    }
    onFormDisabled() {
      this.update();
    }

    focus(options) {
      if (this.input) this.input.focus(options);
      else super.focus(options);
    }
    select() {
      if (this.input) this.input.select();
    }
  }

  Viraspa.core.defineComponent(VsInputNumber);
})(window.Viraspa);
