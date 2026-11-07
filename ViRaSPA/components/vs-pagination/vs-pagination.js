(function (Viraspa) {
  // Page navigation for long lists: first, previous, a page box, next, last,
  // "21–40 of 135" and a page-size choice.
  //
  //   <vs-pagination total="135" page-size="20" page-sizes="10,20,50,100"></vs-pagination>
  //   pager.addEventListener("vs-page-change", (e) => load(e.detail.page, e.detail.pageSize));
  //
  // Attributes: page (1-based), page-size, total, page-sizes (a list, or
  // "off"), compact (only the arrows and "page x of y"). Type a page number
  // and press Enter to jump. Keys while focus is inside: Alt+Left / Alt+Right
  // previous / next page, Alt+Home / Alt+End first / last (keys = { previous,
  // next, first, last }). Event: "vs-page-change" (detail: { page, pageSize }).
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const KEYS = { previous: "alt+arrowleft", next: "alt+arrowright", first: "alt+home", last: "alt+end" };

  class VsPagination extends Viraspa.core.Component {
    static tag = "vs-pagination";
    static folder = "components/vs-pagination";
    static isolation = "full";
    static hasModel = false;
    static observedAttributes = ["page", "page-size", "total", "page-sizes", "compact"];

    get page() {
      return Math.max(1, Number(this.getAttribute("page")) || 1);
    }
    set page(v) {
      this.setAttribute("page", String(v));
    }
    get pageSize() {
      return Math.max(1, Number(this.getAttribute("page-size")) || 20);
    }
    set pageSize(v) {
      this.setAttribute("page-size", String(v));
    }
    get total() {
      return Math.max(0, Number(this.getAttribute("total")) || 0);
    }
    set total(v) {
      this.setAttribute("total", String(v));
    }
    get pages() {
      return Math.max(1, Math.ceil(this.total / this.pageSize));
    }

    async afterLoad() {
      const root = this.componentRoot;
      this.nav = root.querySelector("nav");
      this.nav.setAttribute("aria-label", t("Pagination"));
      this.box = root.querySelector(".box");
      this.box.setAttribute("aria-label", t("Page"));
      this.sizes = root.querySelector(".sizes select");
      root.querySelector(".sizes .label").textContent = t("Rows per page");
      for (const [cls, label] of [["first", "First page"], ["prev", "Previous page"], ["next", "Next page"], ["last", "Last page"]]) {
        root.querySelector(`.${cls}`).setAttribute("aria-label", t(label));
      }
      this.listen(this.nav, "click", (e) => {
        const b = e.target.closest("button");
        if (!b || b.disabled) return;
        const target = { first: 1, prev: this.page - 1, next: this.page + 1, last: this.pages }[b.className];
        if (target) this.go(target);
      });
      this.listen(this.box, "keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.go(Number(this.box.value) || this.page);
        }
      });
      this.listen(this.box, "change", () => this.go(Number(this.box.value) || this.page));
      this.listen(this.sizes, "change", () => {
        const size = Number(this.sizes.value);
        const first = (this.page - 1) * this.pageSize; // keep the first row in view
        this.setAttribute("page-size", String(size));
        this.go(Math.floor(first / size) + 1, true);
      });
      this.listen(this.nav, "keydown", (e) => {
        const action = Viraspa.keyboard.actionFor(e, this.keymap(KEYS));
        if (!action) return;
        e.preventDefault();
        this.go({ previous: this.page - 1, next: this.page + 1, first: 1, last: this.pages }[action]);
      });
      this.update();
    }

    attributeChangedCallback() {
      if (this.nav) this.update();
    }

    go(page, force = false) {
      const next = Math.max(1, Math.min(this.pages, page));
      if (next === this.page && !force) {
        this.update();
        return;
      }
      this.setAttribute("page", String(next));
      this.dispatchEvent(new CustomEvent("vs-page-change", { detail: { page: next, pageSize: this.pageSize }, bubbles: true, composed: true }));
    }

    update() {
      const root = this.componentRoot;
      const { page, pages, total, pageSize } = this;
      this.box.value = String(page);
      this.box.max = String(pages);
      this.box.style.width = `${Math.max(2, String(pages).length) + 1.5}ch`;
      root.querySelector(".of").textContent = t("of {pages}").replace("{pages}", pages);
      root.querySelector(".first").disabled = root.querySelector(".prev").disabled = page <= 1;
      root.querySelector(".next").disabled = root.querySelector(".last").disabled = page >= pages;
      const from = total ? (page - 1) * pageSize + 1 : 0;
      const to = Math.min(total, page * pageSize);
      const fmt = (n) => new Intl.NumberFormat(Viraspa.i18n ? Viraspa.i18n.locale.peek() : undefined).format(n);
      root.querySelector(".info").textContent = t("{from}–{to} of {total}").replace("{from}", fmt(from)).replace("{to}", fmt(to)).replace("{total}", fmt(total));
      const list = this.getAttribute("page-sizes");
      const sizes = list === "off" ? [] : (list || "10,20,50,100").split(",").map(Number).filter(Boolean);
      if (!sizes.includes(pageSize) && sizes.length) sizes.push(pageSize);
      sizes.sort((a, b) => a - b);
      root.querySelector(".sizes").hidden = !sizes.length || this.hasAttribute("compact");
      this.sizes.innerHTML = sizes.map((s) => `<option value="${s}"${s === pageSize ? " selected" : ""}>${s}</option>`).join("");
      root.querySelector(".info").hidden = this.hasAttribute("compact");
    }
  }

  Viraspa.core.defineComponent(VsPagination);
})(window.Viraspa);
