(function (Viraspa) {
  // A data table for lists of records: sorting, searching, filtering, paging
  // (in the browser or on the server), selection, row actions, column
  // choice and widths, CSV export, totals, keyboard navigation, phone layouts.
  //
  //   <vs-table key-field="id" page-size="20" search selectable="multiple" export remember="orders">
  //     <column field="number" label="Invoice" width="110"></column>
  //     <column field="customer.name" label="Customer" filterable></column>
  //     <column field="date" label="Date" format="date:'short'" width="120"></column>
  //     <column field="amount" label="Amount" format="currency:'TZS'" total="sum"></column>
  //   </vs-table>
  //   table.rows = orders;                                   // data in the browser, or:
  //   table.source = async ({ page, pageSize, search, sort, filters, signal }) => ({ rows, total });
  //
  // Every cell is <td><div class="cell">…</div></td>, so widths, truncation
  // (full text on hover) and alignment are controlled per column. See README
  // for every attribute, column option, event, key and part.
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const esc = (s) => Viraspa.utility.dom.escapeHtml(s);
  const KEYS = { open: "enter", select: "space", nextPage: "pagedown", previousPage: "pageup" };

  class VsTable extends Viraspa.core.Component {
    static tag = "vs-table";
    static folder = "components/vs-table";
    static isolation = "full";
    static hasModel = false;
    static observedAttributes = ["page-size", "search", "selectable", "export", "height", "phone-layout", "search-scope"];

    constructor() {
      super();
      this._rows = null;
      this._handler = null;
      this._columns = null;
      this.state = { page: 1, sort: [], search: "", filters: {}, hidden: new Set(), widths: {} };
      this._selected = new Map(); // key -> row
      this._shown = []; // rows on screen
      this._total = 0;
      this._focus = { r: 0, c: 0 };
    }

    // ---- data -------------------------------------------------------------
    get rows() {
      return this._rows;
    }
    set rows(list) {
      this._rows = Array.isArray(list) ? list : [];
      this._handler = null;
      this.reload({ keepPage: true });
    }
    get source() {
      return this._handler;
    }
    set source(fn) {
      this._handler = typeof fn === "function" ? fn : null;
      this._dataSource = null;
      this.reload();
    }
    get columns() {
      return this._columns;
    }
    set columns(list) {
      this._columns = list;
      if (this.tableEl) {
        this.prepareColumns();
        this.reload({ keepPage: true });
      }
    }
    get keyField() {
      return this.getAttribute("key-field") || "id";
    }
    get pageSize() {
      const v = this.getAttribute("page-size");
      return v === null ? 0 : Math.max(0, Number(v) || 0);
    }
    get page() {
      return this.state.page;
    }
    set page(n) {
      this.state.page = Math.max(1, n);
      this.reload({ keepPage: true });
    }
    get selectedRows() {
      return [...this._selected.values()];
    }
    get selection() {
      return [...this._selected.keys()];
    }
    set selection(keys) {
      const wanted = new Set([].concat(keys || []).map(String));
      this._selected = new Map((this._rows || this._shown).filter((r) => wanted.has(String(this.keyOf(r)))).map((r) => [String(this.keyOf(r)), r]));
      this.renderBody();
    }
    keyOf(row) {
      return Viraspa.data.read(row, this.keyField);
    }
    get serverMode() {
      return Boolean(this._handler);
    }

    // ---- set-up -------------------------------------------------------------
    async afterLoad() {
      const root = this.componentRoot;
      this.core = Viraspa.tableCore;
      this.tableEl = root.querySelector("table");
      this.head = root.querySelector("thead");
      this.body = root.querySelector("tbody");
      this.foot = root.querySelector("tfoot");
      this.colgroup = root.querySelector("colgroup");
      this.stateBox = root.querySelector(".state");
      this.searchBox = root.querySelector(".search");
      this.scopeBox = root.querySelector(".scope");
      this.pager = root.querySelector("vs-pagination");
      this.scroller = root.querySelector(".scroll");
      this.searchBox.placeholder = t("Search…");
      this.searchBox.setAttribute("aria-label", t("Search the list"));
      root.querySelector(".columns-button").textContent = t("Columns");
      root.querySelector(".export-button").textContent = t("Export");
      this.scopeBox.setAttribute("aria-label", t("Where to search"));
      this.scopeBox.innerHTML = `<option value="loaded">${esc(t("In this list"))}</option><option value="all">${esc(t("All records"))}</option>`;
      this.restore();
      this.prepareColumns();

      this.listen(this.searchBox, "input", () => {
        this.state.search = this.searchBox.value;
        this.state.page = 1;
        this.reload({ debounce: true });
      });
      this.listen(this.scopeBox, "change", () => this.reload());
      this.listen(this.head, "click", (e) => this.onHeadClick(e));
      this.listen(this.head, "input", (e) => {
        const box = e.target.closest("[data-filter]");
        if (!box) return;
        this.state.filters[box.dataset.filter] = box.value;
        this.state.page = 1;
        this.reload({ debounce: true });
      });
      this.listen(this.head, "keydown", (e) => this.onHeadKey(e));
      this.listen(this.head, "pointerdown", (e) => this.onResizeStart(e));
      this.listen(this.body, "click", (e) => this.onBodyClick(e));
      this.listen(this.body, "dblclick", (e) => {
        const tr = e.target.closest("tr[data-index]");
        if (tr) this.open(Number(tr.dataset.index));
      });
      this.listen(this.body, "keydown", (e) => this.onBodyKey(e));
      this.listen(this.body, "pointerover", (e) => this.showFullText(e));
      this.listen(this.body, "focusin", (e) => this.showFullText(e));
      this.listen(this.body, "contextmenu", (e) => this.onRowMenu(e));
      this.listen(this.pager, "vs-page-change", (e) => {
        this.state.page = e.detail.page;
        if (e.detail.pageSize !== this.pageSize) this.setAttribute("page-size", String(e.detail.pageSize));
        this.save();
        this.reload({ keepPage: true });
      });
      this.listen(root.querySelector(".columns-button"), "click", () => this.showColumnChooser());
      this.listen(root.querySelector(".export-button"), "click", () => this.exportCsv());
      this.listen(root.querySelector(".state"), "click", (e) => {
        if (e.target.closest(".retry")) this.reload();
      });
      this._observer = new MutationObserver(() => {
        if (!this._columns) {
          this.prepareColumns();
          this.reload({ keepPage: true });
        }
      });
      this._observer.observe(this, { childList: true });
      this._scope.add(() => this._observer.disconnect());
      this.syncAttributes();
      this.reload({ keepPage: true });
    }

    attributeChangedCallback(name) {
      if (!this.tableEl) return;
      this.syncAttributes();
      if (name === "page-size" || name === "search-scope") this.reload({ keepPage: name !== "page-size" });
      else this.renderAll();
    }

    syncAttributes() {
      const root = this.componentRoot;
      this.searchBox.hidden = !this.hasAttribute("search");
      this.scopeBox.hidden = !(this.hasAttribute("search") && this.serverMode && this.getAttribute("search-scope") === "choose");
      root.querySelector(".export-button").hidden = !this.hasAttribute("export");
      root.querySelector(".columns-button").hidden = !this.hasAttribute("column-chooser");
      root.querySelector(".toolbar").hidden = this.searchBox.hidden && root.querySelector(".export-button").hidden && root.querySelector(".columns-button").hidden && !this.querySelector('[slot="toolbar"]');
      if (this.getAttribute("height")) this.scroller.style.maxHeight = this.getAttribute("height");
      else this.scroller.style.removeProperty("max-height");
      this.tableEl.setAttribute("aria-label", this.getAttribute("label") || t("Table"));
    }

    prepareColumns() {
      const list = this._columns || this.core.columnsFromChildren(this);
      this.cols = this.core.normalize(list);
      for (const c of this.cols) if (this.state.hidden.has(c.key)) c.hidden = true;
      this.renderAll();
    }

    // ---- remembered settings --------------------------------------------------
    storageKey() {
      return this.getAttribute("remember") ? `vs-table:${this.getAttribute("remember")}` : null;
    }
    restore() {
      const key = this.storageKey();
      if (!key) return;
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "null");
        if (!saved) return;
        this.state.hidden = new Set(saved.hidden || []);
        this.state.widths = saved.widths || {};
        this.state.sort = saved.sort || [];
        if (saved.pageSize) this.setAttribute("page-size", String(saved.pageSize));
      } catch {
        // storage not available
      }
    }
    save() {
      const key = this.storageKey();
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify({ hidden: [...this.state.hidden], widths: this.state.widths, sort: this.state.sort, pageSize: this.pageSize || undefined }));
      } catch {
        // storage not available
      }
    }

    // ---- loading --------------------------------------------------------------
    // Where searching happens: "local" (in the browser) or "server".
    searchWhere() {
      if (!this.serverMode) return "local";
      const scope = this.getAttribute("search-scope") || "auto";
      if (scope === "loaded") return "loaded";
      if (scope === "choose") return this.scopeBox.value === "loaded" ? "loaded" : "server";
      if (scope === "all") return "server";
      return "server"; // auto: the server has all records
    }

    async reload({ debounce = false, keepPage = false } = {}) {
      if (!this.tableEl) return;
      if (!keepPage) this.state.page = Math.max(1, this.state.page);
      const size = this.pageSize;
      if (!this.serverMode) {
        const all = this._rows || [];
        const filtered = this.core.filterRows(all, { search: this.state.search, filters: this.state.filters }, this.cols);
        const sorted = this.core.sortRows(filtered, this.state.sort, this.cols);
        this._total = sorted.length;
        const pages = size ? Math.max(1, Math.ceil(sorted.length / size)) : 1;
        if (this.state.page > pages) this.state.page = pages;
        this._filteredAll = sorted;
        this._shown = size ? sorted.slice((this.state.page - 1) * size, this.state.page * size) : sorted;
        this.setState(all.length ? (sorted.length ? "" : "nomatch") : "empty");
        this.renderBody();
        this.renderFoot(sorted);
        this.updatePager();
        this.dispatchEvent(new CustomEvent("vs-load", { detail: { rows: this._shown, total: this._total }, bubbles: true, composed: true }));
        return;
      }
      // Server: page, sort, filters and (unless "loaded") search go to the handler.
      if (!this._dataSource) {
        this._dataSource = Viraspa.data.createSource((req) => this._handler(req), { debounce: Number(this.getAttribute("debounce") || 300), onError: () => {} });
      }
      const where = this.searchWhere();
      const request = { page: this.state.page, pageSize: size || 0, sort: this.state.sort, filters: { ...this.state.filters }, search: where === "server" ? this.state.search : "" };
      this.setState("loading");
      const id = (this._loadId = (this._loadId || 0) + 1);
      await this._dataSource.load(request, { debounce });
      if (id !== this._loadId) return;
      if (this._dataSource.error.peek()) {
        this.setState("error");
        return;
      }
      const answer = this._dataSource.result.peek() || { rows: [], total: 0 };
      let rows = answer.rows;
      if (where === "loaded" && this.state.search) rows = this.core.filterRows(rows, { search: this.state.search }, this.cols);
      if (this.hasAttribute("local-sort")) rows = this.core.sortRows(rows, this.state.sort, this.cols);
      this._shown = rows;
      this._total = answer.total;
      this.setState(rows.length ? "" : this.state.search || Object.values(this.state.filters).some(Boolean) ? "nomatch" : "empty");
      this.renderBody();
      this.renderFoot(rows);
      this.updatePager();
      this.dispatchEvent(new CustomEvent("vs-load", { detail: { rows, total: this._total }, bubbles: true, composed: true }));
    }

    setState(kind) {
      const box = this.stateBox;
      box.dataset.kind = kind;
      box.hidden = !kind;
      this.tableEl.setAttribute("aria-busy", String(kind === "loading"));
      if (kind === "loading") box.innerHTML = `<vs-progress type="dots" label="${esc(t("Loading"))}"></vs-progress>`;
      else if (kind === "error") box.innerHTML = `${esc(t("The list could not be loaded."))} <button type="button" class="retry">${esc(t("Try again"))}</button>`;
      else if (kind === "empty") box.textContent = this.getAttribute("empty-text") ? t(this.getAttribute("empty-text")) : t("Nothing to show yet.");
      else if (kind === "nomatch") box.textContent = t("No records match.");
      if (kind === "loading") Viraspa.core.components.scan(box);
    }

    updatePager() {
      const size = this.pageSize;
      this.pager.hidden = !size || this._total <= Math.min(size, Number(this.getAttribute("page-sizes-min") || size));
      if (!size) return;
      this.pager.setAttribute("page-size", String(size));
      this.pager.setAttribute("total", String(this._total));
      this.pager.setAttribute("page", String(this.state.page));
      if (this.getAttribute("page-sizes")) this.pager.setAttribute("page-sizes", this.getAttribute("page-sizes"));
    }

    // ---- rendering ------------------------------------------------------------
    renderAll() {
      if (!this.cols) return;
      this.renderHead();
      this.renderBody();
      this.renderFoot(this._filteredAll || this._shown);
    }

    visibleCols() {
      return this.cols.filter((c) => !c.hidden);
    }

    renderHead() {
      const cols = this.visibleCols();
      const selectable = this.getAttribute("selectable");
      this.colgroup.innerHTML = (selectable === "multiple" || selectable === "single" ? '<col class="select-col">' : "") + cols.map(() => "<col>").join("");
      const colEls = [...this.colgroup.children].slice(selectable ? 1 : 0);
      cols.forEach((c, i) => {
        const w = this.state.widths[c.key] || c.width;
        if (w) colEls[i].style.width = /^\d+$/.test(String(w)) ? `${w}px` : w;
        if (c.minWidth) colEls[i].style.minWidth = /^\d+$/.test(c.minWidth) ? `${c.minWidth}px` : c.minWidth;
      });
      const sortOf = (key) => this.state.sort.findIndex((s) => s.column === key);
      let html = "<tr>";
      if (selectable === "multiple") html += `<th class="select" scope="col"><input type="checkbox" class="select-all" aria-label="${esc(t("Select all rows on this page"))}"></th>`;
      else if (selectable === "single") html += `<th class="select" scope="col"><span class="vs-hidden">${esc(t("Select"))}</span></th>`;
      for (const c of cols) {
        const si = sortOf(c.key);
        const dir = si >= 0 ? this.state.sort[si].direction : null;
        const aria = dir ? (dir === "asc" ? "ascending" : "descending") : "none";
        const label = esc(t(c.label));
        const order = si >= 0 && this.state.sort.length > 1 ? `<sup>${si + 1}</sup>` : "";
        html += `<th scope="col" class="${c.sticky === "start" ? "sticky " : ""}align-${c.align}" data-key="${esc(c.key)}" aria-sort="${aria}" part="header">`;
        html += c.sortable ? `<button type="button" class="sort" data-sort="${esc(c.key)}">${label}<span class="arrow" aria-hidden="true">${dir === "asc" ? "▲" : dir === "desc" ? "▼" : ""}</span>${order}</button>` : `<span class="label">${label}</span>`;
        html += `<span class="resize" role="separator" aria-orientation="vertical" tabindex="0" data-resize="${esc(c.key)}" aria-label="${esc(t("Resize {column}").replace("{column}", t(c.label)))}"></span></th>`;
      }
      html += "</tr>";
      if (cols.some((c) => c.filterable)) {
        html += `<tr class="filters">${selectable ? "<th></th>" : ""}${cols
          .map((c) => `<th class="${c.sticky === "start" ? "sticky" : ""}">${c.filterable ? `<input type="search" data-filter="${esc(c.key)}" value="${esc(this.state.filters[c.key] || "")}" aria-label="${esc(t("Filter {column}").replace("{column}", t(c.label)))}" placeholder="${esc(t("Filter"))}">` : ""}</th>`)
          .join("")}</tr>`;
      }
      this.head.innerHTML = html;
    }

    cellHtml(row, c) {
      if (typeof c.render === "function") {
        const out = c.render(row);
        return out instanceof Node ? "" : esc(out ?? "");
      }
      return esc(this.core.format(this.core.read(row, c), c, row));
    }

    renderBody() {
      if (!this.cols || !this.body) return;
      const cols = this.visibleCols();
      const selectable = this.getAttribute("selectable");
      const html = this._shown
        .map((row, r) => {
          const key = String(this.keyOf(row));
          const selected = this._selected.has(key);
          // rowClass(row) names become classes and part names: vs-table::part(overdue) { … }
          const extra = typeof this.rowClass === "function" ? String(this.rowClass(row) || "").replace(/[^\w -]/g, "").trim() : "";
          let tr = `<tr data-index="${r}" aria-rowindex="${r + 2}"${selectable ? ` aria-selected="${selected}"` : ""}${extra ? ` class="${extra}"` : ""} part="row${extra ? ` ${extra}` : ""}">`;
          if (selectable === "multiple") tr += `<td class="select" role="gridcell"><input type="checkbox" class="row-check" tabindex="-1" aria-label="${esc(t("Select row"))}"${selected ? " checked" : ""}></td>`;
          else if (selectable === "single") tr += `<td class="select" role="gridcell"><input type="radio" class="row-check" tabindex="-1" name="vs-table-single" aria-label="${esc(t("Select row"))}"${selected ? " checked" : ""}></td>`;
          cols.forEach((c, ci) => {
            tr += `<td role="gridcell" class="${c.sticky === "start" ? "sticky " : ""}align-${c.align}${c.wrap ? " wrap" : ""}${c.className ? ` ${esc(c.className)}` : ""}" data-label="${esc(t(c.label))}" data-c="${ci}" tabindex="-1" part="cell"><div class="cell">${this.cellHtml(row, c)}</div></td>`;
          });
          return tr + "</tr>";
        })
        .join("");
      this.body.innerHTML = html;
      // Cells whose render() returned a Node.
      cols.forEach((c, ci) => {
        if (typeof c.render !== "function") return;
        this._shown.forEach((row, r) => {
          const out = c.render(row);
          if (out instanceof Node) this.body.rows[r].querySelector(`[data-c="${ci}"] .cell`).appendChild(out);
        });
      });
      Viraspa.core.components.scan(this.body);
      const all = this.head.querySelector(".select-all");
      if (all) {
        const keys = this._shown.map((r) => String(this.keyOf(r)));
        const count = keys.filter((k) => this._selected.has(k)).length;
        all.checked = count > 0 && count === keys.length;
        all.indeterminate = count > 0 && count < keys.length;
      }
      this.tableEl.setAttribute("aria-rowcount", String(this._total + 1));
      this.placeFocus(false);
    }

    renderFoot(rows) {
      const cols = this.visibleCols();
      if (!cols.some((c) => c.total)) {
        this.foot.innerHTML = "";
        return;
      }
      const selectable = this.getAttribute("selectable");
      const scope = this.serverMode ? this._shown : rows || [];
      this.foot.innerHTML = `<tr part="totals">${selectable ? "<td></td>" : ""}${cols
        .map((c, i) => {
          const value = c.total ? this.core.total(scope, c) : null;
          const text = value === null ? (i === 0 ? t("Total") : "") : c.total === "count" ? value : this.core.format(value, c, {});
          return `<td class="align-${c.align}${c.sticky === "start" ? " sticky" : ""}"><div class="cell">${esc(text)}</div></td>`;
        })
        .join("")}</tr>`;
    }

    // ---- full text of truncated cells -------------------------------------------
    showFullText(event) {
      const td = event.target.closest && event.target.closest("td[data-c]");
      if (!td) return;
      const cell = td.querySelector(".cell");
      if (cell && cell.scrollWidth > cell.clientWidth + 1) {
        td.title = cell.textContent.trim();
        td.setAttribute("data-tooltip", td.title);
      } else {
        td.removeAttribute("title");
        td.removeAttribute("data-tooltip");
      }
    }

    // ---- sorting ----------------------------------------------------------------
    onHeadClick(event) {
      const all = event.target.closest(".select-all");
      if (all) {
        for (const row of this._shown) {
          const key = String(this.keyOf(row));
          if (all.checked) this._selected.set(key, row);
          else this._selected.delete(key);
        }
        this.renderBody();
        this.selectionChanged();
        return;
      }
      const button = event.target.closest("[data-sort]");
      if (button) this.toggleSort(button.dataset.sort, event.shiftKey);
    }

    // Click: sort by this column (asc, desc, off); Shift+click: add it.
    toggleSort(key, add) {
      const current = this.state.sort.find((s) => s.column === key);
      const next = !current ? "asc" : current.direction === "asc" ? "desc" : null;
      let sort = add ? this.state.sort.filter((s) => s.column !== key) : [];
      if (next) sort = [...sort, { column: key, direction: next }];
      this.state.sort = sort;
      this.save();
      this.renderHead();
      const focusBack = this.head.querySelector(`[data-sort="${CSS.escape(key)}"]`);
      if (focusBack) focusBack.focus();
      this.dispatchEvent(new CustomEvent("vs-sort-change", { detail: { sort: this.state.sort }, bubbles: true, composed: true }));
      this.reload({ keepPage: true });
    }

    onHeadKey(event) {
      const handle = event.target.closest("[data-resize]");
      if (handle && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        const th = handle.closest("th");
        this.setWidth(handle.dataset.resize, th.getBoundingClientRect().width + (event.key === "ArrowRight" ? 16 : -16));
      }
    }

    // ---- column widths ------------------------------------------------------------
    onResizeStart(event) {
      const handle = event.target.closest("[data-resize]");
      if (!handle) return;
      event.preventDefault();
      const th = handle.closest("th");
      const startX = event.clientX;
      const startW = th.getBoundingClientRect().width;
      const rtl = getComputedStyle(this).direction === "rtl";
      const move = (e) => this.setWidth(handle.dataset.resize, startW + (rtl ? startX - e.clientX : e.clientX - startX), false);
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        this.save();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }

    setWidth(key, px, persist = true) {
      const col = this.cols.find((c) => c.key === key);
      const min = col && col.minWidth ? parseFloat(col.minWidth) : 48;
      const max = col && col.maxWidth ? parseFloat(col.maxWidth) : 1200;
      const width = Math.round(Math.max(min, Math.min(max, px)));
      this.state.widths[key] = width;
      const index = this.visibleCols().findIndex((c) => c.key === key);
      const offset = this.getAttribute("selectable") ? 1 : 0;
      const colEl = this.colgroup.children[index + offset];
      if (colEl) colEl.style.width = `${width}px`;
      if (persist) this.save();
    }

    // ---- column chooser -------------------------------------------------------------
    showColumnChooser() {
      const root = this.componentRoot;
      const panel = root.querySelector(".chooser");
      panel.setAttribute("popover", "auto");
      panel.innerHTML = `<fieldset><legend>${esc(t("Columns"))}</legend>${this.cols
        .map((c) => `<label><input type="checkbox" data-col="${esc(c.key)}"${c.hidden ? "" : " checked"}> ${esc(t(c.label))}</label>`)
        .join("")}</fieldset>`;
      panel.onchange = (e) => {
        const box = e.target.closest("[data-col]");
        if (!box) return;
        const col = this.cols.find((c) => c.key === box.dataset.col);
        if (!box.checked && this.visibleCols().length === 1) {
          box.checked = true; // at least one column stays
          return;
        }
        col.hidden = !box.checked;
        if (col.hidden) this.state.hidden.add(col.key);
        else this.state.hidden.delete(col.key);
        this.save();
        this.renderAll();
      };
      panel.showPopover();
      Viraspa.utility.dom.position(panel, root.querySelector(".columns-button"), { placement: "bottom-end" });
      const first = panel.querySelector("input");
      if (first) first.focus();
    }

    // ---- selection and rows ---------------------------------------------------------
    onBodyClick(event) {
      const tr = event.target.closest("tr[data-index]");
      if (!tr) return;
      const index = Number(tr.dataset.index);
      const td = event.target.closest("td[data-c]");
      if (td) this._focus = { r: index, c: Number(td.dataset.c) };
      if (event.target.closest(".row-check") || (this.getAttribute("selectable") === "single" && !event.target.closest("a, button"))) this.toggleRow(index, event.target.closest(".row-check") ? undefined : true);
      this.dispatchEvent(new CustomEvent("vs-row-click", { detail: { row: this._shown[index], index }, bubbles: true, composed: true }));
    }

    toggleRow(index, on) {
      const row = this._shown[index];
      if (!row) return;
      const key = String(this.keyOf(row));
      const mode = this.getAttribute("selectable");
      if (!mode) return;
      const select = on === undefined ? !this._selected.has(key) : on;
      if (mode === "single") this._selected.clear();
      if (select) this._selected.set(key, row);
      else this._selected.delete(key);
      this.renderBody();
      this.selectionChanged();
    }

    selectionChanged() {
      this.dispatchEvent(new CustomEvent("vs-selection-change", { detail: { rows: this.selectedRows, keys: this.selection }, bubbles: true, composed: true }));
    }

    open(index) {
      const row = this._shown[index];
      if (row) this.dispatchEvent(new CustomEvent("vs-row-open", { detail: { row, index }, bubbles: true, composed: true }));
    }

    // A menu given in the "row-menu" slot (e.g. a vs-context-menu) opens for a row.
    onRowMenu(event) {
      const tr = event.target.closest("tr[data-index]");
      if (!tr) return;
      const row = this._shown[Number(tr.dataset.index)];
      const detail = { row, index: Number(tr.dataset.index), target: tr };
      const go = this.dispatchEvent(new CustomEvent("vs-row-contextmenu", { detail, bubbles: true, composed: true, cancelable: true }));
      const menu = this.querySelector('[slot="row-menu"]');
      if (!go || !menu || typeof menu.openAt !== "function") return;
      event.preventDefault();
      this._menuRow = row;
      menu.openAt(tr, { x: event.clientX, y: event.clientY });
    }
    // The row the row menu was opened for.
    get menuRow() {
      return this._menuRow;
    }

    // ---- keyboard grid ----------------------------------------------------------------
    placeFocus(move) {
      const rows = this.body.rows;
      if (!rows.length) return;
      const r = Math.max(0, Math.min(rows.length - 1, this._focus.r));
      const cells = rows[r].querySelectorAll("td[data-c]");
      const c = Math.max(0, Math.min(cells.length - 1, this._focus.c));
      this._focus = { r, c };
      for (const td of this.body.querySelectorAll('td[tabindex="0"]')) td.tabIndex = -1;
      const cell = cells[c];
      if (!cell) return;
      cell.tabIndex = 0;
      if (move) cell.focus();
    }

    onBodyKey(event) {
      const td = event.target.closest("td[data-c]");
      if (!td || event.target.closest("input, select, textarea, button, a") !== null && event.target !== td) return;
      const action = Viraspa.keyboard.actionFor(event, this.keymap(KEYS));
      const rows = this.body.rows.length;
      const cols = this.visibleCols().length;
      const f = this._focus;
      const rtl = getComputedStyle(this).direction === "rtl";
      const moves = {
        ArrowDown: { r: f.r + 1, c: f.c },
        ArrowUp: { r: f.r - 1, c: f.c },
        ArrowRight: { r: f.r, c: f.c + (rtl ? -1 : 1) },
        ArrowLeft: { r: f.r, c: f.c + (rtl ? 1 : -1) },
        Home: event.ctrlKey ? { r: 0, c: 0 } : { r: f.r, c: 0 },
        End: event.ctrlKey ? { r: rows - 1, c: cols - 1 } : { r: f.r, c: cols - 1 },
      };
      if (action === "open") {
        event.preventDefault();
        this.open(f.r);
      } else if (action === "select") {
        event.preventDefault();
        this.toggleRow(f.r);
        this.placeFocus(true);
      } else if (action === "nextPage" || action === "previousPage") {
        if (!this.pageSize) return;
        event.preventDefault();
        this.pager.go(this.state.page + (action === "nextPage" ? 1 : -1));
      } else if (moves[event.key]) {
        event.preventDefault();
        this._focus = moves[event.key];
        this.placeFocus(true);
      }
    }

    // ---- export -------------------------------------------------------------------------
    // CSV of the rows matching the search and filters (in server mode: those on screen).
    exportCsv(fileName) {
      const rows = this.serverMode ? this._shown : this._filteredAll || this._shown;
      const name = fileName || `${(this.getAttribute("export-name") || this.getAttribute("label") || "table").replace(/[^\w.-]+/g, "-")}.csv`;
      this.core.download(this.core.toCsv(rows, this.cols), name);
      this.dispatchEvent(new CustomEvent("vs-export", { detail: { rows, fileName: name }, bubbles: true, composed: true }));
    }

    // Reloads from the source (or re-applies search/sort to the rows).
    refresh() {
      return this.reload({ keepPage: true });
    }
  }

  Viraspa.core.defineComponent(VsTable);
})(window.Viraspa);
