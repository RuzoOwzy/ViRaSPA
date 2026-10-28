(function (Viraspa) {
  // Lowercase, and no trailing slash (except the root "/" itself), so
  // "/About/" and "/about" are the same route.
  function normalizePath(path) {
    const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
    return (trimmed || "/").toLowerCase();
  }

  function matchRoute(path) {
    return Viraspa.routes.find((route) => normalizePath(route.path) === path);
  }

  async function loadPage(route) {
    document.title = route.title;

    const basePath = Viraspa.core.pageLoader.basePath(route.page);
    await Viraspa.utility.assetLoader.loadScript(`${basePath}.js`);
    const PageClass = Viraspa.pages[route.name];
    if (!PageClass) {
      throw new Error(`${basePath}.js loaded, but it didn't register Viraspa.pages["${route.name}"] - the page's class must be registered under its route's name.`);
    }
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
    const path = normalizePath(location.pathname);
    const matched = matchRoute(path);

    // Show the matched route's own spelling in the address bar (e.g.
    // "/About/" becomes "/about"), without adding a history entry. A wrong
    // URL is left as typed, so the user can see what didn't match.
    if (matched && location.pathname !== path) {
      history.replaceState(history.state, "", path + location.search + location.hash);
    }

    const route = matched || Viraspa.notFoundRoute;

    Viraspa.core.emit("route:beforeGuard", { route });
    const allowed = await Viraspa.core.guard(route);
    Viraspa.core.emit("route:onGuard", { route, allowed });
    Viraspa.core.emit("route:afterGuard", { route, allowed });

    const target = allowed ? route : Viraspa.notFoundRoute;
    try {
      await loadPage(target);
    } catch (err) {
      // A page folder that doesn't follow the naming convention would
      // otherwise leave a silent blank page.
      console.error(`Could not load the "${target.name}" page from "${target.page}":`, err);
      if (target === Viraspa.notFoundRoute) {
        Viraspa.utility.dom.qs("#page-root").textContent = "Page could not be loaded.";
      } else {
        await loadPage(Viraspa.notFoundRoute);
      }
    }
  }

  // Navigates like a normal link (real URL, Back/Forward both work) but
  // without a full page reload - pushes the new URL, then loads the page
  // the same way the initial load / popstate path does.
  function navigate(path) {
    if (normalizePath(path) === normalizePath(location.pathname)) return;
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
    return Boolean(matchRoute(normalizePath(link.pathname)));
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
