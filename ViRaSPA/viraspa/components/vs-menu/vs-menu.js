(function (Viraspa) {
  // A list of navigation links, horizontal or vertical.
  //
  //   <vs-menu menu="main"></vs-menu>                    built from the routes
  //   <vs-menu orientation="vertical" menu="side"></vs-menu>
  //   menuElement.items = [                              or given directly
  //     { label: "Dashboard", href: "/dashboard", icon: { set: "lucide", name: "layout-dashboard" } },
  //     { divider: true },
  //     { label: "Website", href: "https://example.com", external: true },
  //   ];
  //
  // From routes: every route with `nav` whose nav.menus includes this
  // menu's name ("main" when nav.menus is missing), in nav.order then route
  // order. nav: { label, icon, menus: ["main", "side"], order }.
  //
  // Attributes:
  //   orientation  "horizontal" (default) | "vertical"
  //   collapsed    vertical only: icons alone, the label shows as a tooltip
  //   menu         which routes to list (default "main")
  //   label        accessible name of the navigation (default "Main")
  // Horizontal menus fold into a toggle button ("hamburger") on screens
  // narrower than 768px. The current page's link gets aria-current="page".
  class VsMenu extends Viraspa.core.Component {
    static tag = "vs-menu";
    static folder = Viraspa.core.frameworkUrl("components/vs-menu");
    static isolation = "full";
    static observedAttributes = ["orientation"];

    constructor() {
      super();
      if (Object.prototype.hasOwnProperty.call(this, "items")) {
        const value = this.items;
        delete this.items;
        this._items = value;
      }
    }

    get items() {
      return this._items || null;
    }

    // Setting items re-renders the menu (e.g. after the user's rights change).
    set items(value) {
      this._items = value;
      if (this._started) this.render();
    }

    routeItems(menuName) {
      return (Viraspa.routes || [])
        .map((route, index) => ({ route, index }))
        .filter(({ route }) => route.nav && (route.nav.menus || ["main"]).includes(menuName))
        .sort((a, b) => (a.route.nav.order ?? a.index) - (b.route.nav.order ?? b.index))
        .map(({ route }) => ({ label: route.nav.label, href: route.path, icon: route.nav.icon }));
    }

    prepareModel(model) {
      const escapeHtml = Viraspa.utility.dom.escapeHtml;
      const items = this._items || this.routeItems(model.menu || "main");
      model.orientation = model.orientation === "vertical" ? "vertical" : "horizontal";
      model.itemsHtml = items
        .map((item) => {
          if (item.divider) return '<li class="divider" role="separator" part="divider"></li>';
          const icon = item.icon ? (typeof item.icon === "object" ? JSON.stringify(item.icon) : item.icon) : "";
          const external = item.external ? ' target="_blank" rel="noopener external"' : "";
          return (
            `<li class="item"><a class="link" href="${escapeHtml(item.href || "#")}" data-tooltip="${escapeHtml(item.label)}"${external} part="link">` +
            (icon ? `<vs-icon class="icon" icon="${escapeHtml(icon)}"></vs-icon>` : "") +
            `<span class="label">${escapeHtml(item.label)}</span></a></li>`
          );
        })
        .join("");
      return model;
    }

    async afterLoad() {
      this._onRouteChanged = () => this.highlightActive();
      document.addEventListener("viraspa:routeChanged", this._onRouteChanged);
      this.componentRoot.addEventListener("click", (event) => this.onClick(event));
      // The folded (small-screen) menu closes on a click elsewhere or Escape.
      document.addEventListener("click", (event) => {
        if (!event.composedPath().includes(this)) this.setOpen(false);
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") this.setOpen(false);
      });
      this.highlightActive();
    }

    renderTemplate(template, model) {
      const html = super.renderTemplate(template, model);
      this.highlightActive();
      return html;
    }

    attributeChangedCallback() {
      if (this._started) this.render();
    }

    disconnectedCallback() {
      if (this._onRouteChanged) document.removeEventListener("viraspa:routeChanged", this._onRouteChanged);
      this._onRouteChanged = null;
      this._started = false;
    }

    connectedCallback() {
      if (this._onRouteChanged === null) {
        // Moved in the page: listen again, no need to reload.
        this._started = true;
        this._onRouteChanged = () => this.highlightActive();
        document.addEventListener("viraspa:routeChanged", this._onRouteChanged);
        this.highlightActive();
        return;
      }
      super.connectedCallback();
    }

    onClick(event) {
      const toggle = event.target.closest(".toggle");
      if (toggle) {
        this.setOpen(!this.componentRoot.querySelector(".menu").classList.contains("open"));
        return;
      }
      if (event.target.closest("a")) this.setOpen(false);
    }

    setOpen(open) {
      const menu = this.componentRoot.querySelector(".menu");
      if (!menu) return;
      menu.classList.toggle("open", open);
      this.componentRoot.querySelector(".toggle").setAttribute("aria-expanded", String(open));
    }

    highlightActive() {
      const normalize = Viraspa.core.normalizePath;
      const here = normalize(location.pathname);
      for (const link of this.componentRoot.querySelectorAll("a.link")) {
        const active = link.origin === location.origin && normalize(link.pathname) === here;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
    }
  }

  Viraspa.core.defineComponent(VsMenu);
})(window.Viraspa);
