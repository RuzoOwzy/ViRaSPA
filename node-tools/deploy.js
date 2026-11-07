// deploy.js - copies a release of the site to a server folder (or a .zip),
// safely. A ViRaSPA site is static files, so deploying means: make sure
// everything is installed, copy only what the site needs, write the
// environment's settings, the release stamp and the server rules, then
// swap the new release in at once - and keep the previous one for rollback.
"use strict";

const fs = require("fs");
const path = require("path");
const { defineTool } = require("./lib/options");
const site = require("./lib/site");
const files = require("./lib/files");
const routesLib = require("./lib/routes");
const serverRules = require("./lib/server-rules");

// Never deployed: tool settings, docs, editor and type files, leftovers.
const ALWAYS_EXCLUDED = ["app/project-viraspa.json", "**/*.md", "**/*.d.ts", "**/*.map", "tests/**", "**/*.installing/**", "**/*.previous/**"];

const tool = defineTool({
  name: "deploy.js",
  summary: "copies a release to a server folder or a .zip: environments, server rules, safe swap, rollback.",
  description: [
    "Steps:",
    "  1. Checks that the framework, components and libraries are installed as pinned (restores them if not).",
    "  2. Prerenders public pages, with --prerender.",
    "  3. Copies the site, leaving out app/project-viraspa.json, *.md, *.d.ts, *.map, tests/ and your `exclude`.",
    "  4. Writes app/config/environment.js from the chosen environment's settings (e.g. the API address);",
    "     with --bundle, then bundles the release (bundle.js: fewer requests, smaller files; the site is unchanged).",
    '  5. Writes release.json (the cache strategy "auto" uses it) and the server rules: web.config (IIS),',
    "     .htaccess (Apache), or <destination>-nginx-http.conf and -nginx-server.conf beside it (nginx).",
    "  6. Copies into <destination>.new, then swaps: the old release becomes <destination>.previous-<time>.",
    "     --rollback swaps the newest previous release back in.",
    "Targets and environments live in app/project-viraspa.json, \"deploy\" section:",
    '  "targets": [{ "name": "production", "destination": "D:\\\\Sites\\\\vsales", "serverType": "iis",',
    '                "environment": "production", "keepPrevious": 2 }],',
    '  "environments": [{ "name": "production", "settings": { "apiBaseAddress": "https://api.example.com" } }]',
    "FTP, SSH and cloud uploads are not built in: use --zip and your provider's own tools.",
  ].join("\n"),
  usage: "node node-tools/deploy.js --target <name> | --destination <folder> | --zip <file> [flags]",
  configSection: "deploy",
  options: [
    { key: "target", type: "string", valueName: "name", default: "", description: "A target from deploy.targets." },
    { key: "destination", type: "string", valueName: "folder", default: "", description: "The server folder to deploy to (overrides the target's)." },
    {
      key: "serverType",
      type: "string",
      valueName: "type",
      choices: serverRules.SERVER_TYPES,
      default: "",
      description: "iis | apache | nginx | none: which server rules to write (overrides the target's).",
    },
    { key: "environment", type: "string", valueName: "name", default: "", description: "An environment from deploy.environments (overrides the target's)." },
    { key: "keepPrevious", type: "number", default: 2, description: "How many previous releases to keep for rollback." },
    { key: "zip", type: "string", valueName: "file", default: "", configurable: false, description: "Also (or only) write the release as a .zip." },
    { key: "prerender", type: "boolean", default: false, description: "Run prerender.js first (with its own settings)." },
    { key: "bundle", type: "boolean", default: false, description: "Bundle the release (bundle.js, with its own settings from the \"bundle\" section)." },
    { key: "rollback", type: "boolean", default: false, configurable: false, description: "Put the newest previous release back." },
    { key: "force", type: "boolean", default: false, configurable: false, description: "Deploy into a non-empty folder that doesn't hold a ViRaSPA release." },
    { key: "dryRun", type: "boolean", default: false, configurable: false, description: "Show what would happen; change nothing." },
  ],
  examples: [
    "node node-tools/deploy.js --target staging",
    "node node-tools/deploy.js --target production --prerender",
    "node node-tools/deploy.js --target production --bundle",
    "node node-tools/deploy.js --destination \\\\srv01\\wwwroot\\vsales --server-type iis --environment production",
    "node node-tools/deploy.js --zip D:\\releases\\vsales.zip --environment production --server-type apache",
    "node node-tools/deploy.js --target production --rollback",
  ],
});

// Local date and time, e.g. "20261107-143005" (also the release's cache token).
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function previousReleases(destination) {
  const parent = path.dirname(destination);
  const base = `${path.basename(destination)}.previous-`;
  if (!fs.existsSync(parent)) return [];
  return fs
    .readdirSync(parent)
    .filter((name) => name.startsWith(base))
    .sort()
    .map((name) => path.join(parent, name));
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// The target's settings; flags given on the command line win over them.
function resolveTarget(options, optionSources, project, repoRoot) {
  const section = project.deploy || {};
  let target = {};
  if (options.target) {
    target = (section.targets || []).find((t) => t.name === options.target);
    if (!target) {
      const names = (section.targets || []).map((t) => t.name);
      throw new Error(`No deploy target "${options.target}" in app/project-viraspa.json${names.length ? ` (known: ${names.join(", ")})` : ""}.`);
    }
  }
  const resolved = {
    name: target.name || "",
    destination: options.destination || target.destination || "",
    serverType: options.serverType || target.serverType || "none",
    environment: options.environment || target.environment || "",
    keepPrevious: optionSources.keepPrevious === "flag" ? options.keepPrevious : target.keepPrevious ?? options.keepPrevious,
  };
  if (resolved.destination) resolved.destination = path.resolve(repoRoot, resolved.destination);
  if (!serverRules.SERVER_TYPES.includes(resolved.serverType)) throw new Error(`serverType "${resolved.serverType}" must be one of ${serverRules.SERVER_TYPES.join(", ")}.`);
  return resolved;
}

function environmentScript(env) {
  return `// Written by node-tools/deploy.js for the "${env.name}" environment - don't edit on the server.
// Anything here is public: no secrets.
window.Viraspa.environment = ${JSON.stringify({ name: env.name, settings: env.settings || {} }, null, 2)};
`;
}

// The release's files in memory: { relPath: Buffer }.
function collect(siteFolder, exclude) {
  const out = {};
  const globs = [...ALWAYS_EXCLUDED, ...exclude];
  for (const rel of files.listFiles(siteFolder)) {
    if (files.matchesAny(rel, globs)) continue;
    out[rel] = fs.readFileSync(path.join(siteFolder, ...rel.split("/")));
  }
  return out;
}

function copyInto(folder, entries) {
  for (const [rel, data] of Object.entries(entries)) {
    const target = path.join(folder, ...rel.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
}

async function deploy({ options, siteFolder, project, sources: optionSources }) {
  const repoRoot = path.dirname(siteFolder);
  const target = resolveTarget(options, optionSources, project, repoRoot);
  const log = console.log;
  const dry = options.dryRun;

  // ---- rollback ----------------------------------------------------------
  if (options.rollback) {
    if (!target.destination) throw new Error("Rollback needs --target or --destination.");
    const previous = previousReleases(target.destination);
    if (!previous.length) throw new Error(`No previous release beside ${target.destination}.`);
    const back = previous[previous.length - 1];
    const parked = `${target.destination}.rolledback-${stamp()}`;
    log(`${dry ? "Would roll back" : "Rolling back"}: ${path.basename(back)} -> ${target.destination}`);
    if (!dry) {
      if (fs.existsSync(target.destination)) fs.renameSync(target.destination, parked);
      fs.renameSync(back, target.destination);
      log(`  the release that was live is kept as ${path.basename(parked)}`);
    }
    return;
  }

  if (!target.destination && !options.zip) throw new Error("Say where to deploy: --target <name>, --destination <folder> or --zip <file>.");
  if (target.destination && isInside(target.destination, siteFolder)) throw new Error("The destination can't be inside the site folder.");
  if (target.destination && isInside(siteFolder, target.destination)) throw new Error("The destination can't contain the site folder.");

  log(`Deploying ${project.projectName || "the site"}${target.name ? ` (target "${target.name}")` : ""}${dry ? " - dry run" : ""}`);

  // 1. Everything installed as pinned?
  const install = require("./install");
  const missing = install.problems(siteFolder, project);
  if (missing.length) {
    log(`1. ${missing.length} pinned item(s) not installed as pinned - restoring:`);
    await install.restore({
      options: { downloadSource: (project.install && project.install.downloadSource) || "official", dryRun: dry },
      sources: { downloadSource: "default" },
      siteFolder,
      project,
      repoRoot,
    });
  } else {
    log("1. Framework, components and libraries match their pins.");
  }

  // 2. Prerender.
  if (options.prerender) {
    log("2. Prerendering:");
    const pre = require("./prerender");
    const preTool = pre.tool;
    const preOptions = {};
    for (const o of preTool.options) preOptions[o.key] = (project.prerender || {})[o.key] ?? o.default;
    preOptions.dryRun = dry;
    await pre.prerender({ siteFolder, options: preOptions });
  } else {
    log("2. Prerender: skipped (add --prerender to run it).");
  }

  // 3. The files.
  const exclude = ((project.deploy || {}).exclude || []).map(String);
  const release = collect(siteFolder, exclude);
  log(`3. ${Object.keys(release).length} files collected (excluded: tool settings, *.md, *.d.ts, *.map, tests/${exclude.length ? `, ${exclude.join(", ")}` : ""}).`);

  // 4. Environment.
  if (target.environment) {
    const env = ((project.deploy || {}).environments || []).find((e) => e.name === target.environment);
    if (!env) throw new Error(`No environment "${target.environment}" in deploy.environments.`);
    release["app/config/environment.js"] = Buffer.from(environmentScript(env), "utf8");
    log(`4. Environment "${env.name}": ${Object.keys(env.settings || {}).join(", ") || "no settings"}.`);
  } else {
    log("4. Environment: unchanged (the site's own app/config/environment.js).");
  }

  // The release stamp (written in step 5; the bundle's preloads need its token).
  const releaseInfo = {
    token: stamp(),
    releasedAt: new Date().toISOString(),
    app: project.projectName || "",
    environment: target.environment || "",
    frameworkVersion: site.frameworkVersion(siteFolder),
  };

  // 4b. Bundle.
  if (options.bundle) {
    const { bundleSite } = require("./lib/bundle");
    const settings = { ...(project.bundle || {}) };
    for (const key of Object.keys(settings)) if (!["framework", "app", "pack", "compact", "preload"].includes(key)) delete settings[key];
    const result = bundleSite(release, { ...settings, releaseToken: releaseInfo.token });
    for (const key of Object.keys(release)) delete release[key];
    Object.assign(release, result.site);
    log("4b. Bundled:");
    for (const line of result.report) log(`    ${line}`);
  }

  // 5. Release stamp and server rules.
  release["release.json"] = Buffer.from(JSON.stringify(releaseInfo, null, 2) + "\n", "utf8");
  const { routes } = routesLib.loadRoutes(siteFolder);
  const knownPaths = routes.filter((r) => r.path).map((r) => routesLib.normalizePath(r.path));
  const rules = serverRules.generate(target.serverType, knownPaths);
  let besideFiles = [];
  if (rules && rules.inSite) release[rules.fileName] = Buffer.from(rules.content, "utf8");
  if (rules && !rules.inSite && target.destination) besideFiles = rules.files.map((f) => ({ file: `${target.destination}-${f.fileName}`, content: f.content }));
  const rulesNames = rules ? (rules.inSite ? rules.fileName : (besideFiles.length ? besideFiles.map((b) => path.basename(b.file)) : rules.files.map((f) => f.fileName)).join(" and ")) : "";
  log(`5. release.json (token ${releaseInfo.token})${rules ? ` and ${rulesNames}` : ", no server rules (serverType none)"}.`);

  // 6. Write.
  if (options.zip) {
    const zipFile = path.resolve(repoRoot, options.zip);
    if (isInside(zipFile, siteFolder)) throw new Error("The .zip can't be written inside the site folder.");
    if (!dry) {
      fs.mkdirSync(path.dirname(zipFile), { recursive: true });
      const entries = { ...release };
      if (rules && !rules.inSite) for (const f of rules.files) entries[f.fileName] = Buffer.from(f.content, "utf8");
      fs.writeFileSync(zipFile, files.writeZip(entries));
    }
    log(`6. ${dry ? "Would write" : "Wrote"} ${zipFile}`);
  }

  if (target.destination) {
    const dest = target.destination;
    const exists = fs.existsSync(dest) && fs.readdirSync(dest).length > 0;
    if (exists && !fs.existsSync(path.join(dest, "release.json")) && !options.force) {
      throw new Error(`${dest} is not empty and holds no ViRaSPA release (no release.json). Use --force to replace it anyway.`);
    }
    const staging = `${dest}.new`;
    // The release being replaced keeps its own token in its folder name.
    let liveToken = "";
    try {
      liveToken = files.readJson(path.join(dest, "release.json")).token || "";
    } catch {
      // not a ViRaSPA release (or none yet)
    }
    const parked = `${dest}.previous-${String(liveToken || stamp()).replace(/[^\w.-]/g, "")}`;
    log(`6. ${dry ? "Would copy" : "Copying"} to ${staging}, then swap it in${exists ? ` (the current release becomes ${path.basename(parked)})` : ""}.`);
    if (!dry) {
      fs.rmSync(staging, { recursive: true, force: true });
      copyInto(staging, release);
      try {
        if (exists || fs.existsSync(dest)) files.renameWithRetry(dest, parked);
        files.renameWithRetry(staging, dest);
      } catch (err) {
        // Windows/IIS may lock the live folder: fall back to copying over it.
        if (!["EPERM", "EBUSY", "EACCES"].includes(err.code)) throw err;
        log(`   The live folder is locked (${err.code}); copying over it instead (rollback is not available for this release).`);
        if (!fs.existsSync(dest) && fs.existsSync(parked)) fs.renameSync(parked, dest);
        files.overwriteFolder(dest, release);
        fs.rmSync(staging, { recursive: true, force: true });
      }
      for (const b of besideFiles) fs.writeFileSync(b.file, b.content, "utf8");
      // Keep only the newest `keepPrevious` previous releases.
      const previous = previousReleases(dest);
      for (const old of previous.slice(0, Math.max(0, previous.length - Math.max(0, target.keepPrevious)))) {
        fs.rmSync(old, { recursive: true, force: true });
      }
    }
    if (besideFiles.length) log(`   nginx: include ${besideFiles[0].file} in the http { } block and ${besideFiles[1].file} in the server { } block.`);
  }

  log(dry ? "Dry run: nothing was changed." : `Done: release ${releaseInfo.token}.`);
}

if (require.main === module) {
  tool.run((parsed) => deploy(parsed));
}

module.exports = { tool, deploy };
