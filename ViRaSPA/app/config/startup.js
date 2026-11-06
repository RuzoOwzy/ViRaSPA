// The app's own files, loaded at startup by the framework (after the
// framework itself), group by group, in order. Files within a group load
// together. Each URL gets the app's cache token (see index.html settings).
// Pages are not listed here: they load on demand, from app/config/routes.js.
window.Viraspa.startup = {
  groups: [
    // Endpoints first: init code may change their base URL.
    { name: "config", scripts: ["app/config/endpoints.js"] },
    { name: "init", scripts: ["app/config/init.js"] },
    {
      // The responsive grid used by the sample pages (an app asset, not part
      // of the framework). It builds on jQuery, an explicit include in index.html.
      name: "libraries",
      styles: ["app/assets/x-responsive/x-responsive.css"],
      scripts: ["app/assets/jquery-extensions/jquery-extensions.js"],
    },
    { name: "libraries-2", scripts: ["app/assets/x-responsive/x-responsive.js"] },
    // Routes before components: the nav bar builds its links from them.
    { name: "routes", scripts: ["app/config/routes.js"] },
    {
      name: "components",
      scripts: [
        "app/components/nav-bar/nav-bar.js",
        "app/components/footer/footer.js",
        "app/components/card/card.js",
        "app/components/note/note.js",
      ],
    },
  ],
};
