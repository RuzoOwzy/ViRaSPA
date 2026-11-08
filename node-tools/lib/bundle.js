// The bundling steps shared by bundle.js and deploy.js --bundle. They work
// on a site held in memory ({ "rel/path": Buffer }) and return the changed
// copy - the source site is never touched. Each step is optional:
//
//   framework   viraspa/viraspa.bundle.js: the framework's files, in the
//               loader's order, plus the core components (one request
//               instead of about 32).
//   app         app/app.bundle.js (+ .css): the files listed in
//               app/config/startup.js, in their order; startup.js is
//               rewritten to load the bundle.
//   pack        app/viraspa-pack.js: page and component templates, models,
//               component CSS and manifests, served from memory instead of
//               one request each.
//   compact     comments and indentation removed from .js and .css.
//   preload     <link rel="preload"> tags in index.html, so the bundles start
//               downloading before the loader asks for them.
"use strict";

const path = require("path");
const vm = require("vm");
const { compactJs, compactCss, topLevelDeclarations } = require("./compact");

const posix = path.posix;
const text = (buf) => (Buffer.isBuffer(buf) ? buf.toString("utf8") : String(buf));
const isLocal = (url) => !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(url);
const clean = (url) => posix.normalize(String(url).split(/[?#]/)[0].replace(/^\.?\//, ""));

// ---- reading the site's own settings ------------------------------------------
// The FRAMEWORK_SCRIPTS list from viraspa/viraspa.js.
function frameworkScripts(loaderText) {
  const match = /var FRAMEWORK_SCRIPTS = \[([\s\S]*?)\];/.exec(loaderText);
  if (!match) return null;
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function frameworkVersion(loaderText) {
  const match = /var FRAMEWORK = \{[^}]*version:\s*"([^"]+)"/.exec(loaderText);
  return match ? match[1] : "";
}

// Runs app/config/startup.js in a sandbox and returns Viraspa.startup.
function readStartup(startupText) {
  const sandbox = { window: { Viraspa: {} } };
  vm.runInNewContext(startupText, sandbox, { filename: "app/config/startup.js", timeout: 1000 });
  return sandbox.window.Viraspa.startup || {};
}

// The settings script in index.html (window.Viraspa = { settings: ... }).
function readIndexSettings(html) {
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    if (!/window\.Viraspa\s*=/.test(match[1])) continue;
    const sandbox = { window: {} };
    try {
      vm.runInNewContext(match[1], sandbox, { timeout: 1000 });
      return (sandbox.window.Viraspa && sandbox.window.Viraspa.settings) || {};
    } catch {
      return {};
    }
  }
  return {};
}

// The app's cache token, as viraspa.js works it out (null: only known in
// the browser). releaseToken: the release.json token, for strategy "auto".
function appToken(settings, releaseToken) {
  const cache = settings.cache || {};
  const app = settings.app || {};
  const cleanToken = (t) => String(t || "").replace(/[^A-Za-z0-9.-]/g, "").slice(0, 64);
  const release = () => {
    const version = app.version || "0";
    const date = app.releaseDate || "";
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(date) ? `${version}-${date.replace(/\D/g, "")}` : version;
  };
  const strategy = cache.strategy || "release";
  if (strategy === "release") return release();
  if (strategy === "custom") return cleanToken(cache.token) || release();
  if (strategy === "revalidate") return "";
  if (strategy === "auto") return releaseToken ? cleanToken(releaseToken) : null;
  return release();
}

const withToken = (url, token) => (token ? `${url}?v=${token}` : url);

// ---- joining scripts ------------------------------------------------------------
// Separate <script> files fail one at a time: an error in one doesn't stop the
// others. To keep that, each file in a bundle runs in its own error boundary
// (the error is re-thrown on its own, like an uncaught error in a separate
// file). A file that declares names at its top level (var/let/const/class/
// function) can't be wrapped without hiding those names, so it is joined as it
// is, and listed in the report. Syntax errors stop the bundle at build time.
//
// Items may also be { rel, provide: tag }: component code handed to the
// registry (Viraspa.core.components.provide), which runs it only when the
// component is first used - the same moment it would have been downloaded.
// A component file with top-level declarations is left out (it still loads
// on its own).
function joinScripts(site, list, notes) {
  const unwrapped = [];
  const skipped = [];
  const parts = list.map((item) => {
    const rel = typeof item === "string" ? item : item.rel;
    const code = text(site[rel]).replace(/\s*$/, "");
    try {
      new vm.Script(code, { filename: rel });
    } catch (err) {
      throw new Error(`${rel} has a syntax error, so it can't be bundled: ${err.message}`);
    }
    const declares = topLevelDeclarations(code).length > 0;
    if (item.provide) {
      if (declares) {
        skipped.push(rel);
        return "";
      }
      return `/* ${rel} */\nViraspa.core.components.provide(${JSON.stringify(item.provide)}, function () {\n${code}\n});\n`;
    }
    if (declares) {
      unwrapped.push(rel);
      return `/* ${rel} */\n${code}\n;\n`;
    }
    return `/* ${rel} */\ntry { (function () {\n${code}\n}).call(this); } catch (error) { setTimeout(function () { throw error; }); }\n`;
  });
  if (skipped.length) notes.push(`left to load on their own (top-level declarations): ${skipped.join(", ")}`);
  if (unwrapped.length) notes.push(`not isolated (top-level declarations, an error there stops the rest of its bundle): ${unwrapped.join(", ")}`);
  return parts.join("\n");
}

// ---- CSS url() references, made relative to a new file location ----------------
function rebaseCss(css, fromFile, toFile) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, ref) => {
    if (/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(ref)) return match;
    const target = posix.normalize(posix.join(posix.dirname(fromFile), ref));
    return `url("${posix.relative(posix.dirname(toFile), target)}")`;
  });
}

// ---- the steps -------------------------------------------------------------------
function bundleFramework(site, report) {
  const loader = site["viraspa/viraspa.js"];
  if (!loader) return report.push("framework: skipped (no viraspa/viraspa.js: the framework is not served from this site)");
  const loaderText = text(loader);
  const list = frameworkScripts(loaderText);
  if (!list) return report.push("framework: skipped (FRAMEWORK_SCRIPTS not found in viraspa.js)");
  const missing = list.filter((rel) => !site[`viraspa/${rel}`]);
  if (missing.length) throw new Error(`framework: missing ${missing.join(", ")}`);

  // Core components are handed to the registry, which runs them when first
  // used (as it would download them) - after the app's files have loaded.
  const components = Object.keys(site)
    .filter((rel) => /^viraspa\/components\/([^/]+)\/\1\.js$/.test(rel))
    .sort()
    .map((rel) => ({ rel, provide: rel.split("/")[2] }));

  const notes = [];
  const items = [...list.map((rel) => `viraspa/${rel}`), ...components];
  site["viraspa/viraspa.bundle.js"] = Buffer.from(joinScripts(site, items, notes), "utf8");
  for (const note of notes) report.push(`framework: ${note}`);
  site["viraspa/viraspa.js"] = Buffer.from(loaderText.replace(/var FRAMEWORK_SCRIPTS = \[[\s\S]*?\];/, 'var FRAMEWORK_SCRIPTS = ["viraspa.bundle.js"]; // written by bundle.js'), "utf8");
  report.push(`framework: viraspa/viraspa.bundle.js (${list.length} framework files + ${components.length} core components)`);
}

// The official components (components/<tag>/) needed at startup: those in
// startup.js `components`, those whose tag appears in index.html, and the
// components they depend on. Returns a Set of tags.
function startupComponents(site) {
  const installed = new Set(Object.keys(site).filter((rel) => /^components\/[^/]+\/component-viraspa\.json$/.test(rel)).map((rel) => rel.split("/")[1]));
  const wanted = new Set();
  let startup = {};
  try {
    startup = site["app/config/startup.js"] ? readStartup(text(site["app/config/startup.js"])) : {};
  } catch {
    // an unreadable startup.js: bundleApp reports it
  }
  for (const tag of startup.components || []) if (installed.has(tag)) wanted.add(tag);
  const index = site["index.html"] ? text(site["index.html"]) : "";
  for (const tag of installed) if (new RegExp(`<${tag}[\\s>/]`).test(index)) wanted.add(tag);
  const queue = [...wanted];
  while (queue.length) {
    const tag = queue.shift();
    let manifest = {};
    try {
      manifest = JSON.parse(text(site[`components/${tag}/component-viraspa.json`]));
    } catch {
      continue;
    }
    for (const d of manifest.dependencies || []) {
      if (d && d.kind === "component" && installed.has(d.name) && !wanted.has(d.name)) {
        wanted.add(d.name);
        queue.push(d.name);
      }
    }
  }
  return wanted;
}

function bundleApp(site, report, { packFile, components }) {
  const startupFile = "app/config/startup.js";
  if (!site[startupFile]) return report.push("app: skipped (no app/config/startup.js)");
  const startup = readStartup(text(site[startupFile]));
  const groups = startup.groups || [];

  // Local scripts are joined in order; a remote script (CDN) ends a chunk and
  // keeps its own group, so the order stays the same.
  const chunks = [];
  // The pack and the official components (components/<tag>/) come first:
  // all of them, or (components = a Set) only those needed at startup - the
  // others load on their own the first time they are used, as without a bundle.
  const official = Object.keys(site)
    .filter((rel) => /^components\/[^/]+\/component-viraspa\.json$/.test(rel))
    .filter((rel) => !components || components.has(rel.split("/")[1]))
    .sort()
    .map((rel) => {
      const tag = rel.split("/")[1];
      let script = "";
      try {
        script = JSON.parse(text(site[rel])).script || "";
      } catch {
        // an unreadable manifest: the registry reports it at runtime
      }
      const file = `components/${tag}/${script}`;
      return script && site[file] ? { rel: file, provide: tag } : null;
    })
    .filter(Boolean);
  let current = [...(packFile ? [packFile] : []), ...official];
  const styles = [];
  const separateStyles = [];
  const flush = () => {
    if (current.length) chunks.push({ files: current });
    current = [];
  };
  for (const group of groups) {
    for (const href of group.styles || []) {
      const rel = clean(href);
      if (!isLocal(href) || !site[rel] || /@import/.test(text(site[rel]))) separateStyles.push(href);
      else styles.push(rel);
    }
    for (const src of group.scripts || []) {
      if (typeof src !== "string") {
        // { src, type: "module" }: an ES-module library keeps its own place.
        flush();
        chunks.push({ remote: src });
        continue;
      }
      const rel = clean(src);
      if (isLocal(src) && site[rel]) current.push(rel);
      else if (isLocal(src)) throw new Error(`app: ${startupFile} lists ${src}, which does not exist.`);
      else {
        flush();
        chunks.push({ remote: src });
      }
    }
  }
  flush();

  const newGroups = [];
  let n = 0;
  for (const chunk of chunks) {
    if (chunk.remote) {
      newGroups.push({ name: `remote-${newGroups.length + 1}`, scripts: [chunk.remote] });
      continue;
    }
    const name = n === 0 ? "app/app.bundle.js" : `app/app.bundle-${n + 1}.js`;
    n++;
    const notes = [];
    site[name] = Buffer.from(joinScripts(site, chunk.files, notes), "utf8");
    for (const note of notes) report.push(`app: ${note}`);
    newGroups.push({ name: `bundle-${n}`, scripts: [name] });
  }
  if (styles.length) {
    site["app/app.bundle.css"] = Buffer.from(styles.map((rel) => `/* ${rel} */\n${rebaseCss(text(site[rel]), rel, "app/app.bundle.css")}`).join("\n"), "utf8");
  }
  const allStyles = [...(styles.length ? ["app/app.bundle.css"] : []), ...separateStyles];
  if (newGroups.length) newGroups[0].styles = allStyles;
  else if (allStyles.length) newGroups.push({ name: "styles", styles: allStyles });

  const rewritten = { ...startup, groups: newGroups };
  site[startupFile] = Buffer.from(
    `// Written by node-tools/bundle.js: the app's startup files are joined into\n// app/app.bundle*.js (the originals are listed in the source project).\nwindow.Viraspa.startup = ${JSON.stringify(rewritten, null, 2)};\n`,
    "utf8"
  );
  const scriptCount = chunks.reduce((sum, c) => sum + (c.files ? c.files.length : 0), 0) - (packFile ? 1 : 0) - official.length;
  const names = official.map((o) => o.provide).join(", ");
  report.push(`app: ${n} bundle file(s) from ${scriptCount} scripts${official.length ? ` and ${official.length} official component(s)${components ? ` needed at startup (${names})` : ""}` : ""}${styles.length ? ` and app/app.bundle.css from ${styles.length} stylesheets` : ""}`);
  if (components) {
    const lazy = Object.keys(site).filter((rel) => /^components\/[^/]+\/component-viraspa\.json$/.test(rel) && !components.has(rel.split("/")[1])).length;
    if (lazy) report.push(`app: ${lazy} other official component(s) load on their own when first used (components: "all" bundles them too)`);
  }
}

// Files the framework fetches as text, one request each: templates and models
// of pages and components, component CSS (applied as text) and manifests.
function packable(rel) {
  if (rel === "viraspa/styles/base.css") return true; // also applied as text inside shadow roots
  if (/^(viraspa\/components|components|app\/components)\/[^/]+\/[^/]+\.(html|css|model\.json)$/.test(rel)) return true;
  if (/^app\/pages\/[^/]+\/[^/]+\.(html|model\.json)$/.test(rel)) return true;
  if (/^(components|helpers|extensions)\/[^/]+\/(component|helper|extension)-viraspa\.json$/.test(rel)) return true;
  return false;
}

function buildPack(site, report, { compact, components }) {
  const entries = {};
  for (const rel of Object.keys(site).sort()) {
    if (!packable(rel)) continue;
    // An official component that isn't bundled fetches its own template and
    // CSS when first used; its manifest stays in the pack.
    const official = /^components\/([^/]+)\/[^/]+\.(html|css|model\.json)$/.exec(rel);
    if (official && components && !components.has(official[1])) continue;
    entries[rel] = compact && rel.endsWith(".css") ? compactCss(text(site[rel])) : text(site[rel]);
  }
  const count = Object.keys(entries).length;
  if (!count) {
    report.push("pack: nothing to pack");
    return null;
  }
  const file = "app/viraspa-pack.js";
  // Escape "</" so the text can never close a <script> by accident.
  const json = JSON.stringify(entries).replace(/<\//g, "<\\/");
  site[file] = Buffer.from(`// Written by node-tools/bundle.js: templates, models and component styles,\n// served from memory instead of one request each.\nwindow.Viraspa.utility.assetLoader.addPack(${json});\n`, "utf8");
  report.push(`pack: ${count} files (templates, models, component CSS, manifests) in ${file}`);
  return file;
}

function compactAll(site, report) {
  let before = 0;
  let after = 0;
  let count = 0;
  for (const rel of Object.keys(site)) {
    if (/^lib\//.test(rel) || /\.min\.(js|css)$/.test(rel) || rel === "app/viraspa-pack.js") continue;
    const isJs = rel.endsWith(".js");
    if (!isJs && !rel.endsWith(".css")) continue;
    const source = text(site[rel]);
    const result = isJs ? compactJs(source) : compactCss(source);
    before += Buffer.byteLength(source);
    after += Buffer.byteLength(result);
    site[rel] = Buffer.from(result, "utf8");
    count++;
  }
  report.push(`compact: ${count} .js/.css files, ${(before / 1024).toFixed(1)} KB -> ${(after / 1024).toFixed(1)} KB`);
}

function addPreloads(site, report, { releaseToken }) {
  const loader = site["viraspa/viraspa.js"] ? text(site["viraspa/viraspa.js"]) : "";
  const fwToken = frameworkVersion(loader);
  let changed = 0;
  for (const rel of Object.keys(site)) {
    if (!rel.endsWith(".html") || rel.startsWith("tests/")) continue;
    const html = text(site[rel]);
    const tag = /<script[^>]*\ssrc="viraspa\/viraspa\.js[^"]*"[^>]*><\/script>/.exec(html);
    if (!tag || html.includes('rel="preload"')) continue;
    const links = [];
    if (site["viraspa/viraspa.bundle.js"]) {
      links.push(`<link rel="preload" href="${withToken("viraspa/styles/base.css", fwToken)}" as="style">`);
      links.push(`<link rel="preload" href="${withToken("viraspa/viraspa.bundle.js", fwToken)}" as="script">`);
    }
    const token = appToken(readIndexSettings(html), releaseToken);
    if (token !== null) {
      links.push(`<link rel="preload" href="${withToken("app/config/startup.js", token)}" as="script">`);
      for (const name of Object.keys(site).filter((r) => /^app\/app\.bundle(-\d+)?\.js$/.test(r)).sort()) links.push(`<link rel="preload" href="${withToken(name, token)}" as="script">`);
      if (site["app/app.bundle.css"]) links.push(`<link rel="preload" href="${withToken("app/app.bundle.css", token)}" as="style">`);
    }
    if (!links.length) continue;
    const indent = (/\n([ \t]*)<script[^>]*viraspa\/viraspa\.js/.exec(html) || [, "  "])[1];
    const block = `<!-- Preloads written by node-tools/bundle.js -->\n${links.map((l) => indent + l).join("\n")}\n${indent}`;
    site[rel] = Buffer.from(html.replace(tag[0], block + tag[0]), "utf8");
    changed++;
  }
  report.push(changed ? `preload: added to ${changed} HTML file(s)` : "preload: no HTML file loads viraspa/viraspa.js");
}

// options: { framework, app, pack, compact, preload, components, releaseToken }
// components: "startup" (default: only the official components needed at
// startup go into the app bundle and the pack) or "all".
// Returns { site, report }; `site` is a new object (the input is not changed).
function bundleSite(input, options = {}) {
  const o = { framework: true, app: true, pack: true, compact: true, preload: true, components: "startup", ...options };
  if (o.components !== "startup" && o.components !== "all") throw new Error(`components must be "startup" or "all", not "${o.components}".`);
  const site = { ...input };
  const report = [];
  const components = o.components === "all" ? null : startupComponents(site);
  if (o.framework) bundleFramework(site, report);
  const packFile = o.pack && o.app ? buildPack(site, report, { compact: o.compact, components }) : null;
  if (o.pack && !o.app) report.push("pack: skipped (it is loaded with the app bundle; turn app on)");
  if (o.app) bundleApp(site, report, { packFile, components });
  if (o.compact) compactAll(site, report);
  if (o.preload) addPreloads(site, report, { releaseToken: o.releaseToken });
  return { site, report };
}

module.exports = { bundleSite, frameworkScripts, readStartup, appToken, rebaseCss, packable, startupComponents };
