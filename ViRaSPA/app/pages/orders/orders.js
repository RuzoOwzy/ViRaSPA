(function (Viraspa) {
  // A list page: vs-table with data in the browser (orders) and from the
  // server (the demo API's posts). The old WebForms "filter page" ideas -
  // filters, the current record, multi-select and delete, double-click to
  // open - are all vs-table features now.
  const CUSTOMERS = ["Amina Juma", "Baraka Mussa", "Élodie Mushi", "Juma Hassan", "Neema Said", "Rehema Ali", "Saidi Omari", "Zawadi Kimaro"];
  const REGIONS = ["Dar es Salaam", "Arusha", "Dodoma", "Mwanza", "Mbeya", "Tanga"];
  const STATUSES = ["Paid", "Pending", "Overdue"];

  function sampleOrders() {
    const rows = [];
    let seed = 7;
    const next = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 1; i <= 120; i++) {
      const day = new Date(2026, 9, 1 + Math.floor(next() * 38));
      rows.push({
        number: `SO-${String(1000 + i)}`,
        customer: CUSTOMERS[Math.floor(next() * CUSTOMERS.length)],
        region: REGIONS[Math.floor(next() * REGIONS.length)],
        date: day.toISOString().slice(0, 10),
        status: STATUSES[Math.floor(next() * STATUSES.length)],
        amount: Math.round(next() * 400) * 1500 + 5000,
      });
    }
    return rows;
  }

  class OrdersPage extends Viraspa.core.Page {
    async onLoad() {
      await super.onLoad();
      const $ = (s) => this.container.querySelector(s);
      const table = $("#orders-table");
      this.orders = sampleOrders();
      table.rows = this.orders;
      table.rowClass = (row) => (row.status === "Overdue" ? "overdue" : "");
      const deleteButton = $('[data-action="delete"]');

      this.listen(table, "vs-selection-change", (e) => {
        deleteButton.disabled = !e.detail.rows.length;
        deleteButton.textContent = e.detail.rows.length ? `Delete selected (${e.detail.rows.length})` : "Delete selected";
      });
      this.listen(deleteButton, "click", () => this.remove(table.selectedRows));
      this.listen(table, "vs-row-open", (e) => this.open(e.detail.row));
      this.listen(table, "vs-menu-select", (e) => {
        const row = table.menuRow;
        if (e.detail.value === "open") this.open(row);
        else if (e.detail.value === "paid") {
          row.status = "Paid";
          table.refresh();
        } else if (e.detail.value === "delete") this.remove([row]);
      });

      // Server mode: the demo API pages, sorts and searches posts.
      $("#posts-table").source = async ({ page, pageSize, search, sort, signal }) => {
        const query = { _page: page, _limit: pageSize };
        if (search) query.q = search;
        if (sort.length) {
          query._sort = sort[0].column;
          query._order = sort[0].direction;
        }
        const rows = await Viraspa.services.communication.call(Viraspa.endpoints.posts.list, { query, signal });
        return { rows, total: search ? rows.length : 100 };
      };
    }

    async open(row) {
      const body = `<dl class="details">${[
        ["Order", row.number],
        ["Customer", row.customer],
        ["Region", row.region],
        ["Date", Viraspa.format.date(row.date, "long")],
        ["Status", row.status],
        ["Amount", Viraspa.format.currency(row.amount, "TZS")],
      ]
        .map(([k, v]) => `<dt>${k}</dt><dd>${Viraspa.utility.dom.escapeHtml(v)}</dd>`)
        .join("")}</dl>`;
      await Viraspa.popup.open({ heading: `Order ${row.number}`, content: body, size: "small" });
    }

    async remove(rows) {
      if (!rows.length) return;
      if (!(await Viraspa.popup.confirm(`Delete ${rows.length} order(s)?`, { okLabel: "Delete", danger: true }))) return;
      const gone = new Set(rows.map((r) => r.number));
      this.orders = this.orders.filter((r) => !gone.has(r.number));
      const table = this.container.querySelector("#orders-table");
      table.selection = [];
      table.rows = this.orders;
      this.container.querySelector('[data-action="delete"]').disabled = true;
      Viraspa.toast.show(`${rows.length} order(s) deleted.`);
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages.orders = OrdersPage;
})(window.Viraspa);