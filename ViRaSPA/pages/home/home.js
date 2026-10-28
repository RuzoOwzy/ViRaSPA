(function (Viraspa) {
  class HomePage extends Viraspa.core.Page {
    async onLoad() {
      const { template, model } = await Viraspa.core.pageLoader.fetchPage("pages/home/home");
      this.renderTemplate(template, model);

      await this.loadSampleApiData();
    }

    async loadSampleApiData() {
      const listEl = Viraspa.utility.dom.qs("#sample-api-list", this.container);
      const { method, endpoint } = this.route.api;

      Viraspa.core.emit("page:beforeRequest", { page: this, endpoint });
      try {
        const users = await Viraspa.services.communication.request(method, endpoint);
        Viraspa.core.emit("page:onRequest", { page: this, result: users });

        listEl.innerHTML = "";
        for (const user of users) {
          // x-col sizes: full width on phones, half on tablets, a third from
          // desktop up - the responsive grid driving real layout, not just
          // loaded and unused.
          const wrapper = document.createElement("div");
          wrapper.className = "x-col xs-12 sm-6 md-4";
          listEl.appendChild(wrapper);
          await Viraspa.core.mountComponent(Viraspa.components.Card, wrapper, {
            title: user.name,
            subtitle: user.email,
          });
        }
      } catch (err) {
        listEl.textContent = "Could not load sample data (check your connection).";
      }
      Viraspa.core.emit("page:afterRequest", { page: this });
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages.home = HomePage;
})(window.Viraspa);
