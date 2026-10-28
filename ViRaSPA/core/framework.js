(function (Viraspa) {
  // FRAMEWORK-INTERNAL SETTINGS - not a project setting.
  // Maintained only in the ViRaSPA repository, and changed only when a new
  // framework release is cut (see Documents/release-notes.md). A project
  // built on ViRaSPA must not edit this file: it records which framework
  // release the project was taken from. The project's own release/cache
  // version lives in core/version.js instead.
  Viraspa.framework = Object.freeze({
    name: "ViRaSPA",
    version: "0.1.0", // x.x.x (major.minor.patch)
    releaseDate: "2026-10-28", // YYYY-MM-DD
  });
})(window.Viraspa);
