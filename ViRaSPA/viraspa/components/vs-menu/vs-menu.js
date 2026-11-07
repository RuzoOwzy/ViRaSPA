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
  // order, leaving out routes the current user can't open.
  // nav: { label, icon, menus: ["main", "side"], order, divider: "before" },
  // or a list of such entries.
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
      // A route's nav may be one entry or a list (to appear differently in
      // different menus, e.g. "Home" in the public menu, "Website" in the side menu).
      return (Viraspa.routes || [])
        .flatMap((route, index) => [].concat(route.nav || []).map((nav) => ({ route, nav, index })))
        .filter(({ nav }) => (nav.menus || ["main"]).includes(menuName))
        // A route with parameters ("/customers/:id") has no single address to link to.
        .filter(({ route }) => !(route.path && Viraspa.routePaths.hasParams(route.path)))
        // Routes the current user can't open (private, missing privileges) are left out.
        .filter(({ route }) => Viraspa.session.canAccess(route))
        .sort((a, b) => (a.nav.order ?? a.index) - (b.nav.order ?? b.index))
        .flatMap(({ route, nav }) => {
          const item = { label: nav.label, href: route.path, icon: nav.icon };
          return nav.divider === "before" ? [{ divider: true }, item] : [item];
        });
    }

    prepareModel(model) {
      const escapeHtml = Viraspa.utility.dom.escapeHtml;
      // Dividers only between items: none first, last or twice in a row
      // (e.g. when the items above one are hidden for this user).
      const items = (this._items || this.routeItems(model.menu || "main")).filter(
        (item, i, all) => !item.divider || (i > 0 && i < all.length - 1 && !all[i - 1].divider && all.slice(0, i).some((x) => !x.divider))
      );
      model.orientation = model.orientation === "vertical" ? "vertical" : "horizontal";
      const t = Viraspa.i18n.t; // labels are natural keys: translated when a dictionary has them
      model.label = t(model.label);
      model.toggleLabel = t(model.toggleLabel);
      model.itemsHtml = items
        .map((original) => {
          if (original.divider) return '<li class="divider" role="separator" part="divider"></li>';
          const item = { ...original, label: t(original.label) };
          const icon = item.icon ? (typeof item.icon === "object" ? JSON.stringify(item.icon) : item.icon) : "";
          const external = item.external ? ' target="_blank" rel="noopener external"' : "";
          // App paths ("/about") get the site's sub-folder, if it has one.
          const href = item.href && !item.external ? Viraspa.core.toUrlPath(item.href) : item.href;
          return (
            `<li class="item"><a class="link" href="${escapeHtml(href || "#")}" data-menu-label="${escapeHtml(item.label)}"${external} part="link">` +
            (icon ? `<vs-icon class="icon" icon="${escapeHtml(icon)}"></vs-icon>` : "") +
            `<span class="label">${escapeHtml(item.label)}</span></a></li>`
          );
        })
        .join("");
      return model;
    }

    async afterLoad() {
      // this.listen: removed automatically when the menu leaves the page.
      this.listen(document, "viraspa:routeChanged", () => this.highlightActive());
      // Signing in or out changes which routes are listed; a new language
      // changes the labels.
      this.listen(document, "viraspa:sessionChanged", () => !this._items && this.render());
      this.listen(document, "viraspa:localeChanged", () => this.render());
      this.listen(this.componentRoot, "click", (event) => this.onClick(event));
      // The folded (small-screen) menu closes on a click elsewhere or Escape.
      this.listen(document, "click", (event) => {
        if (!event.composedPath().includes(this)) this.setOpen(false);
      });
      this.listen(document, "keydown", (event) => {
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
      const appPath = (p) => normalize(Viraspa.core.toAppPath(p));
      const here = appPath(location.pathname);
      for (const link of this.componentRoot.querySelectorAll("a.link")) {
        const active = link.origin === location.origin && appPath(link.pathname) === here;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
    }
  }

  Viraspa.core.defineComponent(VsMenu);
})(window.Viraspa);
