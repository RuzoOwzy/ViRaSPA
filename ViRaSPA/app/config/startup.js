// The app's own files, loaded at startup by the framework (after the
// framework itself), group by group, in order. Files within a group load
// together. Each URL gets the app's cache token (see index.html settings).
// Pages are not listed here: they load on demand, from app/config/routes.js.
window.Viraspa.startup = {
  // Official helpers installed in helpers/<name>/ (install.js add helper ...)
  // that your own code uses, e.g. ["forms"]. (Components load the helpers
  // they need by themselves.)
  helpers: [],
  // Extensions installed in extensions/<name>/ (install.js add extension ...),
  // loaded before the groups below.
  extensions: [],
  groups: [
    // The environment's settings first, then endpoints (init code points
    // them at the environment's backend), then the session adapter.
    { name: "environment", scripts: ["app/config/environment.js"], styles: ["app/assets/app.css"] },
    { name: "config", scripts: ["app/config/endpoints.js", "app/config/session.js"] },
    { name: "init", scripts: ["app/config/init.js"] },
    {
      // The responsive grid used by the sample pages (an app asset, not part
      // of the framework). It builds on jQuery, an explicit include in index.html.
      name: "libraries",
      styles: ["app/assets/x-responsive/x-responsive.css"],
      scripts: ["app/assets/jquery-extensions/jquery-extensions.js"],
    },
    { name: "libraries-2", scripts: ["app/assets/x-responsive/x-responsive.js"] },
    { name: "routes", scripts: ["app/config/routes.js"] },
    // The app's own components. (Framework vs-* components - core ones and
    // those installed in components/ - load by themselves when used.)
    // native-counter is written in plain JS with no Viraspa.* calls.
    { name: "components", scripts: ["app/components/note/note.js", "app/components/native-counter/native-counter.js"] },
  ],
};
