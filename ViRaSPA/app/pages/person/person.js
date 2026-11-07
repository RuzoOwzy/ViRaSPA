(function (Viraspa) {
  // A route with a parameter: path "/people/:id" (see app/config/routes.js).
  // this.params.id is the value from the address, e.g. "3" for /people/3.
  // The route's head uses it at once ({{id}}) and this.setHeadData() fills
  // in the name when the data arrives - the same placeholders a server can
  // fill for link previews (README "Dynamic pages").
  class PersonPage extends Viraspa.core.Page {
    async onLoad() {
      await super.onLoad();
      const box = Viraspa.utility.dom.qs("#person-details", this.container);
      try {
        const user = await Viraspa.app.services.people.get(this.params.id, { signal: this.signal });
        this.setHeadData({ name: user.name, company: user.company && user.company.name });
        Viraspa.utility.dom.qs("h1", this.container).textContent = user.name;
        box.innerHTML = "";
        await Viraspa.core.components.load("vs-card");
        await Viraspa.core.mountComponent(customElements.get("vs-card"), box, {
          heading: user.name,
          subheading: `${user.email} · ${user.phone}`,
          icon: "lucide:user",
        });
      } catch (err) {
        if (err.name === "AbortError") return;
        box.textContent = `No person with id ${this.params.id}.`;
      }
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages.person = PersonPage;
})(window.Viraspa);