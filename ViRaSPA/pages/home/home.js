(function (Viraspa) {
  class HomePage extends Viraspa.core.Page {
    async onLoad() {
      await super.onLoad();
      await this.loadSampleApiData();
    }

    async loadSampleApiData() {
      const listEl = Viraspa.utility.dom.qs("#sample-api-list", this.container);
      const endpoint = Viraspa.endpoints.users.list;

      Viraspa.core.emit("page:beforeRequest", { page: this, endpoint });
      try {
        const users = await Viraspa.services.communication.call(endpoint, { query: { _limit: 5 } });
        Viraspa.core.emit("page:onRequest", { page: this, result: users });

        // x-col sizes: full width on phones, half on tablets, a third from
        // desktop up - the responsive grid driving real layout, not just
        // loaded and unused. Wrappers are added first, in order, so the
        // cards can then mount in parallel (sharing one template fetch).
        listEl.innerHTML = "";
        const wrappers = users.map(() => {
          const wrapper = document.createElement("div");
          wrapper.className = "x-col xs-12 sm-6 md-4";
          listEl.appendChild(wrapper);
          return wrapper;
        });
        await Promise.all(
          users.map((user, i) =>
            Viraspa.core.mountComponent(Viraspa.components.Card, wrappers[i], {
              title: user.name,
              subtitle: user.email,
            })
          )
        );
      } catch (err) {
        listEl.textContent = "Could not load sample data (check your connection).";
      }
      Viraspa.core.emit("page:afterRequest", { page: this });
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages.home = HomePage;
})(window.Viraspa);
