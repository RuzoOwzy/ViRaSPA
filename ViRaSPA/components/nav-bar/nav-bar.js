(function (Viraspa) {
  class NavBar extends Viraspa.core.Component {
    async onLoad() {
      const { template, model } = await Viraspa.core.pageLoader.fetchComponent("components/nav-bar/nav-bar");
      this.renderTemplate(template, model);
    }

    async afterLoad() {
      // Mounted once by core/layout.js, not re-mounted per page, so the
      // active link is kept in sync by listening for route changes instead
      // of being passed in as a one-time prop.
      document.addEventListener("page:afterLoad", (event) => this.highlightActive(event.detail.route));
    }

    highlightActive(route) {
      $("[data-route]").each((_, link) => {
        $(link).toggleClass("nav-bar__link--active", link.dataset.route === route.name);
      });
    }
  }

  Viraspa.components = Viraspa.components || {};
  Viraspa.components.NavBar = NavBar;
})(window.Viraspa);
