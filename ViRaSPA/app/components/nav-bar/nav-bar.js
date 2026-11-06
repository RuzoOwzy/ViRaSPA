(function (Viraspa) {
  // The sample app's top navigation. Full isolation: its styles live in its
  // own shadow root, so they can't clash with any page's styles.
  class NavBar extends Viraspa.core.Component {
    static tag = "app-nav-bar";
    static folder = "app/components/nav-bar";
    static isolation = "full";

    async onLoad() {
      // Links come from app/config/routes.js (routes with a `nav` entry), so
      // a new page shows up here without editing this component.
      const escapeHtml = Viraspa.utility.dom.escapeHtml;
      this.props.links = Viraspa.routes
        .filter((route) => route.nav)
        .map(
          (route) =>
            `<a href="${escapeHtml(route.path)}" data-route="${escapeHtml(route.name)}" class="nav-bar__link" part="link">${escapeHtml(route.nav.label)}</a>`
        )
        .join("");
      await super.onLoad();
    }

    async afterLoad() {
      // Built once, not per page, so the active link follows route changes.
      document.addEventListener("viraspa:routeChanged", (event) => this.highlightActive(event.detail.route));
    }

    highlightActive(route) {
      for (const link of this.componentRoot.querySelectorAll("[data-route]")) {
        const active = link.dataset.route === route.name;
        link.classList.toggle("nav-bar__link--active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
    }
  }

  Viraspa.core.defineComponent(NavBar);
})(window.Viraspa);
