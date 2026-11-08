// bundle.js - writes a faster copy of the site: fewer requests and smaller
// files, with the same behaviour. Optional: a site works the same with or
// without it, and the source folder is never changed.
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { defineTool } = require("./lib/options");
const files = require("./lib/files");
const { bundleSite } = require("./lib/bundle");

const tool = defineTool({
  name: "bundle.js",
  summary: "writes a faster copy of the site: bundled framework and app files, packed templates, compacted code, preloads.",
  description: [
    "Optional: the site works the same without it. The source folder is never changed; the result goes to",
    "--output-folder (or is done by deploy.js --bundle on the release it deploys). Steps (each can be turned off):",
    "  framework  viraspa/viraspa.bundle.js: the framework's files plus the core components, in order.",
    "  app        app/app.bundle.js (+ app.bundle.css): the files listed in app/config/startup.js, in order;",
    "             startup.js is rewritten to load them. Remote (CDN) files keep their own place in the order.",
    "  pack       app/viraspa-pack.js: page and component templates, models, component CSS and manifests,",
    "             served from memory instead of one request each (pages' own .js and .css still load on demand).",
    "  compact    comments, indentation and blank lines removed from .js and .css (no renaming, no rewriting).",
    "  preload    <link rel=\"preload\"> tags in index.html for the bundles.",
    "Files stay where they were too, so anything that loads them directly keeps working.",
  ].join("\n"),
  usage: "node node-tools/bundle.js [flags]",
  configSection: "bundle",
  options: [
    { key: "outputFolder", type: "string", valueName: "folder", default: "bundled", description: "Where the bundled copy goes (relative to the repository root; outside the site folder)." },
    { key: "framework", type: "boolean", default: true, description: "Bundle the framework's files (--no-framework to skip)." },
    { key: "app", type: "boolean", default: true, description: "Bundle the app's startup files (--no-app to skip)." },
    { key: "pack", type: "boolean", default: true, description: "Pack templates, models and component CSS (--no-pack to skip)." },
    { key: "compact", type: "boolean", default: true, description: "Remove comments and indentation (--no-compact to skip)." },
    { key: "preload", type: "boolean", default: true, description: "Add preload tags to index.html (--no-preload to skip)." },
    { key: "components", type: "string", valueName: "startup|all", default: "startup", description: "Which official components go into the app bundle and the pack: \"startup\" (those in startup.js components, those in index.html, and what they need; the others load when first used) or \"all\"." },
    { key: "dryRun", type: "boolean", default: false, configurable: false, description: "Show the result without writing it." },
  ],
  examples: ["node node-tools/bundle.js", "node node-tools/bundle.js --output-folder D:\\out\\site --no-compact", "node node-tools/deploy.js --target production --bundle"],
});

// Every file of the site, except the tools' settings and generated leftovers.
function readSite(siteFolder) {
  const out = {};
  for (const rel of files.listFiles(siteFolder)) {
    if (rel === "app/project-viraspa.json" || /\.(installing|previous)\//.test(rel)) continue;
    out[rel] = fs.readFileSync(path.join(siteFolder, ...rel.split("/")));
  }
  return out;
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

function sizes(site, rel) {
  if (!site[rel]) return "";
  const buf = site[rel];
  return `${rel}: ${kb(buf.length)}, ${kb(zlib.gzipSync(buf, { level: 9 }).length)} gzip, ${kb(zlib.brotliCompressSync(buf).length)} brotli`;
}

function runBundle({ siteFolder, options }) {
  const repoRoot = path.dirname(siteFolder);
  const output = path.resolve(repoRoot, options.outputFolder);
  const isInside = (child, parent) => {
    const rel = path.relative(parent, child);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  };
  if (isInside(output, siteFolder)) throw new Error("The output folder can't be inside the site folder.");
  if (isInside(siteFolder, output)) throw new Error("The output folder can't contain the site folder.");

  const { site, report } = bundleSite(readSite(siteFolder), options);
  for (const line of report) console.log(`  ${line}`);
  for (const name of ["viraspa/viraspa.bundle.js", "app/app.bundle.js", "app/app.bundle.css", "app/viraspa-pack.js"]) {
    const line = sizes(site, name);
    if (line) console.log(`  ${line}`);
  }
  if (options.dryRun) {
    console.log(`Dry run: would write ${Object.keys(site).length} files to ${output}.`);
    return { site, output };
  }
  files.replaceFolder(output, site);
  console.log(`Wrote ${Object.keys(site).length} files to ${output}. Try it: node node-tools/serve.js --site-folder "${output}"`);
  return { site, output };
}

if (require.main === module) {
  tool.run((parsed) => runBundle(parsed));
}

module.exports = { tool, runBundle, readSite };
