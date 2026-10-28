// jQuery extension methods. cssVar/cssX are ported from OwzyComponents.js
// (ctc2-web-backend) - this is a dedicated home for this project's own
// jQuery extensions, with more to be added here as they come up.
(function ($) {
  // How to use: $ele.cssX("border", "0px", "important");
  $.fn.cssX = function (/*String*/ property, /*String*/ value, /*String*/ priority) {
    let ele;
    for (let i = 0; i < this.length; i++) {
      ele = this.eq(i)[0];
      if (value === undefined || value.trim() === "") {
        ele.style.removeProperty(property);
      } else {
        ele.style.setProperty(property, value, priority);
      }
    }
    return this;
  };

  $.fn.cssVar = function (name) {
    return getComputedStyle(this[0]).getPropertyValue(name).trim();
  };
})(jQuery);
