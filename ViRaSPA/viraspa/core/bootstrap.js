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

  async function boot() {
    const { name, version, releaseDate } = Viraspa.framework;
    const app = Viraspa.settings.app;
    console.info(`${name} v${version} (released ${releaseDate}) · ${app.name || "app"} v${app.version || "?"}`);

    await Viraspa.cache.ready; // the app token ("auto" strategy may fetch it)
    await Viraspa.utility.assetLoader.loadScript(STARTUP_FILE);
    const groups = (Viraspa.startup && Viraspa.startup.groups) || [];
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
