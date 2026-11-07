(function (Viraspa) {
  class HomePage extends Viraspa.core.Page {
    // The route has keepAlive: true, so this runs once; coming back to Home
    // shows the same page instantly, without calling the API again.
    async onLoad() {
      await super.onLoad(); // renders home.html and shows the page
      await this.loadSampleApiData(); // runs on the visible page
    }

    async loadSampleApiData() {
      const listEl = Viraspa.utility.dom.qs("#sample-api-list", this.container);
      const endpoint = Viraspa.endpoints.users.list;

      Viraspa.core.emit("pageBeforeRequest", { page: this, endpoint });
      try {
        // this.signal cancels the request if the user leaves the page first.
        const users = await Viraspa.app.services.people.list({ limit: 5 }, { signal: this.signal });
        Viraspa.core.emit("pageOnRequest", { page: this, result: users });

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
            // <vs-card> is an official component installed in components/;
            // mounting it by tag loads it on first use.
            Viraspa.core.components.load("vs-card").then(() =>
              Viraspa.core.mountComponent(customElements.get("vs-card"), wrappers[i], {
                heading: user.name,
                subheading: user.email,
                icon: "lucide:user",
              }).then((card) => {
                // A link to the person's own page: a route with a parameter.
                const link = document.createElement("a");
                link.slot = "footer";
                link.href = `people/${user.id}`;
                link.textContent = "Open";
                card.appendChild(link);
              })
            )
          )
        );
      } catch (err) {
        if (err.name === "AbortError") return; // the user left the page
        listEl.textContent = "Could not load sample data (check your connection).";
      }
      Viraspa.core.emit("pageAfterRequest", { page: this });
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages.home = HomePage;
})(window.Viraspa);
