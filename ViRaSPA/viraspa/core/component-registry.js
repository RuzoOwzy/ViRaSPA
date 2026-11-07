(function (Viraspa) {
  // Knows which component tags exist and where their scripts are, and loads
  // a component the first time its tag appears on the page ("autoload"):
  //   * core components (vs-header, vs-icon...): in the framework,
  //     viraspa/components/<tag>/;
  //   * official components (vs-card...): installed in components/<tag>/,
  //     found by convention, described by component-viraspa.json;
  //   * extensions: listed in app/config/startup.js (`extensions`),
  //     installed in extensions/<name>/, described by extension-viraspa.json.
  // So a page can just write <vs-icon icon="lucide:house"></vs-icon>.
  // Tags no one registered (native custom elements, the app's own
  // components) are left alone.

  const CORE_COMPONENTS = [
    "vs-header",
    "vs-sidebar",
    "vs-footer",
    "vs-brand",
    "vs-menu",
    "vs-user-menu",
    "vs-icon",
    "vs-busy-indicator",
    "vs-toast",
  ];

  const entries = new Map(); // tag -> { source, owner, script, folder, manifest? }
  const loading = new Map(); // tag -> Promise
  const extensions = new Map(); // name -> { manifest, folder }
  const prefixes = new Map(); // extension tag prefix -> extension name

  for (const tag of CORE_COMPONENTS) {
    const folder = Viraspa.core.frameworkUrl(`components/${tag}`);
    entries.set(tag, { source: "core", owner: "viraspa", folder, script: `${folder}/${tag}.js` });
  }

  const rules = () => Viraspa.manifestRules;
  const loader = () => Viraspa.utility.assetLoader;

  function report(what, { errors, warnings }) {
    for (const warning of warnings) console.warn(`${what}: ${warning}`);
    if (errors.length) console.error(`${what} was rejected:\n  - ${errors.join("\n  - ")}`);
    return errors.length === 0;
  }

  async function loadOfficialEntry(tag) {
    const folder = `components/${tag}`;
    let manifest;
    try {
      manifest = await loader().fetchJson(`${folder}/component-viraspa.json`);
    } catch {
      console.error(`<${tag}> is not installed (no ${folder}/component-viraspa.json). Install it from the repository root with:\n  node node-tools/install.js add component ${tag}@<version>`);
      return null;
    }
    const result = rules().validateManifest("component", manifest, { frameworkVersion: Viraspa.framework.version });
    if (!report(`Component <${tag}> ${manifest.version || ""}`.trim(), result)) return null;
    const entry = { source: "official", owner: tag, folder, script: `${folder}/${manifest.script}`, manifest };
    entries.set(tag, entry);
    return entry;
  }

  async function loadTag(tag) {
    let entry = entries.get(tag);
    if (!entry && tag.startsWith("vs-")) entry = await loadOfficialEntry(tag);
    if (!entry) return;
    await loader().loadScript(entry.script);
    if (!customElements.get(tag)) console.error(`${entry.script} loaded, but it did not define <${tag}>.`);
  }

  // Loads the component for `tag` once (later calls share the promise).
  function load(tag) {
    if (customElements.get(tag)) return Promise.resolve();
    if (!loading.has(tag)) {
      loading.set(
        tag,
        loadTag(tag).catch((err) => console.error(`<${tag}> could not be loaded:`, err))
      );
    }
    return loading.get(tag);
  }

  // Finds not-yet-defined custom elements in `root` (a document, element,
  // shadow root or fragment) and loads the known ones. Resolves when done.
  function scan(root) {
    if (!root || !root.querySelectorAll) return Promise.resolve();
    const tags = new Set();
    if (root.localName && root.localName.includes("-") && !customElements.get(root.localName)) tags.add(root.localName);
    for (const el of root.querySelectorAll("*")) {
      if (el.localName.includes("-") && !customElements.get(el.localName)) tags.add(el.localName);
    }
    return Promise.all([...tags].map(load));
  }

  // Watches the page for elements added by any code (plain code included).
  // Shadow roots are scanned when framework components render.
  let observer = null;
  function watch() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Loads extensions/<name>/extension-viraspa.json, checks it and registers
  // its components. A rejected extension is not loaded at all.
  async function loadExtension(name) {
    const folder = `extensions/${name}`;
    let manifest;
    try {
      manifest = await loader().fetchJson(`${folder}/extension-viraspa.json`);
    } catch {
      console.error(`Extension "${name}" is not installed (no ${folder}/extension-viraspa.json). Install it with:\n  node node-tools/install.js add extension ${name}@<version>`);
      return false;
    }
    const result = rules().validateManifest("extension", manifest, {
      frameworkVersion: Viraspa.framework.version,
      takenPrefixes: [...prefixes.keys()],
    });
    const what = `Extension "${name}" ${manifest.version || ""}`.trim();
    for (const c of manifest.components || []) {
      if (c && entries.has(c.tag)) result.errors.push(`<${c.tag}> is already registered by ${entries.get(c.tag).owner}.`);
    }
    if (!report(what, result)) return false;

    prefixes.set(manifest.tagPrefix, name);
    extensions.set(name, { manifest, folder });
    for (const c of manifest.components || []) {
      entries.set(c.tag, { source: "extension", owner: name, folder: `${folder}/${c.folder || c.tag}`, script: `${folder}/${c.script}`, manifest });
    }
    for (const href of manifest.styles || []) {
      const css = await loader().fetchStyleText(`${folder}/${href}`).catch(() => "");
      const problem = rules().reservedCssProblem(css);
      if (problem) {
        console.error(`${what}: ${href} ${problem}, which are reserved for ViRaSPA; the stylesheet was not applied.`);
      } else {
        loader().loadStyle(`${folder}/${href}`);
      }
    }
    for (const src of manifest.scripts || []) await loader().loadScript(`${folder}/${src}`);
    return true;
  }

  // May `tag` use a reserved prefix (vs-, viraspa-)? Only core and official
  // components can.
  function mayUseReservedPrefix(tag) {
    const entry = entries.get(tag);
    return Boolean(entry && (entry.source === "core" || entry.source === "official"));
  }

  Viraspa.core = Viraspa.core || {};
  Viraspa.core.components = {
    CORE_COMPONENTS,
    load,
    scan,
    watch,
    loadExtension,
    mayUseReservedPrefix,
    info: (tag) => entries.get(tag) || null,
  };

  // Read-only view of the loaded extensions, e.g. for an About page.
  Viraspa.extensions = {
    list: () => [...extensions.values()].map(({ manifest }) => structuredClone(manifest)),
  };
})(window.Viraspa);
