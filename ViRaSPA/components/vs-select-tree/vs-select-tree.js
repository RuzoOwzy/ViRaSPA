(function (Viraspa) {
  // A select whose choices are a tree (categories, accounts, locations).
  //
  //   <vs-select-tree name="category" placeholder="Choose a category" filter></vs-select-tree>
  //   <vs-select-tree name="accounts" multiple cascade></vs-select-tree>
  //   el.nodes = [{ id: 1, label: "Food", children: [{ id: 11, label: "Rice" }] }];   // or el.items = flat list
  //   el.load = async (node, { signal }) => children;                                  // children on demand
  //
  // - Single choice: picking a node closes the list. By default only nodes
  //   without sub-items (leaves) can be chosen; select-parents allows any.
  // - multiple: checkboxes (cascade: a branch at once); the chosen labels
  //   show as chips.
  // - filter: a filter box in the list. Field names as in vs-tree (id-field,
  //   parent-field, label-field).
  // - Keyboard: Enter/Space/Alt+Down opens; inside, the tree keys (arrows,
  //   Enter/Space choose); Escape closes. Works in forms (name, required,
  //   disabled, reset; with multiple, one form entry per id). Events: change, input.
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const esc = (s) => Viraspa.utility.dom.escapeHtml(s);

  class VsSelectTree extends Viraspa.core.Component {
    static tag = "vs-select-tree";
    static folder = "components/vs-select-tree";
    static isolation = "full";
    static hasModel = false;
    static formAssociated = true;
    static delegatesFocus = true;
    static observedAttributes = ["disabled", "readonly", "required", "placeholder", "multiple"];

    constructor() {
      super();
      this._nodes = null;
      this._items = null;
      this._value = [];
      this.load = null;
    }

    get multiple() {
      return this.hasAttribute("multiple");
    }
    set nodes(list) {
      this._nodes = list;
      this._items = null;
      this.feed();
    }
    get nodes() {
      return this.treeEl ? this.treeEl.nodes : this._nodes;
    }
    set items(list) {
      this._items = list;
      this._nodes = null;
      this.feed();
    }
    get value() {
      return this.multiple ? [...this._value] : this._value[0] ?? "";
    }
    set value(v) {
      this._value = [].concat(v === "" || v === null || v === undefined ? [] : v).map(String);
      if (this.treeEl) this.treeEl.value = this.multiple ? this._value : this._value[0] ?? "";
      this.refresh();
    }

    async afterLoad() {
      const root = this.componentRoot;
      this.control = root.querySelector(".control");
      this.text = root.querySelector(".text");
      this.panel = root.querySelector(".panel");
      this.panel.setAttribute("popover", "auto");
      this.treeEl = root.querySelector("vs-tree");
      await Viraspa.core.components.load("vs-tree");
      await this.treeEl.ready;
      this.treeEl.setAttribute("selectable", this.multiple ? "multiple" : "single");
      if (this.hasAttribute("cascade")) this.treeEl.setAttribute("cascade", "");
      if (this.hasAttribute("filter")) this.treeEl.setAttribute("filter", "");
      for (const a of ["id-field", "parent-field", "label-field"]) if (this.hasAttribute(a)) this.treeEl.setAttribute(a, this.getAttribute(a));
      this.treeEl.setAttribute("label", this.labelText() || t("Choices"));
      this.treeEl.load = (node, opts) => (typeof this.load === "function" ? this.load(node, opts) : []);
      this._initial = [...this._value];
      this.feed();
      this.listen(this.control, "click", () => (this.isOpen ? this.close() : this.open()));
      this.listen(this.control, "keydown", (e) => {
        if (this.disabled || this.hasAttribute("readonly")) return;
        if (e.key === "Enter" || e.key === " " || (e.key === "ArrowDown" && e.altKey) || e.key === "ArrowDown") {
          e.preventDefault();
          this.open();
        }
      });
      this.listen(this.panel, "keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          this.close();
        }
      });
      this.listen(this.treeEl, "vs-node-select", (e) => this.onPick(e.detail.node));
      this.listen(this.panel, "toggle", (e) => {
        if (e.newState === "closed") {
          this.control.setAttribute("aria-expanded", "false");
          if (this._stop) this._stop();
        }
      });
      this.refresh();
    }

    feed() {
      if (!this.treeEl || !this.treeEl.tree) return;
      if (this._items) this.treeEl.items = this._items;
      else if (this._nodes) this.treeEl.nodes = this._nodes;
      this.treeEl.value = this.multiple ? this._value : this._value[0] ?? "";
      this.refresh();
    }

    attributeChangedCallback() {
      if (this.control) this.refresh();
    }

    get disabled() {
      return this.hasAttribute("disabled") || this.hasAttribute("data-form-disabled");
    }
    get isOpen() {
      return Boolean(this.panel && this.panel.matches(":popover-open"));
    }

    labels() {
      return this._value.map((id) => (this.treeEl && this.treeEl.node(id) ? this.treeEl.node(id).label : id));
    }

    refresh() {
      if (!this.control) return;
      const labels = this.labels();
      if (this.multiple) {
        this.text.innerHTML = labels.length ? labels.map((l) => `<span class="chip" part="chip">${esc(l)}</span>`).join("") : esc(this.getAttribute("placeholder") || "");
      } else this.text.textContent = labels[0] || this.getAttribute("placeholder") || "";
      this.text.classList.toggle("placeholder", !labels.length);
      this.control.setAttribute("aria-label", `${this.labelText() || ""} ${labels.join(", ")}`.trim());
      this.control.setAttribute("aria-disabled", String(this.disabled));
      this.control.tabIndex = this.disabled ? -1 : 0;
      if (this.multiple) {
        const data = new FormData();
        for (const v of this._value) data.append(this.name || "value", v);
        this.setFormValue(this._value.length ? data : null);
      } else this.setFormValue(this._value[0] ?? "");
      if (this.hasAttribute("required") && !this._value.length) this.setValidity({ valueMissing: true }, t("Please choose an item."), this.control);
      else this.setValidity({});
    }

    open() {
      if (this.disabled || this.hasAttribute("readonly") || this.isOpen) return;
      this.panel.showPopover();
      this.control.setAttribute("aria-expanded", "true");
      this._stop = Viraspa.utility.dom.follow(this.panel, this.control, { placement: "bottom-start", matchWidth: true });
      const chosen = this._value[0] && this.treeEl.node(this._value[0]);
      // Open the branch of the chosen node so it can be seen.
      if (chosen) for (let p = this.treeEl.parent(chosen); p; p = this.treeEl.parent(p)) p.expanded = true;
      this.treeEl.draw();
      this.treeEl.focusNode(chosen || this.treeEl.nodes[0]);
    }

    close() {
      if (this.isOpen) this.panel.hidePopover();
      this.control.focus();
    }

    onPick(node) {
      if (!this.multiple) {
        if (this.treeEl.hasKids(node) && !this.hasAttribute("select-parents")) {
          this.treeEl.toggle(node, true); // a branch: open it instead
          this.treeEl.value = this._value[0] ?? "";
          return;
        }
        const changed = this._value[0] !== String(node.id);
        this._value = [String(node.id)];
        this.refresh();
        this.close();
        if (changed) this.emit();
        return;
      }
      this._value = [].concat(this.treeEl.value).map(String);
      this.refresh();
      this.emit();
    }

    emit() {
      this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }

    onFormReset() {
      this.value = this._initial;
    }
    onFormDisabled() {
      this.refresh();
    }
    focus(options) {
      if (this.control) this.control.focus(options);
      else super.focus(options);
    }
  }

  Viraspa.core.defineComponent(VsSelectTree);
})(window.Viraspa);
