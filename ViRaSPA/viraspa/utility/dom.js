(function (Viraspa) {
  Viraspa.utility = Viraspa.utility || {};

  const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  // Places `panel` (position: fixed, e.g. a drop-down list in the top layer)
  // next to `anchor`, flipping to the other side when there is no room and
  // keeping it inside the window. placement: "bottom-start" (default),
  // "bottom-end", "top-start", "top-end", "right-start", "left-start", or a
  // point { x, y } (a context menu at the pointer).
  // Options: offset (px, default 4), matchWidth (at least the anchor's width).
  function position(panel, anchor, { placement = "bottom-start", offset = 4, matchWidth = false } = {}) {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    panel.style.position = "fixed";
    panel.style.margin = "0";
    panel.style.inset = "auto";
    if (matchWidth && anchor && anchor.getBoundingClientRect) panel.style.minWidth = `${Math.round(anchor.getBoundingClientRect().width)}px`;
    const p = panel.getBoundingClientRect();
    let x;
    let y;
    let side;
    if (placement && typeof placement === "object") {
      x = placement.x + p.width > vw ? placement.x - p.width : placement.x;
      y = placement.y + p.height > vh ? placement.y - p.height : placement.y;
      side = "point";
    } else {
      const a = anchor.getBoundingClientRect();
      const [main, align] = placement.split("-");
      if (main === "bottom" || main === "top") {
        const below = a.bottom + offset + p.height <= vh;
        const above = a.top - offset - p.height >= 0;
        side = main === "bottom" ? (below || !above ? "bottom" : "top") : above || !below ? "top" : "bottom";
        y = side === "bottom" ? a.bottom + offset : a.top - offset - p.height;
        x = align === "end" ? a.right - p.width : a.left;
      } else {
        const right = a.right + offset + p.width <= vw;
        side = main === "right" ? (right ? "right" : "left") : a.left - offset - p.width >= 0 ? "left" : "right";
        x = side === "right" ? a.right + offset : a.left - offset - p.width;
        y = a.top;
      }
    }
    x = Math.max(4, Math.min(x, vw - p.width - 4));
    y = Math.max(4, Math.min(y, vh - p.height - 4));
    panel.style.left = `${Math.round(x)}px`;
    panel.style.top = `${Math.round(y)}px`;
    panel.dataset.side = side;
    return side;
  }

  // Keeps `panel` placed while the page scrolls or resizes; returns a stop function.
  function follow(panel, anchor, options) {
    const update = () => position(panel, anchor, options);
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }

  // A unique id for ARIA links (aria-controls, aria-activedescendant...).
  let idCounter = 0;
  const uid = (prefix = "vs") => `${prefix}-${++idCounter}-${Math.random().toString(36).slice(2, 6)}`;

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
    position,
    follow,
    uid,
  };
})(window.Viraspa);
