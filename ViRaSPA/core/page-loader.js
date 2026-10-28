(function (Viraspa) {
  // Streamlines the html + css + model.json trio every page/component folder
  // has, so a page/component's onLoad is one call instead of three.

  async function fetchPage(basePath) {
    const [template, model] = await Promise.all([
      Viraspa.utility.assetLoader.fetchText(`${basePath}.html`),
      Viraspa.utility.assetLoader.fetchJson(`${basePath}.model.json`),
    ]);
    Viraspa.utility.assetLoader.swapPageStyle(`${basePath}.css`);
    return { template, model };
  }

  async function fetchComponent(basePath) {
    const [template, model] = await Promise.all([
      Viraspa.utility.assetLoader.fetchText(`${basePath}.html`),
      Viraspa.utility.assetLoader.fetchJson(`${basePath}.model.json`),
    ]);
    Viraspa.utility.assetLoader.loadStyleOnce(`${basePath}.css`);
    return { template, model };
  }

  Viraspa.core = Viraspa.core || {};
  Viraspa.core.pageLoader = { fetchPage, fetchComponent };
})(window.Viraspa);
