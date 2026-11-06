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

  function fetchPair(cache, basePath, { withModel = true } = {}) {
    if (!cache.has(basePath)) {
      const { fetchText, fetchJson } = Viraspa.utility.assetLoader;
      const pending = Promise.all([
        fetchText(`${basePath}.html`),
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
  Viraspa.core.pageLoader = { basePath, fetchPage, fetchComponent };
})(window.Viraspa);
