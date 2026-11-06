(function (Viraspa) {
  // Runs once at startup, before the layout and the first page. Register
  // work with Viraspa.core.onInit(async () => { ... }); it is awaited.
  //
  //   Viraspa.core.onInit(async () => {
  //     const settings = await Viraspa.utility.assetLoader.fetchJson("settings.json", { fresh: true });
  //     Viraspa.endpoints.setBaseUrl(settings.apiBaseUrl);
  //   });
})(window.Viraspa);
