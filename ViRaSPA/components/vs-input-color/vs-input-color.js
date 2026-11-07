(function (Viraspa) {
  // A friendly colour picker: swatches, recent colours, a hex field, the
  // browser's full picker and (where supported) an eyedropper.
  //
  //   <vs-input-color name="labelColor" value="#1e8449"></vs-input-color>
  //   <vs-input-color palette="#c0392b,#d68910,#1e8449,#2e86c1,#7d3c98" no-custom></vs-input-color>
  //
  // - value: "#rrggbb" (lowercase) or "" when empty.
  // - palette: comma-separated colours (a friendly default set otherwise);
  //   recent colours (the last 8 chosen, kept in this browser) appear too.
  // - no-custom: only the palette (no hex field or full picker).
  // - Keyboard: Enter/Space/Alt+Down opens; arrow keys move between swatches;
  //   Enter chooses; Escape closes. Works in forms (name, required, disabled,
  //   readonly, reset). Events: input, change.
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const DEFAULT = ["#000000", "#5d6d7e", "#aab7b8", "#ffffff", "#c0392b", "#e74c3c", "#d68910", "#f4d03f", "#1e8449", "#2ecc71", "#117a65", "#48c9b0", "#1f618d", "#3498db", "#6c3483", "#af7ac5", "#a04000", "#f5b7b1", "#fad7a0", "#abebc6", "#aed6f1", "#d2b4de", "#1d2a26", "#0f6e48"];
  const RECENT_KEY = "vs-input-color:recent";
  const valid = (c) => /^#[0-9a-f]{6}$/i.test(c || "");
  const expand = (c) => {
    const s = String(c || "").trim().toLowerCase();
    if (/^#?[0-9a-f]{3}$/.test(s)) return `#${s.replace("#", "").split("").map((x) => x + x).join("")}`;
    if (/^#?[0-9a-f]{6}$/.test(s)) return `#${s.replace("#", "")}`;
    return "";
  };

  class VsInputColor extends Viraspa.core.Component {
    static tag = "vs-input-color";
    static folder = "components/vs-input-color";
    static isolation = "full";
    static hasModel = false;
    static formAssociated = true;
    static delegatesFocus = true;
    static observedAttributes = ["value", "palette", "disabled", "readonly", "required"];

    constructor() {
      super();
      this._value = "";
    }

    get value() {
      return this._value;
    }
    set value(v) {
      this._value = expand(v);
      this.update();
    }

    palette() {
      const own = (this.getAttribute("palette") || "").split(",").map(expand).filter(valid);
      return own.length ? own : DEFAULT;
    }
    recent() {
      try {
        return (JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") || []).filter(valid).slice(0, 8);
      } catch {
        return [];
      }
    }
    remember(color) {
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify([color, ...this.recent().filter((c) => c !== color)].slice(0, 8)));
      } catch {
        // storage not available
      }
    }

    async afterLoad() {
      const root = this.componentRoot;
      this.button = root.querySelector(".control");
      this.swatch = root.querySelector(".swatch");
      this.code = root.querySelector(".code");
      this.panel = root.querySelector(".panel");
      this.panel.setAttribute("popover", "auto");
      this.panel.setAttribute("aria-label", t("Choose a colour"));
      if (this.hasAttribute("value")) this._value = expand(this.getAttribute("value"));
      this._initial = this._value;
      this.listen(this.button, "click", () => (this.isOpen ? this.close() : this.open()));
      this.listen(this.button, "keydown", (e) => {
        if (e.key === "ArrowDown" && e.altKey) {
          e.preventDefault();
          this.open();
        }
      });
      this.listen(this.panel, "click", (e) => this.onPanelClick(e));
      this.listen(this.panel, "keydown", (e) => this.onPanelKey(e));
      this.listen(this.panel, "input", (e) => {
        if (e.target.classList.contains("native")) this.preview(e.target.value);
      });
      this.listen(this.panel, "change", (e) => {
        if (e.target.classList.contains("native")) this.pick(e.target.value);
        if (e.target.classList.contains("hex")) {
          const c = expand(e.target.value);
          if (c) this.pick(c);
          else e.target.setCustomValidity(t("Enter a colour like #1e8449."));
        }
      });
      this.listen(this.panel, "toggle", (e) => {
        if (e.newState === "closed") {
          this.button.setAttribute("aria-expanded", "false");
          if (this._stop) this._stop();
        }
      });
      this.update();
    }

    attributeChangedCallback(name) {
      if (!this.button) return;
      if (name === "value") this._value = expand(this.getAttribute("value"));
      this.update();
    }

    get disabled() {
      return this.hasAttribute("disabled") || this.hasAttribute("data-form-disabled");
    }
    get isOpen() {
      return Boolean(this.panel && this.panel.matches(":popover-open"));
    }

    update() {
      this.swatch.style.background = this._value || "transparent";
      this.swatch.classList.toggle("empty", !this._value);
      this.code.textContent = this._value || t("No colour");
      this.button.disabled = this.disabled;
      this.button.toggleAttribute("data-readonly", this.hasAttribute("readonly"));
      const label = this.labelText();
      this.button.setAttribute("aria-label", `${label ? `${label}: ` : ""}${this._value || t("No colour")}`);
      this.setFormValue(this._value);
      if (this.hasAttribute("required") && !this._value) this.setValidity({ valueMissing: true }, t("Please choose a colour."), this.button);
      else this.setValidity({});
    }

    preview(color) {
      this.swatch.style.background = color;
    }

    open() {
      if (this.disabled || this.hasAttribute("readonly")) return;
      const esc = Viraspa.utility.dom.escapeHtml;
      const swatches = (list) =>
        list.map((c) => `<button type="button" class="pick" data-color="${c}" aria-label="${c}"${c === this._value ? ' aria-pressed="true"' : ""}></button>`).join("");
      const recent = this.recent();
      const custom = !this.hasAttribute("no-custom");
      this.panel.innerHTML =
        `<div class="grid" role="group" aria-label="${esc(t("Colours"))}">${swatches(this.palette())}</div>` +
        (recent.length ? `<div class="label">${esc(t("Recent"))}</div><div class="grid" role="group" aria-label="${esc(t("Recent"))}">${swatches(recent)}</div>` : "") +
        (custom
          ? `<div class="custom"><label>${esc(t("Hex"))} <input class="hex" value="${esc(this._value)}" maxlength="7" spellcheck="false"></label>` +
            `<label class="more">${esc(t("More…"))}<input class="native" type="color" value="${esc(this._value || "#000000")}"></label>` +
            (window.EyeDropper ? `<button type="button" class="dropper" aria-label="${esc(t("Pick a colour from the screen"))}">&#128167;</button>` : "") +
            `</div>`
          : "") +
        `<div class="foot"><button type="button" class="none">${esc(t("No colour"))}</button></div>`;
      // Colours set from script (allowed under a strict Content Security Policy).
      for (const el of this.panel.querySelectorAll(".pick")) el.style.setProperty("--c", el.dataset.color);
      this.panel.showPopover();
      this.button.setAttribute("aria-expanded", "true");
      this._stop = Viraspa.utility.dom.follow(this.panel, this.button, { placement: "bottom-start" });
      (this.panel.querySelector('.pick[aria-pressed="true"]') || this.panel.querySelector(".pick")).focus();
    }

    close() {
      if (this.isOpen) this.panel.hidePopover();
      this.button.focus();
    }

    pick(color) {
      const before = this._value;
      this._value = expand(color);
      if (this._value) this.remember(this._value);
      this.update();
      this.close();
      if (before !== this._value) {
        this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      }
    }

    async onPanelClick(event) {
      const el = event.target.closest("button");
      if (!el) return;
      if (el.dataset.color) this.pick(el.dataset.color);
      else if (el.classList.contains("none")) this.pick("");
      else if (el.classList.contains("dropper")) {
        try {
          const { sRGBHex } = await new window.EyeDropper().open();
          this.pick(sRGBHex);
        } catch {
          // cancelled
        }
      }
    }

    onPanelKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
        return;
      }
      const pick = event.target.closest && event.target.closest(".pick");
      if (!pick) return;
      const grid = pick.parentElement;
      const all = [...grid.querySelectorAll(".pick")];
      const perRow = Math.max(1, Math.round(grid.clientWidth / pick.offsetWidth) || 8);
      const i = all.indexOf(pick);
      const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: perRow, ArrowUp: -perRow };
      if (event.key in moves) {
        event.preventDefault();
        const next = all[Math.max(0, Math.min(all.length - 1, i + moves[event.key]))];
        next.focus();
      }
    }

    onFormReset() {
      this._value = this._initial;
      this.update();
    }
    onFormDisabled() {
      this.update();
    }
    focus(options) {
      if (this.button) this.button.focus(options);
      else super.focus(options);
    }
  }

  Viraspa.core.defineComponent(VsInputColor);
})(window.Viraspa);
