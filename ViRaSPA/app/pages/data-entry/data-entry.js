(function (Viraspa) {
  // Keyboard-only data entry with the official helpers:
  //   data-entry  Enter / Shift+Enter between fields; Enter on the last field submits (data-entry-submit)
  //   forms       required marks, validation messages, read-only mode, values
  //   filter      the entries table follows the search box (data-filter-for)
  //   tooltip     data-tooltip on the buttons
  // and page shortcuts (this.shortcut), listed by the "?" overlay.
  const PRODUCTS = [
    ["Rice 5 kg", 18000],
    ["Cooking oil 3 L", 21500],
    ["Sugar 2 kg", 7000],
    ["Maize flour 2 kg", 5600],
    ["Beans 1 kg", 4200],
  ];

  class DataEntryPage extends Viraspa.core.Page {
    async onLoad() {
      await super.onLoad();
      const form = this.container.querySelector("#sale-form");
      this.form = form;
      this.container.querySelector("#product-list").innerHTML = PRODUCTS.map(([name]) => `<option value="${name}"></option>`).join("");

      // The price follows the product chosen.
      this.listen(form.product, "change", () => {
        const found = PRODUCTS.find(([name]) => name === form.product.value);
        if (found) form.price.value = found[1];
      });

      this.listen(form, "submit", (event) => {
        event.preventDefault();
        this.save();
      });
      this.listen(this.container.querySelector('[data-action="lock"]'), "click", () => this.toggleLock());

      this.shortcut("alt+n", () => this.startNew(), { description: "New entry" });
      this.shortcut("mod+s", () => this.save(), { description: "Save the entry", inFields: true });
      this.shortcut("alt+l", () => this.toggleLock(), { description: "Lock or unlock the form" });
      this.shortcut("alt+f", () => this.container.querySelector(".filter-box").focus(), { description: "Filter the entries" });

      this.snapshot = Viraspa.forms.snapshot(form);
      form.customer.focus();
    }

    save() {
      if (this.locked) return Viraspa.toast.show("The form is locked (Alt+L unlocks it).");
      if (!Viraspa.forms.validate(this.form).valid) return;
      const v = Viraspa.forms.values(this.form);
      const amount = Number(v.quantity) * Number(v.price);
      const row = this.container.querySelector("#entries tbody").insertRow(0);
      for (const text of [v.customer, v.product, v.quantity, Viraspa.format.currency(amount, "TZS")]) row.insertCell().textContent = text;
      Viraspa.toast.show(`Saved: ${v.customer}, ${v.product}.`);
      this.startNew();
    }

    startNew() {
      Viraspa.forms.restore(this.form, this.snapshot);
      for (const field of Viraspa.forms.fields(this.form)) Viraspa.forms.clearMessage(field);
      this.form.customer.focus();
    }

    toggleLock() {
      this.locked = !this.locked;
      Viraspa.forms.setReadOnly(this.form, this.locked);
      Viraspa.toast.show(this.locked ? "The form is read-only." : "The form can be edited again.");
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages["data-entry"] = DataEntryPage;
})(window.Viraspa);