(function (Viraspa) {
  // Keeps <head> in step with the page on screen: the title, the
  // description, the shared-link preview tags (Open Graph, Twitter) and the
  // canonical address. A route describes its head information:
  //
  //   head: {
  //     title: "About VSales",                    // falls back to the route's title
  //     description: "Who we are and what we do.",
  //     image: "app/assets/images/share/about.png", // the shared-link preview picture (~1200x630)
  //     icon: "app/assets/icons/about.svg",         // optional: this page's own tab icon
  //   }
  //
  // The site's favicon stays in index.html; `image` is a different thing.
  // Values may contain {{placeholders}}, filled when the page has its data:
  //   head: { title: "{{name}} on VibeNet" }   ...   this.setHeadData({ name: profile.name })
  // A page can also replace values outright: this.setHead({ title: "..." }).
  // The same route fields drive node-tools/prerender.js and the server-side
  // head injection described in the README.

  let defaults = null;

  function captureDefaults() {
    if (defaults) return defaults;
    const description = document.querySelector('meta[name="description"]');
    const icon = document.querySelector('link[rel~="icon"][type="image/svg+xml"]') || document.querySelector('link[rel~="icon"]');
    defaults = {
      title: document.title,
      description: description ? description.getAttribute("content") : "",
      icon: icon ? icon.getAttribute("href") : null,
    };
    return defaults;
  }

  function fill(text, data) {
    if (typeof text !== "string") return text;
    return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
      const value = key.split(".").reduce((v, k) => (v == null ? undefined : v[k]), data || {});
      return value == null ? "" : String(value);
    });
  }

  function absolute(url) {
    try {
      return url ? new URL(url, document.baseURI).href : "";
    } catch {
      return "";
    }
  }

  function setMeta(attribute, name, content) {
    let el = document.head.querySelector(`meta[${attribute}="${name}"]`);
    if (!content) {
      if (el && el.hasAttribute("data-vs-head")) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attribute, name);
      el.setAttribute("data-vs-head", "");
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  function setLink(rel, href, extra = {}) {
    let el = document.head.querySelector(`link[rel="${rel}"][data-vs-head]`);
    if (!href) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("link");
      el.rel = rel;
      el.setAttribute("data-vs-head", "");
      document.head.appendChild(el);
    }
    el.href = href;
    for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v);
  }

  // The resolved head values for a route (+ placeholder data, + overrides).
  function resolve(route, data, overrides) {
    const base = captureDefaults();
    const head = { ...((route && route.head) || {}), ...(overrides || {}) };
    return {
      title: fill(head.title, data) || (route && route.title) || base.title,
      description: fill(head.description, data) || base.description,
      image: fill(head.image, data) || "",
      icon: head.icon || null,
    };
  }

  function apply(route, data, overrides) {
    const head = resolve(route, data, overrides);
    document.title = head.title;
    setMeta("name", "description", head.description);
    const url = location.origin + location.pathname;
    setLink("canonical", url);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:title", head.title);
    setMeta("property", "og:description", head.description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", absolute(head.image));
    setMeta("name", "twitter:card", head.image ? "summary_large_image" : "summary");
    setMeta("name", "twitter:title", head.title);
    setMeta("name", "twitter:description", head.description);
    setMeta("name", "twitter:image", absolute(head.image));
    // A route's own tab icon, else the site's favicon from index.html.
    const icon = document.querySelector('link[rel~="icon"][type="image/svg+xml"]');
    if (icon) icon.setAttribute("href", head.icon || captureDefaults().icon);
    return head;
  }

  Viraspa.head = { apply, resolve, fill };
})(window.Viraspa);
