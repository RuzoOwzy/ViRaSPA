(function (Viraspa) {
  // The persistent app shell: nav-bar + footer, mounted once at boot and
  // left alone across navigations - only #page-root's content is swapped
  // per route (see core/router.js), so switching pages no longer blinks or
  // refetches the header/footer. Call loadLayout() once, before the router
  // starts. There's a single shared shell for now; a route choosing between
  // multiple layouts (e.g. public vs private) is a later extension.

  Viraspa.core = Viraspa.core || {};

  Viraspa.core.loadLayout = async function () {
    Viraspa.core.emit("layout:beforeLoad");

    await Viraspa.core.mountComponent(Viraspa.components.NavBar, "#nav-slot");
    await Viraspa.core.mountComponent(Viraspa.components.Footer, "#footer-slot");

    Viraspa.core.emit("layout:onLoad");
    Viraspa.core.emit("layout:afterLoad");
  };
})(window.Viraspa);
