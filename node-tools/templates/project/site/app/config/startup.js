// The app's own files, loaded at startup (after the framework), group by
// group; files within a group load together. Pages are not listed here:
// they load on demand, from app/config/routes.js.
window.Viraspa.startup = {
  // Official helpers installed in helpers/<name>/ (install.js add helper ...)
  // that your own code uses, e.g. ["forms"]. (Components load the helpers
  // they need by themselves.)
  helpers: [],
  // Extensions installed in extensions/<name>/ (install.js add extension ...).
  extensions: [],
  groups: [
    // The environment's settings, then endpoints (init code points them at
    // the environment's backend).
    { name: "environment", scripts: ["app/config/environment.js"] },
    { name: "config", scripts: ["app/config/endpoints.js"] },
    { name: "init", scripts: ["app/config/init.js"] },
    { name: "routes", scripts: ["app/config/routes.js"] },
    // Your own components, e.g. { name: "components", scripts: ["app/components/x/x.js"] },
  ],
};
