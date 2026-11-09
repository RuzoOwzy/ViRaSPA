// Download sources for install.js: where the framework, components,
// helpers, extensions and libraries are fetched from.
//
// A source is { name, type, location }:
//   type "web"     location is a URL
//   type "folder"  location is a folder (relative paths: from the repository root)
//   type "zip"     location is a .zip file
// Layout under a location: framework/<version>/, components/<name>/<version>/,
// helpers/<name>/<version>/, extensions/<name>/<version>/, libraries/<name>/<version>/. A location with
// placeholders - {kind} {name} {version} - is used as written instead, e.g.
// "../ViRaSPA-Extensions/ViRaSPA-Extensions/{kind}/{name}".
//
// Built in (need no entry in app/project-viraspa.json):
//   "official"  the ViRaSPA and ViRaSPA-Extensions GitHub repositories through the jsDelivr CDN
//   "npm"       npm packages through jsDelivr (libraries)
"use strict";

const fs = require("fs");
const path = require("path");
const files = require("./files");

const MANIFEST_FILE = {
  framework: "framework-viraspa.json",
  component: "component-viraspa.json",
  helper: "helper-viraspa.json",
  extension: "extension-viraspa.json",
};
const KIND_FOLDER = { framework: "framework", component: "components", helper: "helpers", extension: "extensions", library: "libraries" };

const BUILT_IN = {
  official: {
    name: "official",
    type: "web",
    templates: {
      framework: "https://cdn.jsdelivr.net/gh/RuzoOwzy/ViRaSPA@v{version}/ViRaSPA/viraspa",
      component: "https://cdn.jsdelivr.net/gh/RuzoOwzy/ViRaSPA-Extensions@{name}-v{version}/ViRaSPA-Extensions/components/{name}",
      helper: "https://cdn.jsdelivr.net/gh/RuzoOwzy/ViRaSPA-Extensions@{name}-v{version}/ViRaSPA-Extensions/helpers/{name}",
    },
  },
  npm: { name: "npm", type: "npm" },
};

function fill(template, item) {
  return template.replace(/\{(kind|name|version)\}/g, (_, key) => (key === "kind" ? KIND_FOLDER[item.kind] : item[key]));
}

// Finds a source by name in the project file, else the built-in ones.
function findSource(name, project) {
  const own = (project.downloadSources || []).find((s) => s.name === name);
  if (own) return own;
  if (BUILT_IN[name]) return BUILT_IN[name];
  const known = [...(project.downloadSources || []).map((s) => s.name), ...Object.keys(BUILT_IN)];
  throw new Error(`Unknown download source "${name}". Known: ${known.join(", ")}.`);
}

// A one-off source from --from: points straight at the item's own files.
function sourceFromLocation(location) {
  if (/^https?:\/\//i.test(location)) return { name: "--from", type: "web", direct: location };
  if (/\.zip$/i.test(location)) return { name: "--from", type: "zip", location, direct: "" };
  return { name: "--from", type: "folder", direct: location };
}

// The base (URL, folder, or path inside a zip) holding an item's files.
function itemBase(source, item) {
  if (source.direct !== undefined) return source.direct;
  if (source.templates) {
    const template = source.templates[item.kind];
    if (!template) throw new Error(`Source "${source.name}" has no ${item.kind}s.`);
    return fill(template, item);
  }
  const location = source.type === "zip" ? "" : String(source.location || "").replace(/[\\/]+$/, "");
  if (/\{(kind|name|version)\}/.test(source.location || "")) return fill(source.type === "zip" ? "" : source.location, item);
  const tail = item.kind === "framework" ? `framework/${item.version}` : `${KIND_FOLDER[item.kind]}/${item.name}/${item.version}`;
  return location ? `${location}/${tail}` : tail;
}

// ---- readers: list + read files under a base --------------------------------
// GET with retries: network hiccups and 429/5xx answers are retried up to
// 4 times with growing pauses; 404 and other client errors fail at once.
async function httpGet(url, attempts = 5) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { redirect: "follow" });
    } catch (err) {
      if (attempt >= attempts) throw new Error(`${url} could not be reached: ${err.cause ? err.cause.code || err.cause.message : err.message}.`);
      await new Promise((r) => setTimeout(r, 500 * attempt));
      continue;
    }
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if ((res.status === 429 || res.status >= 500) && attempt < attempts) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      continue;
    }
    throw new Error(`${url} answered ${res.status} ${res.statusText}.`);
  }
}

function makeReader(source, base, repoRoot) {
  if (source.type === "web") {
    const root = base.replace(/\/+$/, "");
    return {
      describe: root,
      read: (rel) => httpGet(`${root}/${rel}`),
      list: null, // a web folder can't be listed: the manifest's file list is needed
    };
  }
  if (source.type === "folder") {
    const root = path.resolve(repoRoot, base);
    return {
      describe: root,
      read: async (rel) => {
        const file = path.join(root, ...rel.split("/"));
        if (!fs.existsSync(file)) throw new Error(`${file} does not exist.`);
        return fs.readFileSync(file);
      },
      list: async () => {
        if (!fs.existsSync(root)) throw new Error(`${root} does not exist.`);
        return files.listFiles(root);
      },
    };
  }
  if (source.type === "zip") {
    const zipFile = path.resolve(repoRoot, source.location);
    if (!fs.existsSync(zipFile)) throw new Error(`${zipFile} does not exist.`);
    const all = files.readZip(zipFile);
    let prefix = base ? `${base.replace(/\/+$/, "")}/` : "";
    return {
      describe: `${zipFile}${prefix ? ` (${prefix})` : ""}`,
      setPrefix: (p) => (prefix = p),
      prefixes: () => [...new Set(Object.keys(all).map((name) => name.split("/")[0] + "/"))],
      has: (rel) => Object.prototype.hasOwnProperty.call(all, prefix + rel),
      read: async (rel) => {
        if (!Object.prototype.hasOwnProperty.call(all, prefix + rel)) throw new Error(`${zipFile} has no ${prefix + rel}.`);
        return all[prefix + rel];
      },
      list: async () => Object.keys(all).filter((name) => name.startsWith(prefix)).map((name) => name.slice(prefix.length)),
    };
  }
  throw new Error(`Source "${source.name}" has an unknown type "${source.type}" (use web, folder or zip).`);
}

async function inBatches(items, size, task) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(task))));
  }
  return results;
}

// ---- fetching an item -----------------------------------------------------
// item: { kind, name, version, package?, packageFolder?, include? }
// Resolves { files: { rel: Buffer }, manifest?, from } - checked against the
// manifest's own per-file checksums when it lists them.
async function fetchItem(item, source, { repoRoot, log = () => {} }) {
  if (item.kind === "library") return fetchLibrary(item, source, { repoRoot, log });

  const base = itemBase(source, item);
  const reader = makeReader(source, base, repoRoot);
  const manifestName = MANIFEST_FILE[item.kind];

  // A zip given with --from may wrap everything in one top folder.
  if (reader.setPrefix && !base && !reader.has(manifestName)) {
    const top = reader.prefixes().find((p) => {
      reader.setPrefix(p);
      return reader.has(manifestName);
    });
    if (!top) reader.setPrefix("");
  }

  log(`  from ${reader.describe}`);
  let manifest;
  try {
    manifest = files.parseJson((await reader.read(manifestName)).toString("utf8"));
  } catch (err) {
    throw new Error(`Could not read ${manifestName} for ${item.kind} "${item.name}": ${err.message}`);
  }
  if (item.version && manifest.version !== item.version) {
    throw new Error(`${manifestName} says version ${manifest.version}, but ${item.version} was asked for.`);
  }

  let list;
  if (Array.isArray(manifest.files) && manifest.files.length) list = manifest.files;
  else if (reader.list) list = (await reader.list()).filter((rel) => rel !== manifestName).map((rel) => ({ path: rel }));
  else throw new Error(`${manifestName} has no file list, so it can't be downloaded from the web. Its publisher should run node node-tools/stamp.js on it.`);

  const result = { [manifestName]: await reader.read(manifestName) };
  await inBatches(list, 12, async (entry) => {
    if (!entry.path || entry.path.includes("..") || entry.path.startsWith("/")) throw new Error(`Unsafe path "${entry.path}" in ${manifestName}.`);
    const data = await reader.read(entry.path);
    if (entry.checksum && `sha256-${files.sha256(data)}` !== entry.checksum) {
      throw new Error(`${entry.path} does not match the checksum in ${manifestName} (damaged or changed download).`);
    }
    result[entry.path] = data;
  });
  return { files: result, manifest, from: reader.describe };
}

async function fetchLibrary(item, source, { repoRoot, log }) {
  const folder = (item.packageFolder || "").replace(/^\/+|\/+$/g, "");
  const within = (rel) => (folder ? (rel.startsWith(`${folder}/`) ? rel.slice(folder.length + 1) : null) : rel);
  const result = {};

  if (source.type === "npm") {
    if (!item.package) throw new Error(`Library "${item.name}" needs "package" (its npm name) to use the npm source.`);
    const listing = `https://data.jsdelivr.com/v1/packages/npm/${item.package}@${item.version}?structure=flat`;
    log(`  from npm ${item.package}@${item.version} (jsDelivr)`);
    const data = files.parseJson((await httpGet(listing)).toString("utf8"));
    const wanted = (data.files || [])
      .map((f) => f.name.replace(/^\//, ""))
      .map((rel) => ({ rel, local: within(rel) }))
      .filter(({ local }) => local && files.matchesAny(local, item.include));
    if (!wanted.length) throw new Error(`No files of ${item.package}@${item.version} match ${JSON.stringify(item.include || [])}.`);
    log(`  downloading ${wanted.length} files...`);
    await inBatches(wanted, 8, async ({ rel, local }) => {
      result[local] = await httpGet(`https://cdn.jsdelivr.net/npm/${item.package}@${item.version}/${rel}`);
    });
    return { files: result, from: listing };
  }

  const base = itemBase(source, item);
  const reader = makeReader(source, base, repoRoot);
  if (!reader.list) throw new Error(`Libraries can't be listed on a web source; use the "npm" source, a folder or a zip.`);
  log(`  from ${reader.describe}`);
  for (const rel of await reader.list()) {
    const local = within(rel);
    if (local && files.matchesAny(local, item.include)) result[local] = await reader.read(rel);
  }
  if (!Object.keys(result).length) throw new Error(`No files found for library "${item.name}" in ${reader.describe}.`);
  return { files: result, from: reader.describe };
}

module.exports = { BUILT_IN, MANIFEST_FILE, findSource, sourceFromLocation, fetchItem, itemBase };
