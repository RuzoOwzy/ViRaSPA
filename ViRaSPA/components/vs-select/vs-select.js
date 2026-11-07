(function (Viraspa) {
  // A select for a fixed list of options, with an optional filter box and
  // multiple choice.
  //
  //   <vs-select name="region" placeholder="Choose a region" required>
  //     <option value="dar">Dar es Salaam</option>
  //     <option value="aru">Arusha</option>
  //     <optgroup label="South"><option value="mbe">Mbeya</option></optgroup>
  //   </vs-select>
  //   <vs-select name="tags" multiple filter></vs-select>   + select.options = [{ value, label, disabled, group }]
  //
  // - Options: <option>/<optgroup> children, or the `options` property.
  // - filter: a filter box at the top of the list (accent- and case-
  //   insensitive); filter="auto" (default) shows it from 8 options on;
  //   filter="off" never.
  // - multiple: chips for the chosen options; the list stays open while choosing.
  // - clearable: a × button to clear the choice.
  // - Keyboard (combobox pattern): Enter, Space, Alt+Down or typing opens; Up/Down
  //   /Home/End/Page Up/Page Down move; Enter chooses; Escape closes (and puts
  //   back the old choice); Tab chooses the highlighted option and moves on;
  //   typing letters jumps to the next match. Keys overridable: keys =
  //   { open, close, choose }.
  // - value: a string ("" when empty), an array with `multiple`. Works in
  //   forms (name, required, disabled, reset). Events: change, input.
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const plain = (v) => String(v ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const esc = (s) => Viraspa.utility.dom.escapeHtml(s);

  class VsSelect extends Viraspa.core.Component {
    static tag = "vs-select";
    static folder = "components/vs-select";
    static isolation = "full";
    static hasModel = false;
    static formAssociated = true;
    static delegatesFocus = true;
    static observedAttributes = ["value", "disabled", "readonly", "required", "placeholder", "multiple", "filter"];

    constructor() {
      super();
      this._options = null;
      this._selected = [];
      this._initial = [];
    }

    get multiple() {
      return this.hasAttribute("multiple");
    }
    get options() {
      if (this._options) return this._options;
      return [...this.querySelectorAll("option")].map((o) => ({
        value: o.value,
        label: o.label || o.textContent.trim(),
        disabled: o.disabled,
        group: o.parentElement && o.parentElement.localName === "optgroup" ? o.parentElement.label : "",
      }));
    }
    set options(list) {
      this._options = (list || []).map((o) => (typeof o === "object" ? { value: String(o.value), label: String(o.label ?? o.value), disabled: Boolean(o.disabled), group: o.group || "" } : { value: String(o), label: String(o), disabled: false, group: "" }));
      this._selected = this._selected.filter((v) => this._options.some((o) => o.value === v));
      if (this.list) this.renderList();
      this.refresh();
    }

    get value() {
      return this.multiple ? [...this._selected] : this._selected[0] ?? "";
    }
    set value(v) {
      const wanted = v === null || v === undefined || v === "" ? [] : [].concat(v).map(String);
      this._selected = this.multiple ? wanted : wanted.slice(0, 1);
      this.refresh();
    }
    get selectedOptions() {
      return this._selected.map((v) => this.options.find((o) => o.value === v)).filter(Boolean);
    }

    async afterLoad() {
      const root = this.componentRoot;
      this.button = root.querySelector(".control");
      this.chips = root.querySelector(".chips");
      this.text = root.querySelector(".text");
      this.clear = root.querySelector(".clear");
      this.panel = root.querySelector(".panel");
      this.filterBox = root.querySelector(".filter");
      this.list = root.querySelector('[role="listbox"]');
      this.list.id = Viraspa.utility.dom.uid("vs-select-list");
      this.button.setAttribute("aria-controls", this.list.id);
      this.panel.setAttribute("popover", "auto");
      this.filterBox.placeholder = t("Filter…");
      this.filterBox.setAttribute("aria-label", t("Filter the options"));
      this.clear.setAttribute("aria-label", t("Clear"));

      const fromAttr = this.getAttribute("value");
      if (fromAttr !== null && fromAttr !== "") this._selected = this.multiple ? fromAttr.split(",").map((s) => s.trim()) : [fromAttr];
      else this._selected = this.options.filter((o, i) => this.querySelectorAll("option")[i] && this.querySelectorAll("option")[i].selected && this.querySelectorAll("option")[i].hasAttribute("selected")).map((o) => o.value);
      this._initial = [...this._selected];

      this.listen(this.button, "click", () => (this.isOpen ? this.close() : this.open()));
      this.listen(this.button, "keydown", (e) => this.onKey(e));
      this.listen(this.filterBox, "keydown", (e) => this.onKey(e));
      this.listen(this.filterBox, "input", () => this.renderList());
      this.listen(this.list, "click", (e) => {
        const item = e.target.closest('[role="option"]');
        if (item && item.getAttribute("aria-disabled") !== "true") this.choose(item.dataset.value);
      });
      this.listen(this.list, "pointermove", (e) => {
        const item = e.target.closest('[role="option"]');
        if (item) this.highlight(item);
      });
      this.listen(this.chips, "click", (e) => {
        const x = e.target.closest("[data-remove]");
        if (x) {
          e.stopPropagation();
          this.toggleValue(x.dataset.remove);
        }
      });
      this.listen(this.clear, "click", (e) => {
        e.stopPropagation();
        this._selected = [];
        this.changed();
        this.button.focus();
      });
      this.listen(this.panel, "toggle", (e) => {
        if (e.newState === "closed") this.onClosed();
      });
      // Options added later as children.
      this._observer = new MutationObserver(() => {
        if (!this._options) {
          if (this.list) this.renderList();
          this.refresh();
        }
      });
      this._observer.observe(this, { childList: true, subtree: true, characterData: true });
      this._scope.add(() => this._observer.disconnect());
      this.refresh();
    }

    attributeChangedCallback(name) {
      if (!this.button) return;
      if (name === "value") this.value = this.multiple ? (this.getAttribute("value") || "").split(",").filter(Boolean) : this.getAttribute("value");
      else this.refresh();
    }

    get isOpen() {
      return Boolean(this.panel && this.panel.matches(":popover-open"));
    }
    get disabled() {
      return this.hasAttribute("disabled") || this.hasAttribute("data-form-disabled");
    }

    // ---- display ----------------------------------------------------------
    refresh() {
      if (!this.button) return;
      const chosen = this.selectedOptions;
      const label = this.labelText();
      if (label) this.button.setAttribute("aria-label", label);
      this.button.setAttribute("aria-disabled", String(this.disabled));
      this.button.tabIndex = this.disabled ? -1 : 0;
      this.button.toggleAttribute("data-readonly", this.hasAttribute("readonly"));
      if (this.multiple) {
        this.chips.innerHTML = chosen
          .map((o) => `<span class="chip" part="chip">${esc(o.label)}<button type="button" class="chip-x" tabindex="-1" data-remove="${esc(o.value)}" aria-label="${esc(t("Remove {item}").replace("{item}", o.label))}">&times;</button></span>`)
          .join("");
        this.text.textContent = chosen.length ? "" : this.getAttribute("placeholder") || "";
      } else {
        this.chips.innerHTML = "";
        this.text.textContent = chosen.length ? chosen[0].label : this.getAttribute("placeholder") || "";
      }
      this.text.classList.toggle("placeholder", !chosen.length);
      this.clear.hidden = !this.hasAttribute("clearable") || !chosen.length || this.disabled || this.hasAttribute("readonly");
      // Form value: one entry per chosen option.
      if (this.multiple) {
        const data = new FormData();
        for (const v of this._selected) data.append(this.name || "value", v);
        this.setFormValue(this._selected.length ? data : null);
      } else this.setFormValue(this._selected[0] ?? "");
      if (this.hasAttribute("required") && !this._selected.length) this.setValidity({ valueMissing: true }, t("Please choose an option."), this.button);
      else this.setValidity({});
      if (this.isOpen) this.renderList();
    }

    renderList() {
      const words = plain(this.filterBox.value).split(/\s+/).filter(Boolean);
      const visible = this.options.filter((o) => !words.length || words.every((w) => plain(o.label).includes(w)));
      let html = "";
      let group = null;
      visible.forEach((o) => {
        if (o.group !== group) {
          group = o.group;
          if (group) html += `<div class="group" role="presentation">${esc(group)}</div>`;
        }
        const selected = this._selected.includes(o.value);
        html += `<div role="option" class="option" part="option" id="${this.list.id}-${esc(o.value).replace(/[^\w-]/g, "_")}" data-value="${esc(o.value)}" aria-selected="${selected}"${o.disabled ? ' aria-disabled="true"' : ""}>${this.multiple ? '<span class="check" aria-hidden="true"></span>' : ""}${esc(o.label)}</div>`;
      });
      this.list.innerHTML = html || `<div class="empty" role="presentation">${esc(t("No match"))}</div>`;
      this.list.setAttribute("aria-multiselectable", String(this.multiple));
      const keep = this._highlighted && this.list.querySelector(`[data-value="${CSS.escape(this._highlighted)}"]`);
      this.highlight(keep || this.list.querySelector('[aria-selected="true"]:not([aria-disabled="true"])') || this.list.querySelector('[role="option"]:not([aria-disabled="true"])'));
    }

    highlight(item) {
      for (const el of this.list.querySelectorAll(".active")) el.classList.remove("active");
      if (!item) {
        this._highlighted = null;
        this.button.removeAttribute("aria-activedescendant");
        return;
      }
      item.classList.add("active");
      this._highlighted = item.dataset.value;
      // aria-activedescendant works within the shadow root.
      (this.filterVisible() ? this.filterBox : this.button).setAttribute("aria-activedescendant", item.id);
      item.scrollIntoView({ block: "nearest" });
    }

    filterVisible() {
      const mode = this.getAttribute("filter");
      if (mode === "off" || mode === "false") return false;
      if (mode !== null && mode !== "auto") return true;
      return this.options.length >= 8;
    }

    // ---- open / close / choose -----------------------------------------------
    open() {
      if (this.disabled || this.hasAttribute("readonly") || this.isOpen) return;
      this._before = [...this._selected];
      this.filterBox.value = "";
      this.filterBox.hidden = !this.filterVisible();
      this.panel.showPopover();
      this.button.setAttribute("aria-expanded", "true");
      this._stopFollow = Viraspa.utility.dom.follow(this.panel, this.button, { placement: "bottom-start", matchWidth: true });
      this.renderList();
      if (!this.filterBox.hidden) this.filterBox.focus();
    }

    close({ revert = false } = {}) {
      if (revert && this._before) {
        this._selected = this._before;
        this.refresh();
      }
      if (this.isOpen) this.panel.hidePopover();
    }

    onClosed() {
      this.button.setAttribute("aria-expanded", "false");
      if (this._stopFollow) this._stopFollow();
      if (this.componentRoot.activeElement === this.filterBox || !this.componentRoot.activeElement) this.button.focus();
    }

    choose(value) {
      if (this.multiple) {
        this.toggleValue(value);
        return;
      }
      const changed = this._selected[0] !== value;
      this._selected = [value];
      this.close();
      if (changed) this.changed();
      else this.refresh();
    }

    toggleValue(value) {
      this._selected = this._selected.includes(value) ? this._selected.filter((v) => v !== value) : [...this._selected, value];
      this.changed();
    }

    changed() {
      this.refresh();
      this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }

    move(step) {
      const items = [...this.list.querySelectorAll('[role="option"]:not([aria-disabled="true"])')];
      if (!items.length) return;
      const current = items.findIndex((i) => i.dataset.value === this._highlighted);
      let next;
      if (step === "first") next = 0;
      else if (step === "last") next = items.length - 1;
      else next = Math.max(0, Math.min(items.length - 1, (current === -1 ? -1 : current) + step));
      this.highlight(items[next]);
    }

    onKey(event) {
      if (this.disabled) return;
      const keys = this.keymap({ open: ["alt+arrowdown", "enter", " "], close: ["escape", "alt+arrowup"], choose: "enter" });
      const inFilter = event.composedPath()[0] === this.filterBox;
      if (!this.isOpen) {
        if (this.hasAttribute("readonly")) return;
        if (Viraspa.keyboard.actionFor(event, { open: keys.open }) === "open" || event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          this.open();
        } else if (event.key.length === 1 && /\S/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
          this.typeAhead(event.key, true);
        }
        return;
      }
      const action = Viraspa.keyboard.actionFor(event, { close: keys.close, choose: keys.choose });
      if (action === "close") {
        event.preventDefault();
        this.close({ revert: !this.multiple });
        return;
      }
      if (action === "choose" || (event.key === " " && !inFilter)) {
        event.preventDefault();
        if (this._highlighted !== null) this.choose(this._highlighted);
        return;
      }
      const moves = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8, Home: "first", End: "last" };
      if (event.key in moves && !(inFilter && (event.key === "Home" || event.key === "End"))) {
        event.preventDefault();
        this.move(moves[event.key]);
      } else if (event.key === "Tab") {
        if (!this.multiple && this._highlighted !== null && this._highlighted !== this._selected[0]) this.choose(this._highlighted);
        this.close();
      } else if (!inFilter && event.key.length === 1 && /\S/.test(event.key) && !event.ctrlKey && !event.metaKey) {
        this.typeAhead(event.key, false);
      }
    }

    // Letters jump to the next option starting with what was typed.
    typeAhead(key, chooseNow) {
      clearTimeout(this._typeTimer);
      this._typed = (this._typed || "") + plain(key);
      this._typeTimer = setTimeout(() => (this._typed = ""), 700);
      const options = this.options.filter((o) => !o.disabled);
      const from = options.findIndex((o) => o.value === (chooseNow ? this._selected[0] : this._highlighted));
      const order = [...options.slice(from + 1), ...options.slice(0, from + 1)];
      const found = order.find((o) => plain(o.label).startsWith(this._typed)) || order.find((o) => plain(o.label).startsWith(this._typed[0]));
      if (!found) return;
      if (chooseNow && !this.multiple) {
        if (this._selected[0] !== found.value) {
          this._selected = [found.value];
          this.changed();
        }
      } else {
        const item = this.list.querySelector(`[data-value="${CSS.escape(found.value)}"]`);
        if (item) this.highlight(item);
      }
    }

    onFormReset() {
      this._selected = [...this._initial];
      this.refresh();
    }
    onFormDisabled() {
      this.refresh();
    }
    focus(options) {
      if (this.button) this.button.focus(options);
      else super.focus(options);
    }
  }

  Viraspa.core.defineComponent(VsSelect);
})(window.Viraspa);
