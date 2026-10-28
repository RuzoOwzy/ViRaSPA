(function (Viraspa) {
  // Not a navigable route - no path, so it's never matched by a link click
  // or listed in Viraspa.routes - just the view shown when nothing matches.
  const NOT_FOUND_ROUTE = {
    path: null,
    name: "not-found",
    title: "ViRaSPA — Not Found",
    script: "pages/not-found/not-found.js",
  };

  function resolvePath() {
    return location.pathname || "/";
  }

  function matchRoute(path) {
    return Viraspa.routes.find((route) => route.path === path);
  }

  async function loadPage(route) {
    document.title = route.title;

    await Viraspa.utility.assetLoader.loadScript(route.script);
    const PageClass = Viraspa.pages[route.name];
    const container = Viraspa.utility.dom.qs("#page-root");
    const page = new PageClass(container, route);

    Viraspa.core.emit("page:beforeLoad", { route });
    await Viraspa.core.runHook(page, "beforeLoad");

    Viraspa.core.emit("page:onLoad", { route });
    await Viraspa.core.runHook(page, "onLoad");

    Viraspa.core.emit("page:afterLoad", { route });
    await Viraspa.core.runHook(page, "afterLoad");
  }

  // Default guard: always allows. A route's `access` ("public"/"private")
  // is just declared metadata until a developer overrides this with real
  // authentication logic that actually reads it - this is a scaffold for
  // that extension point, not a working access check.
  Viraspa.core = Viraspa.core || {};
  Viraspa.core.guard = async function (route) {
    return true;
  };

  async function loadRoute() {
    const route = matchRoute(resolvePath()) || NOT_FOUND_ROUTE;

    Viraspa.core.emit("route:beforeGuard", { route });
    const allowed = await Viraspa.core.guard(route);
    Viraspa.core.emit("route:onGuard", { route, allowed });
    Viraspa.core.emit("route:afterGuard", { route, allowed });

    await loadPage(allowed ? route : NOT_FOUND_ROUTE);
  }

  // Navigates like a normal link (real URL, Back/Forward both work) but
  // without a full page reload - pushes the new URL, then loads the page
  // the same way the initial load / popstate path does.
  function navigate(path) {
    if (path === location.pathname) return;
    history.pushState(null, "", path);
    loadRoute();
  }

  // Only intercept clicks on same-origin <a> tags whose href is one of our
  // own routes, and only when the browser would otherwise have done a plain
  // left-click navigation - so modifier-clicks, target="_blank", download
  // links and external links keep their normal, unintercepted behavior.
  function isInternalRouteLink(link) {
    if (!link || link.target || link.hasAttribute("download") || link.getAttribute("rel") === "external") {
      return false;
    }
    if (link.origin !== location.origin) return false;
    return Viraspa.routes.some((route) => route.path === link.pathname);
  }

  function onDocumentClick(event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest("a");
    if (!isInternalRouteLink(link)) return;

    event.preventDefault();
    navigate(link.pathname);
  }

  Viraspa.core.navigate = navigate;
  Viraspa.core.initRouter = function () {
    document.addEventListener("click", onDocumentClick);
    window.addEventListener("popstate", loadRoute);
    loadRoute();
  };
})(window.Viraspa);
