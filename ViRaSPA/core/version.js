(function (Viraspa) {
  Viraspa.core = Viraspa.core || {};

  // Project setting: bump this on every release of the project built on
  // ViRaSPA. Appended as ?v=<version> to every URL the framework loads
  // itself, so browsers don't serve a stale cached copy. (The framework's
  // own release version is separate - see core/framework.js.)
  Viraspa.version = "2026.10.28.1";

  Viraspa.core.v = function (url) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${Viraspa.version}`;
  };
})(window.Viraspa);
