(function (Viraspa) {
  // A password field with a show/hide button.
  //
  //   <vs-input-password name="password" autocomplete="current-password" required></vs-input-password>
  //   <vs-input-password name="newPassword" autocomplete="new-password" minlength="8" strength></vs-input-password>
  //
  // - The eye button shows or hides the text (also Alt+F8; keys = { toggle }).
  // - A warning when Caps Lock is on.
  // - `strength`: a meter under the field (weak / fair / good / strong) from
  //   the length and the kinds of characters - a hint, not a policy.
  // - "scoped" isolation (no Shadow DOM), like vs-login-form: the real
  //   <input> is in the page, so password managers and autofill find it. It
  //   takes the element's `name` and `id` (so <label for="…"> works), and
  //   required, minlength, maxlength, pattern, autocomplete, disabled,
  //   readonly - the browser validates and submits it like any input.
  // Events: input, change.
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const KEYS = { toggle: "alt+f8" };
  const LEVELS = ["Weak", "Fair", "Good", "Strong"];

  // 0..3 from length and variety (letters, CAPITALS, digits, symbols).
  function strength(text) {
    if (!text) return -1;
    const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(text)).length;
    let score = text.length >= 12 ? 2 : text.length >= 8 ? 1 : 0;
    score += kinds >= 3 ? 1 : 0;
    score += kinds === 4 && text.length >= 10 ? 1 : 0;
    return Math.min(3, score);
  }

  class VsInputPassword extends Viraspa.core.Component {
    static tag = "vs-input-password";
    static folder = "components/vs-input-password";
    static isolation = "scoped";
    static hasModel = false;
    static observedAttributes = ["name", "disabled", "readonly", "required", "minlength", "maxlength", "pattern", "placeholder", "autocomplete", "strength"];

    get value() {
      return this.input ? this.input.value : this._pending || "";
    }
    set value(v) {
      if (this.input) {
        this.input.value = v ?? "";
        this.refresh();
      } else this._pending = v ?? "";
    }
    // Strength 0-3 (-1 when empty).
    get strength() {
      return strength(this.value);
    }

    async afterLoad() {
      const root = this.componentRoot;
      this.input = root.querySelector("input");
      this.eye = root.querySelector(".eye");
      this.caps = root.querySelector(".caps");
      this.meter = root.querySelector(".meter");
      this.caps.textContent = t("Caps Lock is on");
      if (this._pending) this.input.value = this._pending;
      // The input takes the element's id, so <label for="id"> points at it.
      if (this.id) {
        this.input.id = this.id;
        this.removeAttribute("id");
      }
      const form = this.input.form;
      if (form) this.listen(form, "reset", () => setTimeout(() => this.toggle(false)));
      this.listen(this.input, "input", () => this.refresh());
      this.listen(this.input, "change", () => this.dispatchEvent(new Event("change", { bubbles: true, composed: true })));
      this.listen(this.input, "keydown", (e) => this.onKey(e));
      this.listen(this.input, "keyup", (e) => this.showCaps(e));
      this.listen(this.input, "blur", () => (this.caps.hidden = true));
      this.listen(this.eye, "click", () => this.toggle());
      this.sync();
    }

    attributeChangedCallback() {
      if (this.input) this.sync();
    }

    sync() {
      const i = this.input;
      for (const attr of ["minlength", "maxlength", "pattern", "placeholder"]) {
        if (this.hasAttribute(attr)) i.setAttribute(attr, this.getAttribute(attr));
        else i.removeAttribute(attr);
      }
      i.autocomplete = this.getAttribute("autocomplete") || "current-password";
      i.required = this.hasAttribute("required");
      i.readOnly = this.hasAttribute("readonly");
      i.disabled = this.hasAttribute("disabled");
      if (this.hasAttribute("name")) i.name = this.getAttribute("name");
      if (this.hasAttribute("aria-label")) i.setAttribute("aria-label", this.getAttribute("aria-label"));
      this.eye.disabled = i.disabled;
      this.meter.hidden = !this.hasAttribute("strength");
      this.refresh();
    }

    refresh() {
      const i = this.input;
      const shown = i.type === "text";
      this.eye.setAttribute("aria-pressed", String(shown));
      this.eye.setAttribute("aria-label", shown ? t("Hide password") : t("Show password"));
      this.eye.dataset.shown = String(shown);
      if (!this.meter.hidden) {
        const level = strength(i.value);
        this.meter.dataset.level = String(level);
        this.meter.querySelector(".label").textContent = level < 0 ? "" : t(LEVELS[level]);
      }
    }

    toggle(show) {
      const i = this.input;
      const next = show === undefined ? i.type === "password" : show;
      // Keep the cursor where it was.
      const { selectionStart, selectionEnd } = i;
      i.type = next ? "text" : "password";
      if (this.componentRoot.activeElement === i) i.setSelectionRange(selectionStart, selectionEnd);
      this.refresh();
    }

    onKey(event) {
      this.showCaps(event);
      if (Viraspa.keyboard.actionFor(event, this.keymap(KEYS)) === "toggle") {
        event.preventDefault();
        this.toggle();
      }
    }

    showCaps(event) {
      if (event.getModifierState) this.caps.hidden = !event.getModifierState("CapsLock");
    }

    focus(options) {
      if (this.input) this.input.focus(options);
      else super.focus(options);
    }
  }

  Viraspa.core.defineComponent(VsInputPassword);
})(window.Viraspa);
