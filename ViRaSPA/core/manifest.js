window.Viraspa = window.Viraspa || {};

window.Viraspa.manifest = {
  // Loaded group by group, in order; scripts within a group load together.
  // (framework.js, version.js, dom.js, asset-loader.js and events.js are
  // the minimal kernel bootstrap.js itself needs, so index.html references
  // those five directly instead of listing them here.) None of this - or anything the
  // core framework itself does - depends on jQuery; jQuery/x-responsive are
  // a visible, explicit include in index.html instead, not managed here.
  groups: [
    {
      name: "core",
      scripts: [
        "core/page.js",
        "core/component.js",
        "core/page-loader.js",
        "core/component-loader.js",
        "core/layout.js",
        "core/router.js",
      ],
    },
    {
      name: "services",
      scripts: ["services/databinding/data-binding-service.js", "services/communication/http-service.js"],
    },
    {
      name: "shared-components",
      scripts: ["components/nav-bar/nav-bar.js", "components/footer/footer.js", "components/card/card.js"],
    },
    { name: "routes", scripts: ["routes/routes.js"] },
  ],
};
