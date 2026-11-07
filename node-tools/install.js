// install.js - installs and checks the framework, official components and
// helpers, extensions and libraries a project uses, as pinned in
// app/project-viraspa.json. No build step: it only downloads files and
// checks their SHA-256 checksums.
"use strict";

const fs = require("fs");
const path = require("path");
const { defineTool } = require("./lib/options");
const site = require("./lib/site");
const files = require("./lib/files");
const sources = require("./lib/sources");

const KINDS = ["framework", "component", "helper", "extension", "library"];
const LIST_KEY = { component: "components", helper: "helpers", extension: "extensions", library: "libraries" };

const tool = defineTool({
  name: "install.js",
  summary: "installs, updates, restores and verifies the framework, components, helpers, extensions and libraries.",
  description: [
    "What a project uses is pinned in app/project-viraspa.json: each entry has a version, the download",
    "source it came from, and a checksum of its installed files. Git can then ignore viraspa/,",
    "components/, helpers/, extensions/ and lib/: on a new computer, `restore` brings back exactly the same files.",
    "",
    "Kinds: framework (viraspa/), component (components/<name>/), helper (helpers/<name>/),",
    "extension (extensions/<name>/), library (lib/<name>/<version>/).",
    "Official components and helpers come from the ViRaSPA-Extensions repository. When one needs",
    "others (its manifest's \"dependencies\"), add installs and pins them too.",
    'Sources: "official" (ViRaSPA GitHub repositories via jsDelivr), "npm" (libraries via jsDelivr),',
    "or your own in downloadSources: { name, type: web | folder | zip, location }.",
  ].join("\n"),
  usage: "node node-tools/install.js <command> [<kind> <name>@<version>] [flags]",
  configSection: "install",
  commands: [
    { name: "add <kind> <name>@<version>", description: "Install something new and pin it (npm libraries without @version: the latest)." },
    { name: "update <kind> <name>@<version>", description: "Install another version and update the pin (framework: update framework@x.y.z)." },
    { name: "remove <kind> <name>", description: "Delete it and its pin (not the framework)." },
    { name: "restore", description: "Install everything pinned that is missing or changed, checking checksums." },
    { name: "verify", description: "Check installed files against the pinned checksums; changes nothing." },
    { name: "list", description: "Show what is pinned." },
  ],
  options: [
    {
      key: "downloadSource",
      type: "string",
      valueName: "name",
      default: "official",
      description: "The source for this run (and the default for new entries). Overrides each entry's own source.",
    },
    {
      key: "from",
      type: "string",
      valueName: "location",
      configurable: false,
      description: "Take the files straight from this URL, folder or .zip, for this run only.",
    },
    { key: "package", type: "string", valueName: "npm-name", configurable: false, description: 'Library only: its npm package, e.g. "@fortawesome/fontawesome-free".' },
    { key: "packageFolder", type: "string", valueName: "folder", configurable: false, description: 'Library only: the package folder to install from, e.g. "dist".' },
    { key: "include", type: "string", valueName: "globs", configurable: false, description: 'Library only: comma-separated files to keep, e.g. "css/all.min.css,webfonts/*".' },
    { key: "dryRun", type: "boolean", default: false, configurable: false, description: "Show what would happen; change nothing." },
  ],
  examples: [
    "node node-tools/install.js restore",
    "node node-tools/install.js restore --download-source company",
    "node node-tools/install.js verify",
    "node node-tools/install.js add component vs-card@0.1.0",
    "node node-tools/install.js add helper forms@0.1.0",
    "node node-tools/install.js add library chartjs@4.6.1 --package chart.js --package-folder dist --include chart.umd.min.js",
    "node node-tools/install.js update framework@0.3.0",
    "node node-tools/install.js add extension owzy@1.0.0 --from D:\\Downloads\\owzy-1.0.0.zip",
  ],
});

// ---- helpers --------------------------------------------------------------
function destinationOf(siteFolder, kind, entry) {
  if (kind === "framework") return path.join(siteFolder, "viraspa");
  if (kind === "component") return path.join(siteFolder, "components", entry.name);
  if (kind === "helper") return path.join(siteFolder, "helpers", entry.name);
  if (kind === "extension") return path.join(siteFolder, "extensions", entry.name);
  return path.join(siteFolder, "lib", entry.name, entry.version);
}

function pinned(project) {
  const out = [];
  if (project.framework && project.framework.managed !== false) out.push({ kind: "framework", entry: { name: "viraspa", ...project.framework } });
  for (const kind of ["component", "helper", "extension", "library"]) {
    for (const entry of project[LIST_KEY[kind]] || []) out.push({ kind, entry });
  }
  return out;
}

function findPinned(project, kind, name) {
  if (kind === "framework") return project.framework || null;
  return (project[LIST_KEY[kind]] || []).find((e) => e.name === name) || null;
}

function label(kind, entry) {
  return kind === "framework" ? `framework ${entry.version}` : `${kind} ${entry.name} ${entry.version}`;
}

function frameworkRules(siteFolder) {
  const file = path.join(siteFolder, "viraspa", "core", "manifest-rules.js");
  return fs.existsSync(file) ? require(file) : null;
}

async function latestNpmVersion(pkg) {
  const res = await fetch(`https://registry.npmjs.org/${pkg.replace("/", "%2f")}/latest`);
  if (!res.ok) throw new Error(`Could not ask npm for the latest ${pkg}: ${res.status}.`);
  return (await res.json()).version;
}

// Downloads `item` and checks it; returns { files, manifest, checksum }.
async function fetchChecked(item, ctx) {
  const source = ctx.options.from ? sources.sourceFromLocation(ctx.options.from) : sources.findSource(item.downloadSource, ctx.project);
  const fetched = await sources.fetchItem(item, source, { repoRoot: ctx.repoRoot, log: console.log });

  if (fetched.manifest && item.kind !== "framework") {
    const rules = frameworkRules(ctx.siteFolder);
    if (rules) {
      const fwVersion = site.frameworkVersion(ctx.siteFolder);
      const taken = (ctx.project.extensions || [])
        .filter((e) => e.name !== item.name)
        .map((e) => readInstalledManifest(ctx.siteFolder, "extension", e))
        .filter(Boolean)
        .map((m) => m.tagPrefix);
      const { errors, warnings } = rules.validateManifest(item.kind, fetched.manifest, {
        frameworkVersion: fwVersion === "unknown" ? undefined : fwVersion,
        takenPrefixes: taken,
      });
      warnings.forEach((w) => console.warn(`  Warning: ${w}`));
      if (errors.length) throw new Error(`${item.kind} "${item.name}" was rejected:\n  - ${errors.join("\n  - ")}`);
    }
  }
  return { ...fetched, checksum: files.filesChecksum(fetched.files) };
}

function readInstalledManifest(siteFolder, kind, entry) {
  try {
    return files.readJson(path.join(destinationOf(siteFolder, kind, entry), sources.MANIFEST_FILE[kind]));
  } catch {
    return null;
  }
}

function installedState(siteFolder, kind, entry) {
  const folder = destinationOf(siteFolder, kind, entry);
  if (!fs.existsSync(folder) || !files.listFiles(folder).length) return "missing";
  if (!entry.checksum) return "unpinned";
  return files.folderChecksum(folder) === entry.checksum ? "ok" : "changed";
}

// index.html loads viraspa/viraspa.js?v=<framework version>; keep it in step.
function updateIndexToken(siteFolder, version, dryRun) {
  const index = path.join(siteFolder, "index.html");
  if (!fs.existsSync(index)) return;
  const html = fs.readFileSync(index, "utf8");
  const updated = html.replace(/(viraspa\/viraspa\.js\?v=)[\w.-]+/g, `$1${version}`);
  if (updated !== html) {
    if (!dryRun) fs.writeFileSync(index, updated, "utf8");
    console.log(`  index.html now loads viraspa/viraspa.js?v=${version}`);
  }
}

function save(ctx) {
  if (!ctx.options.dryRun) site.writeProjectFile(ctx.siteFolder, ctx.project);
}

// ---- commands -------------------------------------------------------------
// "vs-card@0.1.0" -> { name: "vs-card", version: "0.1.0" }
function splitVersion(text) {
  const at = (text || "").lastIndexOf("@");
  return at > 0 ? { name: text.slice(0, at), version: text.slice(at + 1) } : { name: text, version: undefined };
}

async function addOrUpdate(ctx, kindArg, nameArg, isUpdate) {
  const { project, options } = ctx;
  let { name: kind, version: requested } = splitVersion(kindArg);
  let name = nameArg;
  if (kind !== "framework") ({ name, version: requested } = splitVersion(nameArg));
  if (!KINDS.includes(kind)) throw new Error(`Unknown kind "${kind}". Use: ${KINDS.join(", ")}.`);
  if (kind === "framework") {
    if (!isUpdate) throw new Error("The framework is always installed; use: install.js update framework@x.y.z");
    if (project.framework && project.framework.managed === false) {
      throw new Error('This project develops the framework itself ("framework": { "managed": false }), so install.js leaves viraspa/ alone.');
    }
    name = "viraspa";
  } else if (!name) throw new Error(`Give the ${kind}'s name, e.g. install.js ${isUpdate ? "update" : "add"} ${kind} <name>.`);

  const existing = findPinned(project, kind, name);
  if (!isUpdate && existing) throw new Error(`${kind} "${name}" is already pinned (${existing.version}). Use update to change its version.`);
  if (isUpdate && !existing && kind !== "framework") throw new Error(`${kind} "${name}" is not pinned yet. Use add.`);

  const item = {
    kind,
    name,
    version: requested,
    downloadSource: ctx.sources.downloadSource === "flag" || !existing ? options.downloadSource : existing.downloadSource,
    package: options.package || (existing && existing.package),
    packageFolder: options.packageFolder ?? (existing && existing.packageFolder),
    include: options.include ? options.include.split(",").map((s) => s.trim()).filter(Boolean) : existing && existing.include,
  };
  if (kind === "library" && !item.package && item.downloadSource === "npm") item.package = name;
  if (!item.version && kind === "library" && item.downloadSource === "npm" && !options.from) {
    item.version = await latestNpmVersion(item.package);
    console.log(`  latest ${item.package} is ${item.version}`);
  }
  if (!item.version) throw new Error(`Say which version: ${kind === "framework" ? "framework" : `${kind} ${name}`}@x.y.z`);

  console.log(`${isUpdate ? "Updating" : "Adding"} ${label(kind, item)}${options.dryRun ? " (dry run)" : ""}`);
  const fetched = await fetchChecked(item, ctx);
  const destination = destinationOf(ctx.siteFolder, kind, item);
  console.log(`  ${Object.keys(fetched.files).length} files -> ${path.relative(ctx.repoRoot, destination)}`);

  const entry = { name, version: item.version, downloadSource: options.from ? existing?.downloadSource || options.downloadSource : item.downloadSource };
  if (kind === "library") {
    if (item.package) entry.package = item.package;
    if (item.packageFolder) entry.packageFolder = item.packageFolder;
    if (item.include) entry.include = item.include;
  }
  entry.checksum = fetched.checksum;

  if (!options.dryRun) {
    if (kind === "library" && existing && existing.version !== item.version) {
      fs.rmSync(destinationOf(ctx.siteFolder, kind, existing), { recursive: true, force: true });
    }
    files.replaceFolder(destination, fetched.files);
  }

  if (kind === "framework") {
    delete entry.name;
    project.framework = { ...(project.framework || {}), ...entry };
    updateIndexToken(ctx.siteFolder, item.version, options.dryRun);
  } else {
    const list = (project[LIST_KEY[kind]] = project[LIST_KEY[kind]] || []);
    const index = list.findIndex((e) => e.name === name);
    if (index >= 0) list[index] = entry;
    else list.push(entry);
  }
  save(ctx);
  console.log(`  pinned ${label(kind, entry)} (${entry.checksum.slice(0, 19)}...)`);
  if (kind === "extension" && !isUpdate) {
    console.log(`  Next: add "${name}" to the extensions list in app/config/startup.js to load it.`);
  }
  if (kind === "helper" && !isUpdate) {
    console.log(`  Components that need "${name}" load it by themselves. To use it in your own code, add "${name}" to the helpers list in app/config/startup.js.`);
  }
  if (fetched.manifest) await addDependencies(ctx, fetched.manifest, entry, `${kind} ${name}`);
}

// Installs what a component or helper needs (manifest "dependencies":
// [{ kind, name, version }]), from the same download source. Already
// pinned ones are kept; an older pin than needed gets a warning.
async function addDependencies(ctx, manifest, parentEntry, what) {
  const rules = frameworkRules(ctx.siteFolder);
  for (const dep of manifest.dependencies || []) {
    const pin = findPinned(ctx.project, dep.kind, dep.name);
    if (pin) {
      if (rules && rules.parseVersion(pin.version) && rules.compareVersions(pin.version, dep.version) < 0) {
        console.warn(`  Warning: ${what} needs ${dep.kind} ${dep.name} ${dep.version} or newer, but ${pin.version} is pinned. Run: install.js update ${dep.kind} ${dep.name}@${dep.version}`);
      }
      continue;
    }
    console.log(`  ${what} needs ${dep.kind} ${dep.name}@${dep.version}:`);
    const depCtx = {
      ...ctx,
      options: { ...ctx.options, from: undefined, package: undefined, packageFolder: undefined, include: undefined, downloadSource: parentEntry.downloadSource || ctx.options.downloadSource },
      sources: { ...ctx.sources, downloadSource: "flag" },
    };
    await addOrUpdate(depCtx, dep.kind, `${dep.name}@${dep.version}`, false);
  }
}

// Pinned components/helpers whose installed manifest depends on kind/name.
function dependents(ctx, kind, name) {
  const out = [];
  for (const k of ["component", "helper"]) {
    for (const entry of ctx.project[LIST_KEY[k]] || []) {
      const m = readInstalledManifest(ctx.siteFolder, k, entry);
      if (m && (m.dependencies || []).some((d) => d.kind === kind && d.name === name)) out.push(`${k} ${entry.name}`);
    }
  }
  return out;
}

async function remove(ctx, kind, name) {
  if (kind === "framework") throw new Error("The framework can't be removed.");
  if (!LIST_KEY[kind]) throw new Error(`Unknown kind "${kind}". Use: component, helper, extension, library.`);
  const entry = findPinned(ctx.project, kind, name);
  if (!entry) throw new Error(`${kind} "${name}" is not pinned.`);
  const users = dependents(ctx, kind, name);
  if (users.length) console.warn(`  Warning: ${users.join(", ")} need(s) ${kind} ${name}; they will not work without it.`);
  const destination = destinationOf(ctx.siteFolder, kind, entry);
  console.log(`Removing ${label(kind, entry)}${ctx.options.dryRun ? " (dry run)" : ""}: ${path.relative(ctx.repoRoot, destination)}`);
  if (!ctx.options.dryRun) {
    fs.rmSync(destination, { recursive: true, force: true });
    if (kind === "library") {
      const parent = path.dirname(destination);
      if (fs.existsSync(parent) && !fs.readdirSync(parent).length) fs.rmdirSync(parent);
    }
  }
  ctx.project[LIST_KEY[kind]] = ctx.project[LIST_KEY[kind]].filter((e) => e !== entry);
  save(ctx);
  if (kind === "extension") console.log(`  Also remove "${name}" from the extensions list in app/config/startup.js.`);
  if (kind === "helper") console.log(`  If "${name}" is in the helpers list in app/config/startup.js, remove it there too.`);
}

async function restore(ctx) {
  let problems = 0;
  for (const { kind, entry } of pinned(ctx.project)) {
    const state = installedState(ctx.siteFolder, kind, entry);
    if (state === "ok") {
      console.log(`ok       ${label(kind, entry)}`);
      continue;
    }
    console.log(`${state.padEnd(8)} ${label(kind, entry)} - restoring${ctx.options.dryRun ? " (dry run)" : ""}`);
    try {
      // Versions come only from the pin: restore must reproduce it exactly.
      const item = { ...entry, kind, downloadSource: ctx.sources.downloadSource === "flag" ? ctx.options.downloadSource : entry.downloadSource || ctx.options.downloadSource };
      const fetched = await fetchChecked(item, ctx);
      if (entry.checksum && fetched.checksum !== entry.checksum) {
        throw new Error(`the downloaded files don't match the pinned checksum. Nothing was written. (If the new files are intended, use update.)`);
      }
      if (!ctx.options.dryRun) files.replaceFolder(destinationOf(ctx.siteFolder, kind, entry), fetched.files);
      if (!entry.checksum) {
        entry.checksum = fetched.checksum;
        save(ctx);
      }
      console.log(`         restored ${Object.keys(fetched.files).length} files`);
    } catch (err) {
      problems++;
      console.error(`         FAILED: ${err.message}`);
    }
  }
  if (problems) throw new Error(`${problems} item(s) could not be restored.`);
  console.log("All pinned items are installed.");
}

function verify(ctx) {
  let problems = 0;
  for (const { kind, entry } of pinned(ctx.project)) {
    const state = installedState(ctx.siteFolder, kind, entry);
    if (state !== "ok") problems++;
    const note = { ok: "", missing: "  (run: install.js restore)", changed: "  (files differ from the pin: restore, or update if intended)", unpinned: "  (no checksum pinned yet)" }[state];
    console.log(`${state.padEnd(8)} ${label(kind, entry)}${note}`);
  }
  if (ctx.project.framework && ctx.project.framework.managed === false) {
    console.log(`skipped  framework (developed in this repository)`);
  }
  if (problems) {
    process.exitCode = 1;
    console.log(`${problems} problem(s).`);
  } else {
    console.log("Everything matches its pin.");
  }
}

function list(ctx) {
  const items = pinned(ctx.project);
  if (ctx.project.framework && ctx.project.framework.managed === false) console.log(`framework ${ctx.project.framework.version} (developed in this repository)`);
  for (const { kind, entry } of items) console.log(`${label(kind, entry)}  [${entry.downloadSource || "?"}]`);
  if (!items.length) console.log("Nothing pinned.");
}

if (require.main === module) {
  tool.run(async (parsed) => {
    const { command, args, options, sources: optionSources, siteFolder, project } = parsed;
    const ctx = { options, sources: optionSources, siteFolder, project, repoRoot: path.dirname(siteFolder) };
    switch (command) {
      case "add":
        return addOrUpdate(ctx, args[0], args[1], false);
      case "update":
        return addOrUpdate(ctx, args[0], args[1], true);
      case "remove":
        return remove(ctx, args[0], args[1]);
      case "restore":
        return restore(ctx);
      case "verify":
        return verify(ctx);
      case "list":
        return list(ctx);
      case undefined:
        console.log(tool.helpText());
        return;
      default:
        throw new Error(`Unknown command "${command}".`);
    }
  });
}

// For other tools (deploy.js): which pinned items are not installed as pinned.
function problems(siteFolder, project) {
  return pinned(project)
    .map(({ kind, entry }) => ({ kind, entry, state: installedState(siteFolder, kind, entry) }))
    .filter((item) => item.state !== "ok");
}

module.exports = { tool, restore, problems };
