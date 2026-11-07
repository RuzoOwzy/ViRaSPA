(function (Viraspa) {
  // Type to search, then choose: from a list, a table on the page, or the
  // server.
  //
  //   <vs-select-search name="customer" columns="name,phone" placeholder="Search customers…"></vs-select-search>
  //   el.source = async ({ text, limit, signal }) =>
  //     (await Viraspa.app.services.customers.search(text, { limit, signal })).items;   // [{ id, name, phone }]
  //
  //   el.items = [{ value: "R5", label: "Rice 5 kg", price: 18000 }, …];   // or a list in memory
  //   <vs-select-search table="#products" columns="0,1" value-column="0">   // or a table's rows
  //
  // - value-field / label-field: which fields hold the value and the text
  //   (defaults: value | id, label | name). columns: extra fields (or table
  //   column indexes) shown in each row of the list.
  // - min-chars (default 1), limit (default 20), debounce (ms, default 250):
  //   the server is asked only after typing pauses; outdated answers are ignored.
  // - free-text: the typed text is accepted as the value when nothing is chosen.
  // - Keyboard: Down opens/next, Up previous, Enter chooses, Escape closes
  //   (then clears the text), Tab chooses the highlighted row and moves on.
  //   Keys overridable: keys = { choose, close }.
  // - value: the chosen item's value ("" when none); `item`: the whole item.
  //   Works in forms. Events: "vs-select" (detail: { item }), change, input.
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const esc = (s) => Viraspa.utility.dom.escapeHtml(s);

  class VsSelectSearch extends Viraspa.core.Component {
    static tag = "vs-select-search";
    static folder = "components/vs-select-search";
    static isolation = "full";
    static hasModel = false;
    static formAssociated = true;
    static delegatesFocus = true;
    static observedAttributes = ["disabled", "readonly", "required", "placeholder"];

    constructor() {
      super();
      this._item = null;
      this._results = [];
      this._source = null;
    }

    field(item, which) {
      const name = this.getAttribute(`${which}-field`);
      if (name) return item[name];
      return which === "value" ? item.value ?? item.id ?? item.label : item.label ?? item.name ?? item.value;
    }

    // The search function: yours, or one over `items` / a table.
    set source(fn) {
      this._handler = fn;
      this._source = null;
    }
    get source() {
      return this._handler;
    }
    set items(list) {
      this._items = list || [];
      this._source = null;
    }
    get items() {
      return this._items;
    }

    handler() {
      if (this._handler) return this._handler;
      let rows = this._items;
      const tableSelector = this.getAttribute("table");
      if (!rows && tableSelector) {
        const table = this.getRootNode().querySelector(tableSelector);
        const valueColumn = Number(this.getAttribute("value-column") || 0);
        const labelColumn = Number(this.getAttribute("label-column") || (this.columns()[0] ?? 0));
        rows = () =>
          [...(table ? table.tBodies[0] || table : []).rows || []].map((row) => {
            const cells = [...row.cells].map((c) => c.textContent.trim());
            return { value: cells[valueColumn], label: cells[labelColumn], cells };
          });
      }
      const local = Viraspa.data.localSource(rows || [], { searchFields: null });
      return async ({ text, limit }) => (await local({ search: text, page: 1, pageSize: limit })).rows;
    }

    columns() {
      return (this.getAttribute("columns") || "").split(",").map((s) => s.trim()).filter(Boolean);
    }

    get value() {
      if (this._item) return String(this.field(this._item, "value") ?? "");
      return this.hasAttribute("free-text") && this.input ? this.input.value : "";
    }
    set value(v) {
      // A value without its item: shown as typed text until an item is chosen.
      this._item = v === null || v === undefined || v === "" ? null : { value: v, label: v };
      if (this.input) this.input.value = this._item ? String(this.field(this._item, "label")) : "";
      this.refresh();
    }
    get item() {
      return this._item;
    }
    set item(item) {
      this._item = item || null;
      if (this.input) this.input.value = item ? String(this.field(item, "label") ?? "") : "";
      this.refresh();
    }

    async afterLoad() {
      const root = this.componentRoot;
      this.input = root.querySelector("input");
      this.panel = root.querySelector(".panel");
      this.list = root.querySelector('[role="listbox"]');
      this.status = root.querySelector(".status");
      this.list.id = Viraspa.utility.dom.uid("vs-search-list");
      this.input.setAttribute("aria-controls", this.list.id);
      this.panel.setAttribute("popover", "manual");
      if (this._item) this.input.value = String(this.field(this._item, "label") ?? "");
      this._initialItem = this._item;

      this.listen(this.input, "input", () => {
        this._item = null;
        this.refresh();
        this.search({ debounce: true });
        this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      });
      this.listen(this.input, "keydown", (e) => this.onKey(e));
      this.listen(this.input, "blur", () => setTimeout(() => this.onBlur(), 120));
      this.listen(this.list, "pointerdown", (e) => e.preventDefault()); // keep focus in the field
      this.listen(this.list, "click", (e) => {
        const row = e.target.closest('[role="option"]');
        if (row) this.choose(Number(row.dataset.index));
      });
      this.listen(this.status, "click", (e) => {
        if (e.target.closest(".retry")) this.search();
      });
      this.refresh();
    }

    attributeChangedCallback() {
      if (this.input) this.refresh();
    }

    get disabled() {
      return this.hasAttribute("disabled") || this.hasAttribute("data-form-disabled");
    }
    get isOpen() {
      return Boolean(this.panel && this.panel.matches(":popover-open"));
    }

    refresh() {
      const i = this.input;
      i.placeholder = this.getAttribute("placeholder") || "";
      i.disabled = this.disabled;
      i.readOnly = this.hasAttribute("readonly");
      const label = this.labelText();
      if (label) i.setAttribute("aria-label", label);
      this.setFormValue(this.value);
      if (this.hasAttribute("required") && !this.value) this.setValidity({ valueMissing: true }, t("Please choose an item."), i);
      else if (!this._item && i.value && !this.hasAttribute("free-text")) this.setValidity({ customError: true }, t("Choose an item from the list."), i);
      else this.setValidity({});
    }

    // ---- searching -----------------------------------------------------------
    search({ debounce = false } = {}) {
      const text = this.input.value.trim();
      const min = Number(this.getAttribute("min-chars") ?? 1);
      if (text.length < min) {
        this.close();
        return;
      }
      if (!this._source) {
        this._source = Viraspa.data.createSource(async (req) => this.handler()(req), { debounce: Number(this.getAttribute("debounce") || 250), onError: () => {} });
      }
      this.open();
      this.showStatus(t("Searching…"), "loading");
      this._source.load({ text, limit: Number(this.getAttribute("limit") || 20) }, { debounce }).then(() => {
        if (this.input.value.trim() !== text) return; // the user typed on
        if (this._source.error.peek()) {
          this.showStatus(`${esc(t("The search failed."))} <button type="button" class="retry">${esc(t("Try again"))}</button>`, "error", true);
          return;
        }
        const answer = this._source.result.peek();
        this._results = answer ? answer.rows : [];
        this.renderList();
      });
    }

    showStatus(text, kind, html = false) {
      this.list.innerHTML = "";
      this.status.hidden = false;
      this.status.dataset.kind = kind;
      if (html) this.status.innerHTML = text;
      else this.status.textContent = text;
    }

    renderList() {
      const cols = this.columns();
      if (!this._results.length) {
        this.showStatus(this.hasAttribute("free-text") ? t("No match - the text you typed will be used.") : t("No match"), "empty");
        return;
      }
      this.status.hidden = true;
      this.list.innerHTML = this._results
        .map((item, index) => {
          const extra = cols
            .map((c) => (/^\d+$/.test(c) && item.cells ? item.cells[Number(c)] : item[c]))
            .filter((v) => v !== undefined && v !== null && String(v) !== String(this.field(item, "label")))
            .map((v) => `<span class="col">${esc(v)}</span>`)
            .join("");
          return `<div role="option" class="option" part="option" id="${this.list.id}-${index}" data-index="${index}" aria-selected="false"><span class="label">${esc(this.field(item, "label") ?? "")}</span>${extra}</div>`;
        })
        .join("");
      this.highlight(0);
    }

    highlight(index) {
      const rows = [...this.list.querySelectorAll('[role="option"]')];
      rows.forEach((r, i) => {
        r.classList.toggle("active", i === index);
        r.setAttribute("aria-selected", String(i === index));
      });
      this._highlighted = rows[index] ? index : -1;
      if (rows[index]) {
        this.input.setAttribute("aria-activedescendant", rows[index].id);
        rows[index].scrollIntoView({ block: "nearest" });
      } else this.input.removeAttribute("aria-activedescendant");
    }

    open() {
      if (this.isOpen || this.disabled || this.hasAttribute("readonly")) return;
      this.panel.showPopover();
      this.input.setAttribute("aria-expanded", "true");
      this._stopFollow = Viraspa.utility.dom.follow(this.panel, this.input, { placement: "bottom-start", matchWidth: true });
    }

    close() {
      if (!this.isOpen) return;
      this.panel.hidePopover();
      this.input.setAttribute("aria-expanded", "false");
      if (this._stopFollow) this._stopFollow();
      if (this._source) this._source.cancel();
    }

    choose(index) {
      const item = this._results[index];
      if (!item) return;
      this._item = item;
      this.input.value = String(this.field(item, "label") ?? "");
      this.close();
      this.refresh();
      this.dispatchEvent(new CustomEvent("vs-select", { detail: { item }, bubbles: true, composed: true }));
      this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }

    onBlur() {
      if (this.componentRoot.activeElement === this.input) return;
      this.close();
      this.refresh();
    }

    onKey(event) {
      if (this.disabled || this.hasAttribute("readonly")) return;
      const action = Viraspa.keyboard.actionFor(event, this.keymap({ choose: "enter", close: "escape" }));
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!this.isOpen) {
          if (this.input.value.trim()) this.search();
          return;
        }
        const count = this.list.querySelectorAll('[role="option"]').length;
        if (!count) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        this.highlight(Math.max(0, Math.min(count - 1, this._highlighted + step)));
      } else if (action === "choose" && this.isOpen && this._highlighted >= 0) {
        event.preventDefault();
        this.choose(this._highlighted);
      } else if (action === "close") {
        if (this.isOpen) {
          event.preventDefault();
          this.close();
        } else if (this.input.value) {
          event.preventDefault();
          this.input.value = "";
          this._item = null;
          this.refresh();
        }
      } else if (event.key === "Tab" && this.isOpen && this._highlighted >= 0 && !this._item) {
        this.choose(this._highlighted);
      }
    }

    onFormReset() {
      this.item = this._initialItem;
    }
    onFormDisabled() {
      this.refresh();
    }
    focus(options) {
      if (this.input) this.input.focus(options);
      else super.focus(options);
    }
  }

  Viraspa.core.defineComponent(VsSelectSearch);
})(window.Viraspa);
