(function (Viraspa) {
  const loadedScripts = new Set();
  const loadedStyles = new Set();
  let currentPageStyleLink = null;

  function loadScript(src) {
    const url = Viraspa.core.v(src);
    if (loadedScripts.has(url)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.onload = () => {
        loadedScripts.add(url);
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.head.appendChild(script);
    });
  }

  function loadStyleOnce(href) {
    const url = Viraspa.core.v(href);
    if (loadedStyles.has(url)) return;
    loadedStyles.add(url);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }

  function swapPageStyle(href) {
    if (currentPageStyleLink) currentPageStyleLink.remove();
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = Viraspa.core.v(href);
    document.head.appendChild(link);
    currentPageStyleLink = link;
  }

  async function fetchText(path) {
    const res = await fetch(Viraspa.core.v(path));
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.text();
  }

  async function fetchJson(path) {
    const res = await fetch(Viraspa.core.v(path));
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  Viraspa.utility = Viraspa.utility || {};
  Viraspa.utility.assetLoader = { loadScript, loadStyleOnce, swapPageStyle, fetchText, fetchJson };
})(window.Viraspa);
