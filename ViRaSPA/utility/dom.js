(function (Viraspa) {
  Viraspa.utility = Viraspa.utility || {};

  Viraspa.utility.dom = {
    qs(selector, root) {
      return (root || document).querySelector(selector);
    },
    qsa(selector, root) {
      return Array.from((root || document).querySelectorAll(selector));
    },
  };
})(window.Viraspa);
