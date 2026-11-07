/* ViRaSPA loader - the only framework script index.html references.
 *
 * Written in old-browser-safe syntax (var, function, no arrows or classes),
 * so even a browser too old for the framework can parse it and show a clear
 * message instead of a blank page. It:
 *   1. defines Viraspa.framework (name, version, release date),
 *   2. checks the browser features the framework needs,
 *   3. works out the cache token for the app's files (Viraspa.settings.cache),
 *   4. loads base.css and the framework's own files, in order.
 * core/bootstrap.js (the last file) then loads the app from app/config/startup.js.
 * The framework's own files are found relative to this script, so the
 * framework can be served locally (viraspa/) or from a CDN ("remote" mode).
 *
 * FRAMEWORK FILE - never edit it in a project.
 */
(function () {
  "use strict";

  // stage: "development" until the version is released, then "release".
  var FRAMEWORK = { name: "ViRaSPA", version: "0.1.0", releaseDate: "2026-11-08", stage: "development" };

  // Loaded in this order (relative to this file's folder); the browser
  // downloads them in parallel but runs them one after another.
  var FRAMEWORK_SCRIPTS = [
    "core/manifest-rules.js",
    "core/events.js",
    "core/state.js",
    "core/expressions.js",
    "utility/dom.js",
    "utility/asset-loader.js",
    "core/format.js",
    "core/i18n.js",
    "services/databinding/data-binding-service.js",
    "services/communication/http-service.js",
    "core/page-loader.js",
    "core/style-isolation.js",
    "core/component-registry.js",
    "core/component.js",
    "core/icons.js",
    "core/toast.js",
    "core/busy.js",
    "core/head.js",
    "core/session.js",
    "core/page.js",
    "core/layout.js",
    "core/router.js",
    "core/bootstrap.js",
  ];
  var BASE_STYLE = "styles/base.css";

  // Where the framework is served from: the folder of this script, as
  // written in index.html. Usually "viraspa/" (installed with the site);
  // in remote mode a CDN folder such as
  // "https://cdn.jsdelivr.net/gh/RuzoOwzy/ViRaSPA@v0.1.0/ViRaSPA/viraspa/".
  var scriptSrc = (document.currentScript && document.currentScript.getAttribute("src")) || "viraspa/viraspa.js";
  var FRAMEWORK_BASE = scriptSrc.replace(/viraspa\.js(\?.*)?$/, "");

  var Viraspa = (window.Viraspa = window.Viraspa || {});
  var settings = (Viraspa.settings = Viraspa.settings || {});
  settings.app = settings.app || {};
  settings.cache = settings.cache || {};
  settings.pageCache = settings.pageCache || {};

  Viraspa.framework = Object.freeze ? Object.freeze(FRAMEWORK) : FRAMEWORK;

  // ---- 1. Browser feature check -------------------------------------------
  function has(test) {
    try {
      return Boolean(test());
    } catch (e) {
      return false;
    }
  }

  var REQUIRED_FEATURES = [
    ["Fetch API", function () { return window.fetch; }],
    ["Promises", function () { return window.Promise; }],
    ["Request cancelling (AbortController)", function () { return window.AbortController; }],
    ["Custom elements", function () { return window.customElements; }],
    ["Shadow DOM", function () { return Element.prototype.attachShadow; }],
    ["Constructable stylesheets", function () { return "replaceSync" in CSSStyleSheet.prototype && "adoptedStyleSheets" in Document.prototype; }],
    ["structuredClone", function () { return window.structuredClone; }],
    ["History API", function () { return window.history && history.pushState; }],
    ["URL parsing", function () { return window.URL && new URL("https://a.b/c").pathname === "/c"; }],
    ["CSS variables", function () { return window.CSS && CSS.supports("--a", "0"); }],
  ];

  var missing = [];
  for (var i = 0; i < REQUIRED_FEATURES.length; i++) {
    if (!has(REQUIRED_FEATURES[i][1])) missing.push(REQUIRED_FEATURES[i][0]);
  }

  if (missing.length) {
    showUnsupported(missing);
    return;
  }

  function showUnsupported(features) {
    if (window.console && console.error) {
      console.error(FRAMEWORK.name + ": this browser is missing " + features.join(", ") + ".");
    }
    var box = document.createElement("div");
    box.setAttribute("role", "alert");
    box.style.cssText =
      "max-width:560px;margin:3rem auto;padding:1.25rem 1.5rem;font:15px/1.5 system-ui,sans-serif;" +
      "border:1px solid #e0b4b4;border-radius:8px;background:#fff6f6;color:#5a1a1a";
    var title = document.createElement("strong");
    title.appendChild(document.createTextNode("This site needs a newer browser."));
    var text = document.createElement("p");
    text.appendChild(
      document.createTextNode(
        "Please update your browser, or open the site in a current version of Edge, Chrome, Firefox or Safari. Missing: " +
          features.join(", ") + "."
      )
    );
    box.appendChild(title);
    box.appendChild(text);
    var body = document.body || document.documentElement;
    body.insertBefore(box, body.firstChild);
  }

  // ---- 2. Cache tokens ------------------------------------------------------
  // Framework files carry the framework version as their token: they change
  // only when the framework is updated. App files carry the app token, chosen
  // by Viraspa.settings.cache.strategy (see README "Cache strategies").
  var ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

  function releaseToken() {
    var version = settings.app.version || "0";
    var date = settings.app.releaseDate || "";
    if (ISO_DATE_TIME.test(date)) return version + "-" + date.replace(/\D/g, "");
    if (date) {
      console.warn('Viraspa.settings.app.releaseDate "' + date + '" is not YYYY-MM-DDTHH:mm:ss; the cache token uses the version only.');
    }
    return version;
  }

  // Keeps a token URL-safe without encoding: letters, digits, dot, hyphen.
  function cleanToken(text) {
    return String(text || "").replace(/[^A-Za-z0-9.-]/g, "").slice(0, 64);
  }

  function autoToken() {
    return fetch("release.json", { cache: "no-store" })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (release) {
        if (release && release.token) return cleanToken(release.token);
        return fetch("index.html", { method: "HEAD", cache: "no-cache" }).then(function (res) {
          return cleanToken(res.headers.get("ETag") || res.headers.get("Last-Modified"));
        });
      })
      .catch(function () {
        return "";
      })
      .then(function (token) {
        return token || releaseToken();
      });
  }

  var strategy = settings.cache.strategy || "release";
  var tokenPromise;
  if (strategy === "release") tokenPromise = Promise.resolve(releaseToken());
  else if (strategy === "custom") tokenPromise = Promise.resolve(cleanToken(settings.cache.token) || releaseToken());
  else if (strategy === "revalidate") tokenPromise = Promise.resolve("");
  else if (strategy === "auto") tokenPromise = autoToken();
  else {
    console.warn('Unknown Viraspa.settings.cache.strategy "' + strategy + '"; using "release".');
    strategy = "release";
    tokenPromise = Promise.resolve(releaseToken());
  }

  var cache = {
    strategy: strategy,
    frameworkToken: FRAMEWORK.version,
    appToken: null,
    // Resolves once the app token is known (immediately, except for "auto").
    ready: tokenPromise.then(function (token) {
      cache.appToken = token;
      return token;
    }),
    // Adds ?v=<token> to a site-relative URL the framework loads: the
    // framework version for the framework's own files, the app token for
    // everything else. Absolute URLs (https://, data:, //cdn) are returned
    // unchanged - a CDN URL already names its version.
    version: function (url) {
      if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) return url;
      var token = url.indexOf(FRAMEWORK_BASE) === 0 ? cache.frameworkToken : cache.appToken;
      if (!token) return url;
      return url + (url.indexOf("?") === -1 ? "?" : "&") + "v=" + token;
    },
  };
  Viraspa.cache = cache;
  Viraspa.core = Viraspa.core || {};
  Viraspa.core.v = cache.version;
  // The URL of a framework file, e.g. frameworkUrl("styles/base.css").
  Viraspa.core.frameworkUrl = function (path) {
    return FRAMEWORK_BASE + path;
  };

  // ---- 3. Load base.css and the framework files -----------------------------
  var baseLink = document.createElement("link");
  baseLink.rel = "stylesheet";
  baseLink.href = cache.version(FRAMEWORK_BASE + BASE_STYLE);
  Viraspa.core.baseStyleLoaded = new Promise(function (resolve) {
    baseLink.onload = resolve;
    baseLink.onerror = resolve;
  });
  document.head.appendChild(baseLink);

  for (var s = 0; s < FRAMEWORK_SCRIPTS.length; s++) {
    var script = document.createElement("script");
    script.src = cache.version(FRAMEWORK_BASE + FRAMEWORK_SCRIPTS[s]);
    script.async = false; // keep the order above
    script.onerror = onScriptError;
    document.head.appendChild(script);
  }

  function onScriptError(event) {
    console.error(FRAMEWORK.name + ": could not load " + event.target.src + ". Check that the viraspa/ folder is complete.");
  }
})();
