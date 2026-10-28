(function (Viraspa) {
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  }

  class NavBar extends Viraspa.core.Component {
    async onLoad() {
      const { template, model } = await Viraspa.core.pageLoader.fetchComponent("components/nav-bar/nav-bar");
      // Links come from routes/routes.js (routes with a `nav` entry), so a
      // new page shows up here without editing this component.
      model.links = Viraspa.routes
        .filter((route) => route.nav)
        .map(
          (route) =>
            `<a href="${escapeHtml(route.path)}" data-route="${escapeHtml(route.name)}" class="nav-bar__link">${escapeHtml(route.nav.label)}</a>`
        )
        .join("");
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
