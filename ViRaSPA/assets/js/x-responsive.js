// Ported from ctc2-web-backend's XResponsive.js - the generic
// breakpoint-aware engine only. The original file also bound behaviour to
// CTC2-specific elements (its menu, its search box); that part is
// app-specific and isn't ported here, by design (see the SPA modeling doc's
// note on selective importation).
(function ($) {
  const mediaFlags = { extraSmall: 1, small: 2, medium: 3, large: 4, extraLarge: 5 };

  function currentViewportIndex() {
    return Number($(":root").cssVar("--viewport-index"));
  }

  const windowResizeFnStack = [];

  function registerWindowResize(fn) {
    windowResizeFnStack.push(fn);
  }

  function windowResized() {
    const viewportIndex = currentViewportIndex();
    windowResizeFnStack.forEach((fn) => fn(viewportIndex));
  }

  $(window).on("resize", windowResized);

  window.Viraspa = window.Viraspa || {};
  window.Viraspa.xResponsive = { mediaFlags, currentViewportIndex, registerWindowResize };
})(jQuery);
