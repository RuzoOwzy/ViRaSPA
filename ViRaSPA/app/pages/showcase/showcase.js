(function (Viraspa) {
  // The showcase: every official component, with a little code where one
  // needs it. (Popups come from Viraspa.popup: startup.js components: ["vs-popup"].)
  class ShowcasePage extends Viraspa.core.Page {
    async onLoad() {
      await super.onLoad();
      const $ = (selector) => this.container.querySelector(selector);

      // vs-select-search from the server (the demo API) and from a list.
      $("#sc-customer").source = async ({ text, signal }) => {
        const people = await Viraspa.app.services.people.list({ limit: 10 }, { signal });
        return people.filter((p) => Viraspa.filter.plain(p.name).includes(Viraspa.filter.plain(text))).map((p) => ({ value: p.id, label: p.name, email: p.email }));
      };
      $("#sc-product").items = [
        { value: "R5", label: "Rice 5 kg", price: "TZS 18,000" },
        { value: "O3", label: "Cooking oil 3 L", price: "TZS 21,500" },
        { value: "S2", label: "Sugar 2 kg", price: "TZS 7,000" },
        { value: "M2", label: "Maize flour 2 kg", price: "TZS 5,600" },
      ];
      $("#sc-due").isDateDisabled = (iso) => new Date(iso).getDay() === 0; // no Sundays

      // vs-table and vs-pagination.
      // (Not awaited: the rest of the page works even if the demo API is unreachable.)
      Viraspa.app.services.people.list({ limit: 10 }).then((people) => ($("#sc-people").rows = people), () => ($("#sc-people").rows = []));
      this.listen($("#sc-pager"), "vs-page-change", (e) => ($("#pager-output").textContent = `page ${e.detail.page}, ${e.detail.pageSize} per page`));

      // vs-table-entry: a computed column, defaults for new rows. (Viraspa.tableCore
      // arrives with the table components: wait for them before using it.)
      await Viraspa.core.components.load("vs-table-entry");
      const lines = $("#sc-lines");
      lines.columns = Viraspa.tableCore.columnsFromChildren(lines).map((c) =>
        c.field === "amount" ? { ...c, value: (row) => (Number(row.quantity) || 0) * (Number(row.price) || 0) * (1 + (Number(row.vat) || 0) / 100) } : c
      );
      lines.newRow = () => ({ quantity: 1, vat: "18" });
      lines.rows = [{ product: "Rice 5 kg", quantity: 2, price: 18000, vat: "18" }];

      // vs-tree: a chart of accounts (locked system accounts, like EliteWeb's).
      const accounts = $("#sc-accounts");
      accounts.nodes = [
        { id: 1, label: "Assets", locked: true, expanded: true, children: [
          { id: 11, label: "Cash", locked: true },
          { id: 12, label: "Bank accounts", children: [{ id: 121, label: "CRDB" }, { id: 122, label: "NMB" }] },
          { id: 13, label: "Customers (receivable)" },
        ] },
        { id: 2, label: "Liabilities", locked: true, children: [{ id: 21, label: "Suppliers (payable)" }, { id: 22, label: "VAT payable" }] },
        { id: 3, label: "Income", locked: true, children: [{ id: 31, label: "Sales" }] },
        { id: 4, label: "Expenses", locked: true, children: [{ id: 41, label: "Rent" }, { id: 42, label: "Salaries" }, { id: 43, label: "Transport" }] },
      ];
      let nextId = 500;
      accounts.onAdd = async (parent, label) => ({ id: ++nextId, label }); // a real app saves it on the server
      this.listen(accounts, "vs-node-add", (e) => ($("#tree-output").textContent = `added "${e.detail.node.label}" under "${e.detail.parent.label}"`));
      this.listen(accounts, "vs-node-move", (e) => ($("#tree-output").textContent = `moved "${e.detail.node.label}" to "${e.detail.to.label}"`));

      $("#sc-category").items = [
        { id: "food", label: "Food" },
        { id: "rice", label: "Rice", parent: "food" },
        { id: "oil", label: "Cooking oil", parent: "food" },
        { id: "drinks", label: "Drinks" },
        { id: "soda", label: "Soda", parent: "drinks" },
        { id: "water", label: "Water", parent: "drinks" },
      ];
      $("#sc-regions").nodes = [
        { id: "north", label: "North", children: [{ id: "aru", label: "Arusha" }, { id: "kil", label: "Kilimanjaro" }] },
        { id: "coast", label: "Coast", children: [{ id: "dar", label: "Dar es Salaam" }, { id: "tan", label: "Tanga" }] },
      ];

      const form = $("#inputs-form");
      this.listen(form, "submit", (event) => {
        event.preventDefault();
        if (!Viraspa.forms.validate(form).valid) return;
        $("#inputs-output").textContent = JSON.stringify(Object.fromEntries(new FormData(form)));
      });

      const out = $("#popup-output");
      const demos = {
        alert: async () => {
          await Viraspa.popup.alert("The invoice was saved.");
          out.textContent = "alert closed";
        },
        confirm: async () => (out.textContent = `confirm: ${await Viraspa.popup.confirm("Delete invoice 1042?", { okLabel: "Delete", danger: true })}`),
        prompt: async () => (out.textContent = `prompt: ${JSON.stringify(await Viraspa.popup.prompt("New customer name", { value: "Amina Juma", required: true }))}`),
        flash: () => Viraspa.popup.flash("Copied"),
        drop: () => Viraspa.popup.drop("Connection restored."),
        custom: async () => (out.textContent = `custom: ${JSON.stringify(await $("#sc-popup").open())}`),
        html: () => ($("#editor-output").textContent = $("#sc-editor").value || "(empty)"),
        crop: async () => {
          const cropper = $("#sc-cropper");
          const img = $("#crop-result");
          img.src = cropper.toDataURL();
          img.hidden = false;
          const c = cropper.crop;
          $("#crop-output").textContent = `crop: ${c.x},${c.y} ${c.width}×${c.height}`;
        },
      };
      this.listen(this.container, "click", (event) => {
        const button = event.target.closest("[data-demo]");
        if (button) demos[button.dataset.demo]();
      });

      this.listen(this.container, "vs-menu-select", (event) => {
        $("#menu-output").textContent = `menu: ${event.detail.value}`;
      });
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages.showcase = ShowcasePage;
})(window.Viraspa);