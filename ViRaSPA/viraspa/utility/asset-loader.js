(function (Viraspa) {
  const scripts = new Map(); // url -> Promise
  const styles = new Map(); // url -> { link, loaded }
  const styleTexts = new Map(); // url -> Promise<string>

  // Files packed by node-tools/bundle.js (app/viraspa-pack.js): site-relative
  // path -> text. Served from memory instead of the network.
  const pack = new Map();

  function addPack(entries) {
    for (const [rel, body] of Object.entries(entries || {})) pack.set(rel, String(body));
  }

  // The packed text for a URL, or undefined. Paths are compared relative to
  // the document's <base>, without query strings (cache tokens).
  function packed(path) {
    if (!pack.size) return undefined;
    try {
      const url = new URL(path, document.baseURI);
      const base = new URL(document.baseURI);
      if (url.origin !== base.origin) return undefined;
      const basePath = base.pathname.replace(/[^/]*$/, "");
      if (!url.pathname.startsWith(basePath)) return undefined;
      return pack.get(decodeURIComponent(url.pathname.slice(basePath.length)));
    } catch {
      return undefined;
    }
  }

  // Loads a script once; later calls get the same promise. Classic scripts
  // by default; { type: "module" } for a library that ships only as an ES
  // module (it runs in its own scope: use what it puts on window, or
  // import() it yourself). The framework and app code stay classic.
  function loadScript(src, { type } = {}) {
    const url = Viraspa.core.v(src);
    if (!scripts.has(url)) {
      const pending = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        if (type === "module") script.type = "module";
        script.src = url;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
        document.head.appendChild(script);
      });
      pending.catch(() => scripts.delete(url)); // a later call may retry
      scripts.set(url, pending);
    }
    return scripts.get(url);
  }

  // Adds a stylesheet <link> once. `active: false` downloads it without
  // applying it (media="not all") - used for page styles, which are switched
  // on only when their page is shown. Resolves with the <link> once loaded
  // (or failed: a missing stylesheet must not block a page).
  function loadStyle(href, { active = true } = {}) {
    const url = Viraspa.core.v(href);
    let entry = styles.get(url);
    if (!entry) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.media = active ? "all" : "not all";
      const loaded = new Promise((resolve) => {
        link.onload = () => resolve(link);
        link.onerror = () => {
          console.warn(`Stylesheet not found: ${url}`);
          resolve(link);
        };
      });
      document.head.appendChild(link);
      entry = { link, loaded };
      styles.set(url, entry);
    }
    return entry.loaded;
  }

  function setStyleActive(link, active) {
    if (link) link.media = active ? "all" : "not all";
  }

  // Kept for code written against 0.1.0.
  function loadStyleOnce(href) {
    loadStyle(href);
  }

  // A stylesheet's text, fetched once, with relative url(...) references
  // made absolute - needed when the text is applied somewhere other than a
  // <link> next to the file (shadow roots, <style> blocks).
  function fetchStyleText(href) {
    const url = Viraspa.core.v(href);
    if (!styleTexts.has(url)) {
      const fileUrl = new URL(href, document.baseURI);
      const fromPack = packed(href);
      const pending = (fromPack !== undefined
        ? Promise.resolve(fromPack)
        : fetch(url).then((res) => {
            if (!res.ok) throw new Error(`Failed to load ${href}: ${res.status}`);
            return res.text();
          }))
        .then((css) =>
          css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, ref) =>
            /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(ref) ? match : `url("${new URL(ref, fileUrl).href}")`
          )
        );
      pending.catch(() => styleTexts.delete(url));
      styleTexts.set(url, pending);
    }
    return styleTexts.get(url);
  }

  async function fetchText(path, { signal } = {}) {
    const fromPack = packed(path);
    if (fromPack !== undefined) return fromPack;
    const res = await fetch(Viraspa.core.v(path), { signal });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.text();
  }

  // `fresh: true` bypasses the browser cache and the cache token - for a file
  // edited on the server outside of a release (e.g. per-installation
  // settings read by init code).
  async function fetchJson(path, { fresh = false, signal } = {}) {
    const fromPack = fresh ? undefined : packed(path);
    if (fromPack !== undefined) return JSON.parse(fromPack);
    const res = fresh ? await fetch(path, { cache: "no-store", signal }) : await fetch(Viraspa.core.v(path), { signal });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  Viraspa.utility = Viraspa.utility || {};
  Viraspa.utility.assetLoader = {
    loadScript,
    loadStyle,
    loadStyleOnce,
    setStyleActive,
    fetchStyleText,
    fetchText,
    fetchJson,
    addPack,
    isPacked: (path) => packed(path) !== undefined,
  };
})(window.Viraspa);
