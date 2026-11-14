(function (Viraspa) {
  // Runs after viraspa.js has loaded the framework. Loads the app's own files
  // from app/config/startup.js (group by group; files within a group load
  // together), runs the project's init code, waits for the shell, then
  // starts the router.

  // Viraspa.settings.startupFile replaces it, e.g. for a page that embeds a
  // few components (a playground, a widget) with its own startup list.
  const STARTUP_FILE = "app/config/startup.js";

  // A script is a path, or { src, type: "module" } for an ES-module library.
  async function loadGroup(group) {
    const { loadScript, loadStyle } = Viraspa.utility.assetLoader;
    await Promise.all([...(group.styles || []).map((href) => loadStyle(href)), ...(group.scripts || []).map((s) => (typeof s === "string" ? loadScript(s) : loadScript(s.src, s)))]);
  }

  // The framework's own namespaces are frozen once loaded, so app or
  // extension code can't replace framework functions by accident. (Viraspa
  // itself stays open for app data: Viraspa.routes, Viraspa.pages,
  // Viraspa.endpoints... Change behaviour through the APIs, e.g.
  // Viraspa.core.setGuard.)
  function deepFreeze(value, seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value) || value instanceof Map || value instanceof Set) return;
    if (Viraspa.state && Viraspa.state.isSignal(value)) return; // signals must stay writable
    seen.add(value);
    for (const key of Object.keys(value)) deepFreeze(value[key], seen);
    Object.freeze(value);
  }

  function lockFrameworkNamespaces() {
    for (const name of ["core", "services", "utility", "cache", "icons", "toast", "busy", "head", "session", "extensions", "manifestRules", "state", "expressions", "routePaths", "format", "i18n", "templates", "keyboard", "data"]) {
      deepFreeze(Viraspa[name]);
      Object.defineProperty(Viraspa, name, { value: Viraspa[name], writable: false, configurable: false });
    }
  }

  async function boot() {
    const { name, version, releaseDate, stage } = Viraspa.framework;
    const app = Viraspa.settings.app;
    const when = stage === "development" ? `in development, ${releaseDate}` : `released ${releaseDate}`;
    console.info(`${name} v${version} (${when}) · ${app.name || "app"} v${app.version || "?"}`);

    await Viraspa.cache.ready; // the app token ("auto" strategy may fetch it)
    lockFrameworkNamespaces();
    // The app's own namespace (never frozen): app/utils, app/services and
    // app/state files add to it, e.g. Viraspa.app.services.customers.
    Viraspa.app = Viraspa.app || {};
    for (const part of ["utils", "services", "state"]) Viraspa.app[part] = Viraspa.app[part] || {};
    await Viraspa.utility.assetLoader.loadScript((Viraspa.settings && Viraspa.settings.startupFile) || STARTUP_FILE);
    const startup = Viraspa.startup || {};

    // Official helpers, then extensions, so the app's own files can use them.
    await Promise.all((startup.helpers || []).map((name) => Viraspa.core.components.loadHelper(name)));
    // Components whose API the app uses from the start (e.g. "vs-popup" for
    // Viraspa.popup); other components still load when their tag appears.
    await Promise.all((startup.components || []).map((tag) => Viraspa.core.components.load(tag)));
    for (const name of startup.extensions || []) {
      await Viraspa.core.components.loadExtension(name);
    }

    const groups = startup.groups || [];
    for (const group of groups) {
      try {
        await loadGroup(group);
      } catch (err) {
        console.error(`Startup group "${group.name}" failed to load:`, err);
      }
    }

    await Viraspa.core.runInit();
    await Viraspa.i18n.start(); // the language (and its translations) before anything renders
    Viraspa.core.emit("appInit");
    await Viraspa.core.baseStyleLoaded;
    await Viraspa.core.loadLayout();
    // settings.router === false: no routes and no #page-root - the page only
    // uses components (an embedded widget, a playground frame).
    if (Viraspa.settings && Viraspa.settings.router === false) {
      document.documentElement.setAttribute("data-vs-ready", "");
      Viraspa.core.emit("appReady");
      return;
    }
    revealWhenReady();
    Viraspa.core.initRouter();
  }

  // Start-up without a flash of unstyled content. index.html hides #app
  // until <html> has data-vs-ready (see README "Start-up cover"); it is set
  // once the first page is shown and the shell's components (header, menu,
  // side panel...) have rendered, or after 4 seconds whatever happens.
  function revealWhenReady() {
    const root = document.documentElement;
    if (root.hasAttribute("data-vs-ready")) return;
    const reveal = () => root.setAttribute("data-vs-ready", "");
    const fallback = setTimeout(reveal, 4000);
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    document.addEventListener(
      "viraspa:pageShown",
      async () => {
        const app = document.getElementById("app") || document.body;
        const shell = [...app.querySelectorAll("*")].filter((el) => el.localName.includes("-") && !el.closest("#page-root"));
        const rendered = Promise.all(shell.map((el) => customElements.whenDefined(el.localName).then(() => el.ready)));
        await Promise.race([rendered, delay(2500)]);
        clearTimeout(fallback);
        requestAnimationFrame(reveal);
      },
      { once: true }
    );
  }

  // Scripts added by viraspa.js may run before or after DOMContentLoaded.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window.Viraspa);
