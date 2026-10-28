(function (Viraspa) {
  // Streamlines the html + css + model.json trio every page/component folder
  // has, so a page/component's onLoad is one call instead of three.

  // A component's template and default model are fetched once per session,
  // then reused by every other instance of that component (e.g. a page
  // showing many cards), on any page. The in-flight promise is cached, not
  // just the result, so instances mounting at the same time share one fetch.
  const componentCache = new Map();

  // A page/component folder's files share the folder's own name:
  // "pages/home" -> "pages/home/home" (+ .js, .html, .css, .model.json).
  function basePath(folder) {
    const trimmed = folder.replace(/\/+$/, "");
    return `${trimmed}/${trimmed.split("/").pop()}`;
  }

  async function fetchPage(basePath) {
    const [template, model] = await Promise.all([
      Viraspa.utility.assetLoader.fetchText(`${basePath}.html`),
      Viraspa.utility.assetLoader.fetchJson(`${basePath}.model.json`),
    ]);
    Viraspa.utility.assetLoader.swapPageStyle(`${basePath}.css`);
    return { template, model };
  }

  async function fetchComponent(basePath) {
    if (!componentCache.has(basePath)) {
      const pending = Promise.all([
        Viraspa.utility.assetLoader.fetchText(`${basePath}.html`),
        Viraspa.utility.assetLoader.fetchJson(`${basePath}.model.json`),
      ]);
      // Forget a failed fetch, so a later mount can retry it.
      pending.catch(() => componentCache.delete(basePath));
      componentCache.set(basePath, pending);
      Viraspa.utility.assetLoader.loadStyleOnce(`${basePath}.css`);
    }
    const [template, model] = await componentCache.get(basePath);
    // Each instance gets its own copy of the default model, so one
    // instance changing its model can't leak into another.
    return { template, model: structuredClone(model) };
  }

  Viraspa.core = Viraspa.core || {};
  Viraspa.core.pageLoader = { basePath, fetchPage, fetchComponent };
})(window.Viraspa);
