(function (Viraspa) {
  // Template placeholders:
  //   {{key}}    the value as text, HTML-escaped (safe for any data)
  //   {{{key}}}  the value as raw HTML - only for HTML you trust
  //   \{{        a literal "{{" (the backslash is removed)
  // `key` may be a path: {{user.address.city}}. Missing values become "".
  // Inside URL attributes (href, src, ...) a {{key}} value that would run
  // script (javascript:, vbscript:, non-image data:) becomes "about:blank".
  const PLACEHOLDER = /\\\{\{|\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([\w.]+)\s*\}\}/g;
  const URL_ATTRIBUTE = /\s(?:href|src|action|formaction|poster|xlink:href)\s*=\s*["']?[^"'>]*$/i;
  const UNSAFE_URL = /^(?:javascript|vbscript|data):/i;
  const SAFE_DATA_URL = /^data:image\/(?:png|gif|jpe?g|webp|avif|bmp);/i;

  function getPath(data, path) {
    return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), data);
  }

  function toText(value) {
    return value === undefined || value === null ? "" : String(value);
  }

  // True when `offset` sits inside the value of a URL attribute of an open tag.
  function inUrlAttribute(template, offset) {
    const tagStart = template.lastIndexOf("<", offset);
    if (tagStart === -1) return false;
    const before = template.slice(tagStart, offset);
    return !before.includes(">") && URL_ATTRIBUTE.test(before);
  }

  function safeUrl(value) {
    // Browsers ignore control characters and whitespace inside a scheme, so
    // "java\nscript:" must be caught too.
    const compact = value.replace(/[\u0000- ]/g, "");
    return UNSAFE_URL.test(compact) && !SAFE_DATA_URL.test(compact) ? "about:blank" : value;
  }

  function bindTemplate(template, data) {
    const escapeHtml = Viraspa.utility.dom.escapeHtml;
    return template.replace(PLACEHOLDER, (match, rawKey, key, offset) => {
      if (match === "\\{{") return "{{";
      if (rawKey) return toText(getPath(data, rawKey));
      let value = toText(getPath(data, key));
      if (inUrlAttribute(template, offset)) value = safeUrl(value);
      return escapeHtml(value);
    });
  }

  Viraspa.services = Viraspa.services || {};
  Viraspa.services.databinding = { bindTemplate, safeUrl };
})(window.Viraspa);
