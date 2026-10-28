(function (Viraspa) {
  // Project init code: runs once at startup, after the framework and
  // config/endpoints.js have loaded and before the layout and first page
  // load. Register work with Viraspa.core.onInit(async () => { ... }); the
  // framework waits for it (and logs, then continues, if it fails).
  //
  // Example - one frontend installed on many servers, each with its own
  // backend: read a settings file an admin edits on that server and point
  // every endpoint at it. `fresh: true` skips the browser cache, so an edit
  // applies on the next page load without a new release. Anything the
  // frontend fetches is public - never put secrets in such a file.
  //
  //   Viraspa.core.onInit(async () => {
  //     const settings = await Viraspa.utility.assetLoader.fetchJson("<your-settings-file>.json", { fresh: true });
  //     Viraspa.endpoints.setBaseUrl(settings.apiBaseUrl);
  //   });
})(window.Viraspa);
