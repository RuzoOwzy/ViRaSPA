(function (Viraspa) {
  // The default onLoad renders home.html with home.model.json and shows
  // the page. Override it (calling `await super.onLoad()` first) to do more.
  class HomePage extends Viraspa.core.Page {}

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages.home = HomePage;
})(window.Viraspa);
