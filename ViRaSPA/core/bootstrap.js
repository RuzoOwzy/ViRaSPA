(function (Viraspa) {
  // Reads core/manifest.js and loads the framework's own files in the
  // background, group by group, so index.html only needs one <script> tag
  // for all of this. A developer's own extra files/libraries go in
  // index.html's own "Explicit includes" section instead, visibly.

  async function loadGroup(group) {
    await Promise.all(group.scripts.map((src) => Viraspa.utility.assetLoader.loadScript(src)));
  }

  async function boot() {
    const { groups } = Viraspa.manifest;
    const { name, version, releaseDate } = Viraspa.framework;
    console.info(`${name} v${version} (released ${releaseDate})`);

    for (const group of groups) {
      await loadGroup(group);
    }

    await Viraspa.core.runInit();
    Viraspa.core.emit("app:init");
    await Viraspa.core.loadLayout();
    Viraspa.core.initRouter();
  }

  document.addEventListener("DOMContentLoaded", boot);
})(window.Viraspa);
