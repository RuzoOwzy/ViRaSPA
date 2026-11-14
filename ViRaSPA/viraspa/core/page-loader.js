(function (Viraspa) {
  // Fetches the html + model.json pair every framework page/component folder
  // has. Each pair is fetched once per session and kept in memory (the
  // in-flight promise is cached, so simultaneous requests share one fetch);
  // every use gets its own copy of the model, so changing it can't leak.
  const pageFiles = new Map();
  const componentFiles = new Map();

  // A folder's files share the folder's own name:
  // "app/pages/home" -> "app/pages/home/home" (+ .js, .html, .css, .model.json).
  function basePath(folder) {
    const trimmed = folder.replace(/\/+$/, "");
    return `${trimmed}/${trimmed.split("/").pop()}`;
  }

  // Self-closing custom elements. Browsers ignore "/>" on any element that
  // isn't void, so <vs-icon name="x" /> would swallow what follows it. In the
  // templates the framework reads (pages and components), a tag with a
  // hyphen written <x-y … /> becomes <x-y … data-vs-short></x-y> before the
  // browser parses it. Comments and the content of <script>, <style> and
  // <textarea> are left alone, and so are quoted attribute values. (The
  // marker lets the component warn when it does take content - see
  // Component "content".) index.html and HTML that app code sets itself are
  // parsed by the browser directly: write full tags there.
  const SELF_CLOSING = /<!--[\s\S]*?-->|<(script|style|textarea)\b[\s\S]*?<\/\1\s*>|<([a-z][a-z0-9]*-[a-z0-9-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/>/gi;
  function expandSelfClosing(html) {
    if (typeof html !== "string" || !html.includes("/>")) return html;
    return html.replace(SELF_CLOSING, (match, skipped, tag, attributes) => (tag ? `<${tag}${attributes} data-vs-short></${tag}>` : match));
  }

  function fetchPair(cache, basePath, { withModel = true } = {}) {
    if (!cache.has(basePath)) {
      const { fetchText, fetchJson } = Viraspa.utility.assetLoader;
      const pending = Promise.all([
        fetchText(`${basePath}.html`).then(expandSelfClosing),
        withModel ? fetchJson(`${basePath}.model.json`) : Promise.resolve({}),
      ]);
      pending.catch(() => cache.delete(basePath)); // a later load may retry
      cache.set(basePath, pending);
    }
    return cache.get(basePath).then(([template, model]) => ({ template, model: structuredClone(model) }));
  }

  // Template + model of a page. (Its stylesheet is handled by the router, so
  // it is loaded before the page is shown.)
  function fetchPage(basePath, options) {
    return fetchPair(pageFiles, basePath, options);
  }

  function fetchComponent(basePath, options) {
    return fetchPair(componentFiles, basePath, options);
  }

  Viraspa.core = Viraspa.core || {};
  Viraspa.core.pageLoader = { basePath, fetchPage, fetchComponent, expandSelfClosing };
})(window.Viraspa);
