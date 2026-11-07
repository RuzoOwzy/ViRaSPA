(function (Viraspa) {
  const { emit, runHook } = Viraspa.core;

  // Each shown page lives in its own element inside #page-root:
  // <div class="vs-page" data-page="home">. An entry tracks one of them.
  //   { route, element, page, controller, styleLink, keepAlive, created, shown }
  let current = null; // the entry on screen
  let pending = null; // the entry being prepared (not shown yet)
  let navCounter = 0; // the last navigation wins; older ones are dropped
  const kept = new Map(); // route name -> entry, for keepAlive routes (oldest first)
  let firstLoad = true;

  // Scroll positions per history entry, restored on Back/Forward.
  const scrollPositions = new Map();
  let shownKey = null;
  let keyCounter = 0;
  const newKey = () => `${Date.now().toString(36)}-${++keyCounter}`;
  const currentKey = () => (history.state && history.state.vsKey) || null;

  // Lowercase, and no trailing slash (except the root "/" itself), so
  // "/About/" and "/about" are the same route.
  function normalizePath(path) {
    const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
    return (trimmed || "/").toLowerCase();
  }

  function matchRoute(path) {
    return Viraspa.routes.find((route) => route.path && normalizePath(route.path) === path);
  }

  function isStale(navId) {
    return navId !== navCounter;
  }

  // The guard decides whether a route may open. It returns true (open),
  // false (show the not-found page) or a path to go to instead (e.g. the
  // login page). The default is Viraspa.session.guard: routes with
  // access "private" or `requires` need a signed-in user with those
  // privileges. Replace it with Viraspa.core.setGuard(async (route) => ...).
  let guard = (route) => Viraspa.session.guard(route);
  Viraspa.core.setGuard = function (fn) {
    if (typeof fn !== "function") throw new Error("setGuard needs a function (route) => true | false | path.");
    guard = fn;
  };
  Viraspa.core.guard = (route) => guard(route);

  // ---- layouts ("shells") ------------------------------------------------
  // index.html can hold several shells around one #page-root. Elements
  // marked data-layout-only="private" (space-separated names) show only
  // while the current route's layout is one of them. A route's `layout` is a
  // name, or "inherit" (default) to keep the current one; the first page
  // without one gets "private" if it is private, else "public".
  let currentLayout = null;

  function setLayout(name) {
    if (!name || name === currentLayout) return;
    currentLayout = name;
    document.documentElement.dataset.layout = name;
    // Its own attribute (not `hidden`), so it never clashes with privilege
    // checks that hide the same element.
    for (const el of document.querySelectorAll("[data-layout-only]")) {
      el.toggleAttribute("data-layout-hidden", !el.getAttribute("data-layout-only").split(/\s+/).includes(name));
    }
    emit("layoutChanged", { layout: name });
  }

  function layoutFor(route) {
    if (route.layout && route.layout !== "inherit") return route.layout;
    return currentLayout || (route.access === "private" || route.requires ? "private" : "public");
  }

  Viraspa.core.setLayout = setLayout;
  Viraspa.core.currentLayout = () => currentLayout;

  function createPageElement(route) {
    const element = document.createElement("div");
    element.className = "vs-page";
    element.dataset.page = route.name;
    return element;
  }

  // ---- showing a page ----------------------------------------------------
  function announcer() {
    let region = document.getElementById("vs-route-announcer");
    if (!region) {
      region = document.createElement("div");
      region.id = "vs-route-announcer";
      region.className = "vs-visually-hidden";
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "true");
      document.body.appendChild(region);
    }
    return region;
  }

  // After a navigation, move keyboard/screen-reader focus to the new page's
  // main heading (or announce its title when it has none).
  function focusPage(entry) {
    const heading = entry.element.querySelector("h1");
    if (heading) {
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    } else {
      announcer().textContent = document.title;
    }
  }

  function restoreScroll(fromHistory) {
    if (fromHistory) {
      window.scrollTo(0, scrollPositions.get(currentKey()) || 0);
      return;
    }
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id && document.getElementById(id);
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }

  function retire(entry) {
    Viraspa.utility.assetLoader.setStyleActive(entry.styleLink, false);
    if (entry.keepAlive && kept.get(entry.route.name) === entry) {
      entry.element.hidden = true;
      emit("pageHidden", { route: entry.route, page: entry.page }, entry.element);
    } else {
      emit("pageHidden", { route: entry.route, page: entry.page }, entry.element);
      remove(entry);
    }
  }

  function remove(entry) {
    emit("pageRemoved", { route: entry.route, page: entry.page }, entry.element);
    entry.element.remove();
    entry.controller.abort();
    if (entry.page && typeof entry.page.dispose === "function") entry.page.dispose(); // its effects and bindings
  }

  function keep(entry) {
    kept.delete(entry.route.name);
    kept.set(entry.route.name, entry);
    const max = Number.isInteger(Viraspa.settings.pageCache.maxPages) ? Viraspa.settings.pageCache.maxPages : 5;
    for (const [name, old] of kept) {
      if (kept.size <= max) break;
      if (old === entry) continue;
      kept.delete(name);
      remove(old);
    }
  }

  // Replaces the page on screen with `entry`, in one step: its stylesheet
  // is already loaded, so the new page never shows unstyled.
  function swapTo(entry, fromHistory, { announce = true } = {}) {
    const previous = current;
    setLayout(layoutFor(entry.route));
    Viraspa.utility.assetLoader.setStyleActive(entry.styleLink, true);
    if (previous && previous !== entry) {
      if (previous.styleLink === entry.styleLink) previous.styleLink = null;
      retire(previous);
    }
    if (!entry.element.isConnected) document.getElementById("page-root").appendChild(entry.element);
    entry.element.hidden = false;
    entry.shown = true;
    entry.path = normalizePath(location.pathname);
    entry.search = location.search;
    current = entry;
    if (pending === entry) pending = null;
    if (entry.keepAlive) keep(entry);
    Viraspa.head.apply(entry.route, entry.headData, entry.headOverrides);
    shownKey = currentKey();

    restoreScroll(fromHistory);
    if (!firstLoad) focusPage(entry);
    firstLoad = false;

    if (announce) announceShown(entry);
  }

  function announceShown(entry) {
    const detail = { route: entry.route, page: entry.page };
    if (!entry.created) {
      entry.created = true;
      emit("pageCreated", detail, entry.element);
    }
    emit("pageShown", detail, entry.element);
    emit("routeChanged", { route: entry.route, path: location.pathname });
  }

  async function showRoute(route, navId, fromHistory) {
    const keptEntry = kept.get(route.name);
    if (keptEntry) {
      swapTo(keptEntry, fromHistory);
      return;
    }

    const { loadStyle, loadScript } = Viraspa.utility.assetLoader;
    const basePath = Viraspa.core.pageLoader.basePath(route.page);
    const entry = {
      route,
      element: createPageElement(route),
      page: null,
      controller: new AbortController(),
      styleLink: null,
      keepAlive: Boolean(route.keepAlive),
      created: false,
      shown: false,
    };
    pending = entry;
    const styleReady = loadStyle(`${basePath}.css`, { active: false }).then((link) => (entry.styleLink = link));
    // The page's own translations (routes with i18n: true), before it renders.
    await Viraspa.i18n.prepareRoute(route);

    // Native page: plain .html/.css/.js - no class, no model, no {{ }}.
    if (route.native) {
      const { template } = await Viraspa.core.pageLoader.fetchPage(basePath, { withModel: false });
      await styleReady;
      if (isStale(navId)) return;
      entry.element.innerHTML = template;
      Viraspa.core.components.scan(entry.element);
      Viraspa.session.applyPrivileges(entry.element);
      Viraspa.i18n.translate(entry.element);
      swapTo(entry, fromHistory, { announce: false });
      // The script runs once (on the first visit); it listens for the
      // viraspa:pageCreated / pageShown events to set up each page instance.
      await loadScript(`${basePath}.js`).catch((err) => console.error(err));
      if (current === entry) announceShown(entry);
      return;
    }

    await loadScript(`${basePath}.js`);
    if (isStale(navId)) return;
    const PageClass = Viraspa.pages && Viraspa.pages[route.name];
    if (!PageClass) {
      throw new Error(`${basePath}.js loaded, but it didn't register Viraspa.pages["${route.name}"]. Register the page class under its route's name, or mark a plain page with native: true.`);
    }

    const display = async () => {
      await styleReady;
      if (isStale(navId) || entry.shown) return;
      swapTo(entry, fromHistory);
    };
    // Head information the page sets later (e.g. once its data arrived).
    const setHead = (data, overrides) => {
      if (data !== undefined) entry.headData = { ...(entry.headData || {}), ...data };
      if (overrides !== undefined) entry.headOverrides = { ...(entry.headOverrides || {}), ...overrides };
      if (current === entry) Viraspa.head.apply(entry.route, entry.headData, entry.headOverrides);
    };
    const page = new PageClass(entry.element, route, { signal: entry.controller.signal, display, setHead });
    entry.page = page;

    emit("pageBeforeLoad", { route, page });
    await runHook(page, "beforeLoad");
    emit("pageOnLoad", { route, page });
    await runHook(page, "onLoad");
    await display(); // in case onLoad didn't show the page itself
    if (isStale(navId) && !entry.shown) return;
    emit("pageAfterLoad", { route, page });
    await runHook(page, "afterLoad");
  }

  async function loadRoute({ fromHistory = false } = {}) {
    const navId = ++navCounter;
    // Back/Forward: remember where the page we're leaving was scrolled to
    // (navigate() does this itself before pushing the new address).
    if (fromHistory && shownKey) scrollPositions.set(shownKey, window.scrollY);
    if (pending && !pending.shown) {
      pending.controller.abort();
      pending = null;
    }

    const path = normalizePath(location.pathname);
    // Same page, only the #hash changed (an in-page link, or Back/Forward
    // between such links): just scroll, don't rebuild the page.
    if (current && current.shown && current.path === path && current.search === location.search) {
      restoreScroll(fromHistory && scrollPositions.has(currentKey()));
      shownKey = currentKey();
      return;
    }
    const matched = matchRoute(path);

    // Show the matched route's own spelling in the address bar (e.g.
    // "/About/" becomes "/about"), without adding a history entry. A wrong
    // URL is left as typed, so the user can see what didn't match.
    if (matched && location.pathname !== path) {
      history.replaceState(history.state, "", path + location.search + location.hash);
    }

    const route = matched || Viraspa.notFoundRoute;

    emit("routeBeforeGuard", { route });
    let allowed;
    try {
      allowed = await Viraspa.core.guard(route);
    } catch (err) {
      console.error("The route guard failed; the page is not shown:", err);
      allowed = false;
    }
    emit("routeOnGuard", { route, allowed });
    emit("routeAfterGuard", { route, allowed });
    if (isStale(navId)) return;

    // A path: go there instead (e.g. the login page), replacing this entry.
    // A path pointing back at this same page counts as "not allowed".
    if (typeof allowed === "string") {
      if (normalizePath(new URL(allowed, document.baseURI).pathname) !== path) {
        history.replaceState({ vsKey: currentKey() || newKey() }, "", allowed);
        return loadRoute();
      }
    }

    const target = allowed && typeof allowed !== "string" ? route : Viraspa.notFoundRoute;
    try {
      await showRoute(target, navId, fromHistory);
    } catch (err) {
      if (isStale(navId) || err.name === "AbortError") return;
      // A page folder that doesn't follow the naming convention would
      // otherwise leave a silent blank page.
      console.error(`Could not load the "${target.name}" page from "${target.page}":`, err);
      if (target === Viraspa.notFoundRoute) {
        document.getElementById("page-root").textContent = "Page could not be loaded.";
      } else {
        await showRoute(Viraspa.notFoundRoute, navId, fromHistory).catch((e) => console.error(e));
      }
    }
  }

  // Navigates like a normal link (real URL, Back/Forward both work) but
  // without a full page reload.
  function navigate(path) {
    const url = new URL(path, document.baseURI);
    const samePath = normalizePath(url.pathname) === normalizePath(location.pathname);
    if (samePath && url.search === location.search && url.hash === location.hash) return;
    if (shownKey) scrollPositions.set(shownKey, window.scrollY);
    history.pushState({ vsKey: newKey() }, "", url.pathname + url.search + url.hash);
    loadRoute();
  }

  // Only intercept clicks on same-origin <a> tags whose href is one of our
  // own routes, and only for a plain left-click - so modifier-clicks,
  // target="_blank", download and external links keep their normal behavior.
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

    // composedPath() also sees links inside components' shadow roots, which
    // event.target (retargeted to the component element) would hide.
    const link = event.composedPath().find((node) => node instanceof HTMLAnchorElement);
    if (!isInternalRouteLink(link)) return;

    event.preventDefault();
    navigate(link.pathname + link.search + link.hash);
  }

  // Signing out drops kept-alive private pages, so no private data stays in
  // the page after the session ends.
  document.addEventListener("viraspa:sessionChanged", (event) => {
    if (event.detail.signedIn) return;
    for (const [name, entry] of kept) {
      if (entry !== current && (entry.route.access === "private" || entry.route.requires)) {
        kept.delete(name);
        remove(entry);
      }
    }
  });

  Viraspa.core.navigate = navigate;
  Viraspa.core.normalizePath = normalizePath;
  // A prerendered copy (node-tools/prerender.js, renderLevel fullPage) arrives
  // with the page's content already inside #page-root. It stays on screen
  // until the app's own page is ready, then is replaced like any page.
  function adoptPrerenderedContent() {
    const root = document.getElementById("page-root");
    if (!root || !root.firstElementChild) return;
    const element = document.createElement("div");
    element.className = "vs-page";
    element.dataset.prerendered = "";
    element.append(...root.childNodes);
    root.appendChild(element);
    current = {
      route: { name: "prerendered" },
      element,
      page: null,
      controller: new AbortController(),
      styleLink: null,
      keepAlive: false,
      created: true,
      shown: true,
      path: null,
    };
  }

  Viraspa.core.initRouter = function () {
    adoptPrerenderedContent();
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (!currentKey()) history.replaceState({ ...(history.state || {}), vsKey: newKey() }, "");
    document.addEventListener("click", onDocumentClick);
    window.addEventListener("popstate", () => loadRoute({ fromHistory: true }));
    loadRoute();
  };
})(window.Viraspa);
