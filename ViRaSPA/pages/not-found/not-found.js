(function (Viraspa) {
  // Uses Page's default onLoad: renders pages/not-found/not-found.html/.model.json/.css.
  class NotFoundPage extends Viraspa.core.Page {}

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages["not-found"] = NotFoundPage;
})(window.Viraspa);
