(function (Viraspa) {
  // Runs after viraspa.js has loaded the framework. Loads the app's own files
  // from app/config/startup.js (group by group; files within a group load
  // together), runs the project's init code, waits for the shell, then
  // starts the router.

  const STARTUP_FILE = "app/config/startup.js";

  async function loadGroup(group) {
    const { loadScript, loadStyle } = Viraspa.utility.assetLoader;
    await Promise.all([...(group.styles || []).map((href) => loadStyle(href)), ...(group.scripts || []).map(loadScript)]);
  }

  // The framework's own namespaces are frozen once loaded, so app or
  // extension code can't replace framework functions by accident. (Viraspa
  // itself stays open for app data: Viraspa.routes, Viraspa.pages,
  // Viraspa.endpoints... Change behaviour through the APIs, e.g.
  // Viraspa.core.setGuard.)
  function deepFreeze(value, seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value) || value instanceof Map || value instanceof Set) return;
    seen.add(value);
    for (const key of Object.keys(value)) deepFreeze(value[key], seen);
    Object.freeze(value);
  }

  function lockFrameworkNamespaces() {
    for (const name of ["core", "services", "utility", "cache", "icons", "toast", "extensions", "manifestRules"]) {
      deepFreeze(Viraspa[name]);
      Object.defineProperty(Viraspa, name, { value: Viraspa[name], writable: false, configurable: false });
    }
  }

  async function boot() {
    const { name, version, releaseDate } = Viraspa.framework;
    const app = Viraspa.settings.app;
    console.info(`${name} v${version} (released ${releaseDate}) · ${app.name || "app"} v${app.version || "?"}`);

    await Viraspa.cache.ready; // the app token ("auto" strategy may fetch it)
    lockFrameworkNamespaces();
    await Viraspa.utility.assetLoader.loadScript(STARTUP_FILE);
    const startup = Viraspa.startup || {};

    // Extensions first, so the app's own files can use their components.
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
    Viraspa.core.emit("appInit");
    await Viraspa.core.baseStyleLoaded;
    await Viraspa.core.loadLayout();
    Viraspa.core.initRouter();
  }

  // Scripts added by viraspa.js may run before or after DOMContentLoaded.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window.Viraspa);
