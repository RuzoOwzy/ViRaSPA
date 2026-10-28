(function (Viraspa) {
  Viraspa.core = Viraspa.core || {};

  // Project setting: bump both on every release of the project built on
  // ViRaSPA. (The framework's own release version is separate - see
  // core/framework.js.)
  Viraspa.version = "0.1.0"; // x.x.x (major.minor.patch)
  Viraspa.releaseDate = "2026-10-29T18:00:00"; // ISO 8601, 24-hour time

  // Cache-busting token, built once: the version plus the release date's
  // digits, e.g. "0.1.0-20261029180000". Only digits, dots and a hyphen, so
  // it needs no URL-encoding, and a re-release of the same version with a
  // new date/time still busts the browser cache.
  const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
  let token = Viraspa.version;
  if (ISO_DATE_TIME.test(Viraspa.releaseDate)) {
    token += "-" + Viraspa.releaseDate.replace(/\D/g, "");
  } else {
    console.warn(`Viraspa.releaseDate "${Viraspa.releaseDate}" is not YYYY-MM-DDTHH:mm:ss; cache token uses the version only.`);
  }
  Viraspa.cacheToken = token;

  // Appends ?v=<token> to a URL the framework loads itself, so browsers
  // don't serve a stale cached copy after a release.
  Viraspa.core.v = function (url) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${Viraspa.cacheToken}`;
  };
})(window.Viraspa);
