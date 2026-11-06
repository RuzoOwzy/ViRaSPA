(function (Viraspa) {
  Viraspa.utility = Viraspa.utility || {};

  const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  Viraspa.utility.dom = {
    qs(selector, root) {
      return (root || document).querySelector(selector);
    },
    qsa(selector, root) {
      return Array.from((root || document).querySelectorAll(selector));
    },
    // Makes any value safe to place in HTML text or a quoted attribute.
    escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
    },
  };
})(window.Viraspa);
