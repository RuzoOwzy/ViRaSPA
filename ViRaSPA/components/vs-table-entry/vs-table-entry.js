(function (Viraspa) {
  // A table for typing rows quickly - sales lines, stock counts, journal
  // entries - with the keyboard only.
  //
  //   <vs-table-entry name="lines" add-button delete-button>
  //     <column field="product" label="Product" editor="text" required></column>
  //     <column field="quantity" label="Qty" editor="number" min="1" width="90" total="sum"></column>
  //     <column field="price" label="Price" editor="number" decimals="2" format="currency:'TZS'" width="130"></column>
  //     <column field="vat" label="VAT" editor="select" options="0,18" width="90"></column>
  //   </vs-table-entry>
  //   lines.columns[…].value = (row) => row.quantity * row.price;   // computed columns (read-only)
  //   lines.rows = [{ product: "Rice 5 kg", quantity: 2, price: 18000 }];
  //   lines.newRow = () => ({ quantity: 1, vat: "18" });
  //
  // Keys (each can be moved or switched off: keys = { … }, or app-wide
  // Viraspa.keyboard.configure({ components: { "vs-table-entry": { … } } })):
  //   next (Enter)            next cell; on the last cell of the last row, a new row
  //                           (add-row-on-enter="off" or keys = { addRow: false } stops that)
  //   previous (Shift+Enter)  previous cell
  //   up / down (Alt+Up / Alt+Down)   the same column in the row above / below
  //   deleteRow (Ctrl+Delete) removes the row (asks first with confirm-delete)
  // Editors: text (default), number (decimals, min, max), select (options:
  // "a,b" or [{ value, label }]), date, check; editor="none" or a computed
  // `value` column is read-only.
  // value: the rows; in a form, a JSON text under `name`. Validity: required
  // cells and number limits. Events: "vs-cell-change" (detail: { row, field,
  // value, index }), "vs-row-add", "vs-row-remove" (cancelable), input, change.
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const esc = (s) => Viraspa.utility.dom.escapeHtml(s);
  const KEYS = { next: "enter", previous: "shift+enter", up: "alt+arrowup", down: "alt+arrowdown", deleteRow: "ctrl+delete", addRow: "enter" };

  class VsTableEntry extends Viraspa.core.Component {
    static tag = "vs-table-entry";
    static folder = "components/vs-table-entry";
    static isolation = "full";
    static hasModel = false;
    static formAssociated = true;
    static delegatesFocus = true;
    static observedAttributes = ["disabled", "readonly", "add-button", "delete-button"];

    constructor() {
      super();
      this._rows = [];
      this._columns = null;
      this.newRow = null;
    }

    get rows() {
      return this._rows;
    }
    set rows(list) {
      this._rows = Array.isArray(list) ? list : [];
      if (!this.cols) return; // shown once the component has loaded
      this.renderBody();
      this.changed(false);
    }
    get value() {
      return this._rows;
    }
    set value(list) {
      this.rows = list;
    }
    get columns() {
      return this.cols;
    }
    set columns(list) {
      this._columns = list;
      if (this.body) this.prepare();
    }

    async afterLoad() {
      const root = this.componentRoot;
      this.core = Viraspa.tableCore;
      this.table = root.querySelector("table");
      this.head = root.querySelector("thead");
      this.body = root.querySelector("tbody");
      this.foot = root.querySelector("tfoot");
      this.colgroup = root.querySelector("colgroup");
      this.addButton = root.querySelector(".add");
      this.addButton.textContent = t("Add row");
      this.table.setAttribute("aria-label", this.getAttribute("label") || this.labelText() || t("Entry table"));
      this._initial = JSON.stringify(this._rows);
      this.listen(this.body, "keydown", (e) => this.onKey(e));
      this.listen(this.body, "input", (e) => this.onEdit(e, false));
      this.listen(this.body, "change", (e) => this.onEdit(e, true));
      this.listen(this.body, "focusout", (e) => this.onBlur(e));
      this.listen(this.body, "focusin", (e) => this.onFocus(e));
      this.listen(this.body, "click", (e) => {
        const del = e.target.closest(".delete");
        if (del) this.removeRow(Number(del.closest("tr").dataset.index), { focus: true });
      });
      this.listen(this.addButton, "click", () => this.addRow({ focus: true }));
      this.prepare();
    }

    attributeChangedCallback() {
      if (this.body) this.prepare();
    }

    get readOnly() {
      return this.hasAttribute("readonly") || this.hasAttribute("disabled") || this.hasAttribute("data-form-disabled");
    }

    prepare() {
      this.cols = this.core.normalize(this._columns || this.core.columnsFromChildren(this)).map((c) => ({ ...c, editor: typeof c.value === "function" ? "none" : c.editor || "text" }));
      this.addButton.hidden = !this.hasAttribute("add-button") || this.readOnly;
      const withDelete = this.hasAttribute("delete-button") && !this.readOnly;
      this.colgroup.innerHTML = '<col class="num-col">' + this.cols.map(() => "<col>").join("") + (withDelete ? '<col class="del-col">' : "");
      const colEls = [...this.colgroup.children].slice(1);
      this.cols.forEach((c, i) => {
        if (c.width) colEls[i].style.width = /^\d+$/.test(String(c.width)) ? `${c.width}px` : c.width;
      });
      this.head.innerHTML = `<tr><th scope="col" class="num">#</th>${this.cols
        .map((c) => `<th scope="col" class="align-${c.align}">${esc(t(c.label))}${c.required ? '<span class="req" aria-hidden="true">*</span>' : ""}</th>`)
        .join("")}${withDelete ? `<th scope="col"><span class="vs-hidden">${esc(t("Remove"))}</span></th>` : ""}</tr>`;
      if (!this._rows.length && !this.readOnly && this.getAttribute("start-empty") !== "true") this._rows.push(this.blankRow());
      this.renderBody();
      this.changed(false);
    }

    blankRow() {
      return typeof this.newRow === "function" ? this.newRow() : {};
    }

    options(col) {
      const list = typeof col.options === "string" ? col.options.split(",").map((s) => s.trim()) : col.options || [];
      return list.map((o) => (typeof o === "object" ? { value: String(o.value), label: String(o.label ?? o.value) } : { value: String(o), label: String(o) }));
    }

    // The text shown in a number field when not editing.
    numberText(v, col) {
      if (v === null || v === undefined || v === "") return "";
      const d = Number(col.decimals || 0);
      return new Intl.NumberFormat(Viraspa.i18n ? Viraspa.i18n.locale.peek() : undefined, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
    }

    editorHtml(row, col, r, c) {
      const value = this.core.read(row, col);
      const label = esc(`${t(col.label)} ${t("row {n}").replace("{n}", r + 1)}`);
      const common = `data-r="${r}" data-c="${c}" aria-label="${label}"${this.readOnly ? " disabled" : ""}${col.required ? ' aria-required="true"' : ""}`;
      switch (col.editor) {
        case "none":
          return `<div class="cell ro" ${common.replace(" disabled", "")} tabindex="-1">${esc(this.core.format(value, col, row))}</div>`;
        case "number":
          return `<input class="edit num-edit" inputmode="${Number(col.decimals || 0) ? "decimal" : "numeric"}" autocomplete="off" value="${esc(this.numberText(value, col))}" ${common}>`;
        case "select":
          return `<select class="edit" ${common}><option value=""></option>${this.options(col)
            .map((o) => `<option value="${esc(o.value)}"${String(value ?? "") === o.value ? " selected" : ""}>${esc(o.label)}</option>`)
            .join("")}</select>`;
        case "date":
          return `<input class="edit" type="date" value="${esc(value || "")}" ${common}>`;
        case "check":
          return `<input class="edit" type="checkbox"${value ? " checked" : ""} ${common}>`;
        default:
          return `<input class="edit" type="text" autocomplete="off" value="${esc(value ?? "")}" ${common}>`;
      }
    }

    renderBody() {
      const withDelete = this.hasAttribute("delete-button") && !this.readOnly;
      this.body.innerHTML = this._rows
        .map(
          (row, r) =>
            `<tr data-index="${r}" part="row"><td class="num" part="number">${r + 1}</td>${this.cols
              .map((col, c) => `<td class="align-${col.align}" part="cell">${this.editorHtml(row, col, r, c)}</td>`)
              .join("")}${withDelete ? `<td class="del"><button type="button" class="delete" tabindex="-1" aria-label="${esc(t("Remove row {n}").replace("{n}", r + 1))}">&times;</button></td>` : ""}</tr>`
        )
        .join("");
      this.renderFoot();
      this.validate();
    }

    renderFoot() {
      if (!this.cols.some((c) => c.total)) {
        this.foot.innerHTML = "";
        return;
      }
      const withDelete = this.hasAttribute("delete-button") && !this.readOnly;
      this.foot.innerHTML = `<tr><td class="num"></td>${this.cols
        .map((c, i) => {
          const v = c.total ? this.core.total(this._rows, c) : null;
          const text = v === null ? (i === 0 ? t("Total") : "") : c.total === "count" ? v : c.format ? this.core.format(v, c, {}) : this.numberText(v, c);
          return `<td class="align-${c.align}"><div class="cell">${esc(text)}</div></td>`;
        })
        .join("")}${withDelete ? "<td></td>" : ""}</tr>`;
    }

    // Recomputes the read-only (computed) cells and totals of one row.
    refreshRow(r) {
      const tr = this.body.rows[r];
      if (!tr) return;
      this.cols.forEach((col, c) => {
        if (col.editor !== "none") return;
        const cell = tr.querySelector(`.ro[data-c="${c}"]`);
        if (cell) cell.textContent = this.core.format(this.core.read(this._rows[r], col), col, this._rows[r]);
      });
      this.renderFoot();
    }

    // The same rules as vs-input-number: both "." and "," -> the last is the
    // decimal point; one kind repeated -> grouping; one mark once -> the
    // locale's separator is decimal, the other too when at most `decimals`
    // digits follow it.
    parseNumber(text, col) {
      let s = String(text).replace(/[^0-9.,-]/g, "");
      if (!s || s === "-") return null;
      const sep = (new Intl.NumberFormat(Viraspa.i18n ? Viraspa.i18n.locale.peek() : undefined).formatToParts(1.5).find((p) => p.type === "decimal") || { value: "." }).value;
      const decimals = Number(col.decimals || 0);
      const negative = s.startsWith("-");
      s = s.replace(/-/g, "");
      const dots = (s.match(/\./g) || []).length;
      const commas = (s.match(/,/g) || []).length;
      let point = -1;
      if (dots && commas) point = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
      else if (dots + commas === 1) {
        const at = s.search(/[.,]/);
        if (s[at] === sep || (decimals > 0 && s.length - at - 1 <= decimals)) point = at;
      }
      const whole = (point === -1 ? s : s.slice(0, point)).replace(/[.,]/g, "");
      const fraction = point === -1 ? "" : s.slice(point + 1).replace(/[.,]/g, "");
      const n = Number(`${negative ? "-" : ""}${whole || "0"}${fraction ? `.${fraction}` : ""}`);
      return Number.isFinite(n) ? n : NaN;
    }
    onEdit(event, committed) {
      const el = event.target.closest(".edit");
      if (!el) return;
      const r = Number(el.dataset.r);
      const col = this.cols[Number(el.dataset.c)];
      const row = this._rows[r];
      if (!row || !col || !col.field) return;
      let value;
      if (col.editor === "check") value = el.checked;
      else if (col.editor === "number") {
        value = this.parseNumber(el.value, col);
        if (Number.isNaN(value)) {
          el.setAttribute("aria-invalid", "true");
          return;
        }
      } else value = el.value;
      setPath(row, col.field, value);
      this.refreshRow(r);
      this.validate();
      this.dispatchEvent(new CustomEvent("vs-cell-change", { detail: { row, field: col.field, value, index: r }, bubbles: true, composed: true }));
      this.changed(committed);
    }

    onFocus(event) {
      const el = event.target.closest(".num-edit");
      if (!el) return;
      const col = this.cols[Number(el.dataset.c)];
      const v = this.core.read(this._rows[Number(el.dataset.r)], col);
      el.value = v === null || v === undefined ? "" : String(v);
      el.select();
    }

    onBlur(event) {
      const el = event.target.closest(".num-edit");
      if (!el) return;
      const col = this.cols[Number(el.dataset.c)];
      const v = this.core.read(this._rows[Number(el.dataset.r)], col);
      if (el.getAttribute("aria-invalid") !== "true") el.value = this.numberText(v, col);
    }

    // ---- keyboard ---------------------------------------------------------------
    cellAt(r, c) {
      return this.body.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    }
    editable(c) {
      return this.cols[c] && this.cols[c].editor !== "none" && !this.cols[c].readonly;
    }

    focusCell(r, c) {
      const el = this.cellAt(r, c);
      if (el) el.focus();
      return Boolean(el);
    }

    // The next (or previous) editable cell, row by row.
    step(r, c, dir) {
      let row = r;
      let col = c;
      for (;;) {
        col += dir;
        if (col >= this.cols.length) {
          col = 0;
          row++;
        } else if (col < 0) {
          col = this.cols.length - 1;
          row--;
        }
        if (row < 0 || row >= this._rows.length) return null;
        if (this.editable(col)) return { r: row, c: col };
      }
    }

    onKey(event) {
      const el = event.target.closest("[data-r]");
      if (!el || event.defaultPrevented) return;
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      const keys = this.keymap(KEYS);
      if (this.getAttribute("add-row-on-enter") === "off") keys.addRow = false;
      const action = Viraspa.keyboard.actionFor(event, { next: keys.next, previous: keys.previous, up: keys.up, down: keys.down, deleteRow: keys.deleteRow });
      if (!action) return;
      // A select keeps Enter while its own list is open (some browsers).
      event.preventDefault();
      if (action === "next") {
        el.dispatchEvent(new Event("change", { bubbles: true }));
        const next = this.step(r, c, 1);
        if (next) this.focusCell(next.r, next.c);
        else if (keys.addRow !== false && Viraspa.keyboard.matches(event, [].concat(keys.addRow)[0] || "enter") && !this.readOnly) this.addRow({ focus: true, after: r });
        else this.dispatchEvent(new CustomEvent("vs-entry-end", { bubbles: true, composed: true }));
      } else if (action === "previous") {
        const prev = this.step(r, c, -1);
        if (prev) this.focusCell(prev.r, prev.c);
      } else if (action === "up") this.focusCell(r - 1, c);
      else if (action === "down") this.focusCell(r + 1, c);
      else if (action === "deleteRow") this.removeRow(r, { focus: true });
    }

    // ---- rows -------------------------------------------------------------------
    addRow({ focus = false, after = this._rows.length - 1, row } = {}) {
      const fresh = row || this.blankRow();
      const index = after + 1;
      this._rows.splice(index, 0, fresh);
      this.renderBody();
      this.dispatchEvent(new CustomEvent("vs-row-add", { detail: { row: fresh, index }, bubbles: true, composed: true }));
      this.changed(true);
      if (focus) {
        const first = this.cols.findIndex((c, i) => this.editable(i));
        this.focusCell(index, Math.max(0, first));
      }
      return fresh;
    }

    async removeRow(index, { focus = false } = {}) {
      const row = this._rows[index];
      if (!row || this.readOnly) return;
      if (this.hasAttribute("confirm-delete") && Viraspa.popup) {
        if (!(await Viraspa.popup.confirm(t("Remove row {n}?").replace("{n}", index + 1), { okLabel: "Remove", danger: true }))) return;
      }
      const event = new CustomEvent("vs-row-remove", { detail: { row, index }, bubbles: true, composed: true, cancelable: true });
      if (!this.dispatchEvent(event)) return;
      this._rows.splice(index, 1);
      if (!this._rows.length && this.getAttribute("start-empty") !== "true") this._rows.push(this.blankRow());
      this.renderBody();
      this.changed(true);
      if (focus) {
        const first = this.cols.findIndex((c, i) => this.editable(i));
        this.focusCell(Math.min(index, this._rows.length - 1), Math.max(0, first));
      }
    }

    // ---- value and validity ----------------------------------------------------------
    // Rows where every editable cell is empty don't count (the blank last row).
    filledRows() {
      return this._rows.filter((row) => this.cols.some((c) => c.editor !== "none" && c.field && !isEmpty(this.core.read(row, c))));
    }

    validate() {
      let message = "";
      let anchor = null;
      const rows = this.filledRows();
      for (const [r, row] of this._rows.entries()) {
        if (!rows.includes(row)) continue;
        this.cols.forEach((col, c) => {
          const el = this.cellAt(r, c);
          const v = this.core.read(row, col);
          let problem = "";
          if (col.required && isEmpty(v)) problem = t("{column} is required").replace("{column}", t(col.label));
          else if (col.editor === "number" && !isEmpty(v)) {
            if (col.min !== undefined && Number(v) < Number(col.min)) problem = t("{column} must be {min} or more").replace("{column}", t(col.label)).replace("{min}", col.min);
            if (col.max !== undefined && Number(v) > Number(col.max)) problem = t("{column} must be {max} or less").replace("{column}", t(col.label)).replace("{max}", col.max);
          }
          if (el && el.matches(".edit")) el.toggleAttribute("aria-invalid", Boolean(problem));
          if (problem && !message) {
            message = `${t("Row {n}").replace("{n}", r + 1)}: ${problem}`;
            anchor = el;
          }
        });
      }
      if (this.hasAttribute("required") && !rows.length) message = message || t("Add at least one row.");
      if (message) this.setValidity({ customError: true }, message, anchor || this.addButton);
      else this.setValidity({});
      return !message;
    }

    changed(commit) {
      this.setFormValue(JSON.stringify(this.filledRows()));
      this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      if (commit) this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }

    onFormReset() {
      this._rows = JSON.parse(this._initial || "[]");
      this.prepare();
    }
    onFormDisabled() {
      this.prepare();
    }
  }

  function isEmpty(v) {
    return v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v));
  }

  // row["a.b"] = v for nested fields.
  function setPath(obj, path, value) {
    const parts = String(path).split(".");
    let target = obj;
    while (parts.length > 1) {
      const p = parts.shift();
      if (typeof target[p] !== "object" || target[p] === null) target[p] = {};
      target = target[p];
    }
    target[parts[0]] = value;
  }

  Viraspa.core.defineComponent(VsTableEntry);
})(window.Viraspa);
