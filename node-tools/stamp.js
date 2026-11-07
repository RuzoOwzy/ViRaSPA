// stamp.js - for publishers: writes the file list and per-file SHA-256
// checksums into a manifest before publishing a framework release, an
// official component or helper, or an extension.
"use strict";

const fs = require("fs");
const path = require("path");
const { defineTool } = require("./lib/options");
const files = require("./lib/files");

const tool = defineTool({
  name: "stamp.js",
  summary: "writes file lists and checksums into a framework, component, helper or extension manifest before publishing.",
  description: [
    "Only publishers need this - projects never do. It finds the *-viraspa.json in the folder,",
    "lists every file beside it (dot-files skipped) with its SHA-256 checksum, and writes the list",
    'into the manifest\'s "files". install.js then downloads exactly those files and checks each one.',
    "The manifest is also checked against the ViRaSPA rules (version, release date, names...).",
  ].join("\n"),
  usage: "node node-tools/stamp.js <folder> [flags]",
  configSection: "stamp",
  needsSite: false,
  options: [{ key: "dryRun", type: "boolean", default: false, configurable: false, description: "Show the result without writing it." }],
  examples: [
    "node node-tools/stamp.js ViRaSPA/viraspa",
    "node node-tools/stamp.js ../ViRaSPA-Extensions/components/vs-card",
    "node node-tools/stamp.js ../ViRaSPA-Extensions/helpers/forms",
    "node node-tools/stamp.js extensions/owzy --dry-run",
  ],
});

function findRules(folder) {
  // The rules ship with the framework: look upwards for viraspa/core/manifest-rules.js.
  const candidates = [path.join(folder, "core", "manifest-rules.js")];
  for (let dir = folder; ; dir = path.dirname(dir)) {
    candidates.push(path.join(dir, "viraspa", "core", "manifest-rules.js"));
    candidates.push(path.join(dir, "ViRaSPA", "viraspa", "core", "manifest-rules.js"));
    if (path.dirname(dir) === dir) break;
  }
  candidates.push(path.join(__dirname, "..", "ViRaSPA", "viraspa", "core", "manifest-rules.js"));
  const found = candidates.find((file) => fs.existsSync(file));
  return found ? require(found) : null;
}

if (require.main === module) {
  tool.run(({ command: folderArg, options }) => {
    if (!folderArg) throw new Error("Give the folder to stamp, e.g. node node-tools/stamp.js ViRaSPA/viraspa");
    const folder = path.resolve(folderArg);
    const manifestName = fs.readdirSync(folder).find((name) => /^(framework|component|helper|extension)-viraspa\.json$/.test(name));
    if (!manifestName) throw new Error(`${folder} has no framework-, component-, helper- or extension-viraspa.json.`);
    const kind = manifestName.split("-")[0];
    const manifestFile = path.join(folder, manifestName);
    const manifest = files.readJson(manifestFile);

    const rules = findRules(folder);
    if (rules) {
      const { errors, warnings } = rules.validateManifest(kind, manifest);
      warnings.forEach((w) => console.warn(`Warning: ${w}`));
      if (errors.length) throw new Error(`${manifestName} has problems:\n  - ${errors.join("\n  - ")}`);
    } else {
      console.warn("Warning: viraspa/core/manifest-rules.js not found; the manifest was not checked.");
    }

    manifest.files = files
      .listFiles(folder)
      .filter((rel) => rel !== manifestName)
      .map((rel) => ({ path: rel, checksum: files.fileChecksum(path.join(folder, rel)) }));

    if (options.dryRun) {
      console.log(JSON.stringify(manifest, null, 2));
      return;
    }
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    console.log(`Stamped ${manifestFile}: ${manifest.files.length} files (${kind} "${manifest.name}" ${manifest.version}).`);
  });
}

module.exports = { tool };
