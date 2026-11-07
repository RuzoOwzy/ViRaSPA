(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Viraspa.i18n = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";
  // Translations with natural keys: the text in your default language IS
  // the key, so templates stay readable and untranslated text still shows.
  //
  //   app/i18n/sw.json                 { "Sign In": "Ingia", "Welcome back, {name}.": "Karibu tena, {name}." }
  //   app/pages/users/users.i18n.sw.json  (route i18n: true) - the page's own texts
  //     (i18n: true = every language but the default; or a list: i18n: ["en", "sw"])
  //   plurals: { "{count} user": { "one": "Mtumiaji {count}", "other": "Watumiaji {count}" } }
  //
  //   <h1 data-i18n>Users</h1>                         element text
  //   <input data-i18n-attr="placeholder" placeholder="Search">
  //   {{ t("Welcome back, {name}.", { name: user.name }) }}   in templates (live)
  //   Viraspa.i18n.t("{count} user", { count: 3 })           in code
  //
  //   Viraspa.i18n.configure({ defaultLocale: "en", locales: [{ code: "en", name: "English", file: true }, { code: "sw", name: "Kiswahili" }] });
  //   (file: true on the default language loads app/i18n/en.json too - for its plural forms)
  //   await Viraspa.i18n.setLocale("sw");   // remembered in this browser
  //
  // The page's <html lang> and dir (right-to-left for Arabic, Hebrew...)
  // follow the language. Formats (Viraspa.format) use the same language.

  const RTL = ["ar", "he", "iw", "fa", "ur", "ps", "yi", "dv", "ckb", "sd", "ug"];
  const STORAGE_KEY = "viraspa:locale";

  const state = root.Viraspa && root.Viraspa.state;
  const makeSignal = (v) => (state ? state.signal(v) : { value: v, peek() { return this.value; } });

  let options = {
    defaultLocale: "en",
    locales: [], // [{ code, name, direction? }]
    folder: "app/i18n",
    rememberChoice: true,
  };
  const locale = makeSignal("en");
  const version = makeSignal(0); // bumps when dictionaries load
  const dictionaries = new Map(); // locale -> { key: value }
  const loaded = new Set(); // "url" already merged

  const language = (code) => String(code || "").toLowerCase().split("-")[0];

  function direction(code = locale.peek()) {
    const entry = options.locales.find((l) => l.code === code);
    if (entry && entry.direction) return entry.direction;
    return RTL.includes(language(code)) ? "rtl" : "ltr";
  }

  function configure(changes = {}) {
    options = { ...options, ...changes };
  }

  // Adds translations in code (also what the JSON files feed).
  function addTranslations(code, entries) {
    const dict = dictionaries.get(code) || {};
    Object.assign(dict, entries);
    dictionaries.set(code, dict);
    version.value = version.peek() + 1;
  }

  // The default language needs no file (its texts are the keys) unless its
  // locale entry says file: true - e.g. to hold its plural forms.
  function hasFile(code) {
    if (code !== options.defaultLocale) return true;
    const entry = options.locales.find((l) => l.code === code);
    return Boolean(entry && entry.file);
  }

  async function loadFile(code, url, { required }) {
    if (!hasFile(code) || loaded.has(url)) return;
    loaded.add(url);
    try {
      const assetLoader = root.Viraspa.utility.assetLoader;
      addTranslations(code, await assetLoader.fetchJson(url));
    } catch (err) {
      loaded.delete(url);
      if (required) console.warn(`Translations not found: ${url}`);
    }
  }

  // The app's dictionary for a language (app/i18n/<code>.json).
  const loadAppTranslations = (code) => loadFile(code, `${options.folder}/${code}.json`, { required: true });

  // A page's own translations, for routes with i18n: true.
  // A page's own file: route i18n: true means one file per language except
  // the default (its texts are the keys); a list, e.g. ["en", "sw"], names
  // exactly the languages that have a file.
  function loadPageTranslations(route, code = locale.peek()) {
    if (!route || !route.i18n || !route.page) return Promise.resolve();
    const wanted = Array.isArray(route.i18n) ? route.i18n.includes(code) : code !== options.defaultLocale;
    if (!wanted) return Promise.resolve();
    const folder = route.page.replace(/\/+$/, "");
    const base = `${folder}/${folder.split("/").pop()}`;
    return loadFile(code, `${base}.i18n.${code}.json`, { required: true });
  }

  // Picks the language at startup: the user's saved choice, else the
  // browser's languages, else the default.
  function initialLocale() {
    const codes = options.locales.map((l) => l.code);
    if (!codes.length) return options.defaultLocale;
    try {
      const saved = options.rememberChoice && root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      if (saved && codes.includes(saved)) return saved;
    } catch {
      // storage blocked
    }
    for (const wanted of (root.navigator && root.navigator.languages) || []) {
      const exact = codes.find((c) => c.toLowerCase() === wanted.toLowerCase());
      if (exact) return exact;
      const same = codes.find((c) => language(c) === language(wanted));
      if (same) return same;
    }
    return options.defaultLocale;
  }

  function applyDocumentLanguage() {
    if (!root.document) return;
    root.document.documentElement.lang = locale.peek();
    root.document.documentElement.dir = direction();
  }

  async function setLocale(code, { remember = true } = {}) {
    const codes = options.locales.map((l) => l.code);
    if (codes.length && !codes.includes(code)) throw new Error(`Language "${code}" is not in Viraspa.i18n locales (${codes.join(", ")}).`);
    await loadAppTranslations(code);
    const routes = (root.Viraspa && root.Viraspa.routes) || [];
    await Promise.all(routes.filter((r) => r.i18n && loadedPage.has(r.name)).map((r) => loadPageTranslations(r, code)));
    locale.value = code;
    applyDocumentLanguage();
    if (remember && options.rememberChoice) {
      try {
        root.localStorage.setItem(STORAGE_KEY, code);
      } catch {
        // storage blocked
      }
    }
    translateEverywhere();
    if (root.Viraspa && root.Viraspa.core && root.Viraspa.core.emit) root.Viraspa.core.emit("localeChanged", { locale: code, direction: direction() });
  }

  // Called by the framework at startup.
  async function start() {
    const code = initialLocale();
    await loadAppTranslations(code);
    locale.value = code;
    applyDocumentLanguage();
  }

  const loadedPage = new Set();
  // Called by the router before a page renders.
  async function prepareRoute(route) {
    if (!route || !route.i18n) return;
    loadedPage.add(route.name);
    await loadPageTranslations(route);
  }

  function interpolate(text, params) {
    if (!params) return text;
    return String(text).replace(/\{(\w+)\}/g, (match, key) => (params[key] === undefined || params[key] === null ? match : String(params[key])));
  }

  // t("{count} user", { count: 2 }) - live in templates (reads the language).
  function t(key, params) {
    const code = locale.value;
    void version.value; // re-run when translations load
    const dict = dictionaries.get(code) || {};
    let entry = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
    if (entry && typeof entry === "object") {
      const count = params && params.count !== undefined ? Number(params.count) : NaN;
      let category = "other";
      if (!isNaN(count)) {
        if (entry[`=${count}`] !== undefined) category = `=${count}`;
        else {
          try {
            category = new Intl.PluralRules(code).select(count);
          } catch {
            category = count === 1 ? "one" : "other";
          }
        }
      }
      entry = entry[category] ?? entry.other ?? key;
    }
    return interpolate(entry, params);
  }

  // data-i18n / data-i18n-attr inside `node` (an element, document or shadow root).
  function translate(node) {
    if (!node || !node.querySelectorAll) return;
    const list = [];
    if (node.matches && node.matches("[data-i18n],[data-i18n-attr]")) list.push(node);
    list.push(...node.querySelectorAll("[data-i18n],[data-i18n-attr]"));
    for (const el of list) {
      if (el.hasAttribute("data-i18n")) {
        let key = el.getAttribute("data-i18n");
        if (!key) {
          key = el.textContent.trim().replace(/\s+/g, " ");
          el.setAttribute("data-i18n", key);
        }
        const text = t(key);
        if (el.textContent !== text) el.textContent = text;
      }
      for (const attr of (el.getAttribute("data-i18n-attr") || "").split(/[\s,]+/).filter(Boolean)) {
        const store = `data-i18n-${attr}`;
        if (!el.hasAttribute(store)) el.setAttribute(store, el.getAttribute(attr) || "");
        el.setAttribute(attr, t(el.getAttribute(store)));
      }
    }
  }

  function translateEverywhere(node = root.document) {
    if (!node) return;
    translate(node);
    for (const el of node.querySelectorAll("*")) if (el.shadowRoot) translateEverywhere(el.shadowRoot);
  }

  return {
    configure,
    start,
    setLocale,
    prepareRoute,
    addTranslations,
    t,
    translate,
    translateEverywhere,
    direction,
    locale, // a signal: Viraspa.i18n.locale.value
    locales: () => options.locales.map((l) => ({ ...l })),
    defaultLocale: () => options.defaultLocale,
  };
});
