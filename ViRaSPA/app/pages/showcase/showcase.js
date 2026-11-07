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