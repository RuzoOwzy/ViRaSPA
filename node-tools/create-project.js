// create-project.js - creates a new ViRaSPA project folder, ready to run.
"use strict";

const fs = require("fs");
const path = require("path");
const { defineTool } = require("./lib/options");
const site = require("./lib/site");
const files = require("./lib/files");
const template = require("./lib/template");

const tool = defineTool({
  name: "create-project.js",
  summary: "creates a new ViRaSPA project: minimal app, node tools, .gitignore, and the framework.",
  description: [
    "Creates <folder> with:",
    "  node-tools/                 these tools",
    "  <site-folder-name>/         the served folder: index.html, app/ (a Home and a Not Found page),",
    "                              and viraspa/ copied from this framework (no download needed)",
    "  .gitignore, README.md       git ignores viraspa/, components/, helpers/, extensions/, lib/;",
    "                              app/project-viraspa.json pins them, so `install.js restore` brings them back.",
  ].join("\n"),
  usage: "node node-tools/create-project.js <folder> [flags]",
  configSection: "createProject",
  options: [
    { key: "projectName", type: "string", valueName: "name", configurable: false, description: 'The app\'s name (default: the folder name), e.g. "VSales".' },
    { key: "siteFolderName", type: "string", valueName: "name", default: "site", configurable: false, description: "The name of the served folder inside the project." },
    { key: "port", type: "number", default: 8027, configurable: false, description: "The new project's dev-server port." },
  ],
  examples: [
    'node node-tools/create-project.js D:\\Projects\\VSales --project-name "VSales"',
    "node node-tools/create-project.js ../shop --site-folder-name wwwroot --port 8040",
  ],
});

function copyFolder(from, to, { skip = () => false } = {}) {
  for (const rel of files.listFiles(from)) {
    if (skip(rel)) continue;
    const target = path.join(to, ...rel.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(from, ...rel.split("/")), target);
  }
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}

if (require.main === module) {
  tool.run(({ command: folderArg, options, siteFolder: sourceSite }) => {
    if (!folderArg) throw new Error("Give the new project's folder, e.g. node node-tools/create-project.js D:\\Projects\\VSales");
    const target = path.resolve(folderArg);
    if (fs.existsSync(target) && fs.readdirSync(target).length) throw new Error(`${target} already exists and is not empty.`);
    const siteName = options.siteFolderName;
    if (!/^[\w.-]+$/.test(siteName)) throw new Error(`--site-folder-name "${siteName}" must be a plain folder name.`);

    const frameworkVersion = site.frameworkVersion(sourceSite);
    const values = {
      PROJECT_NAME: options.projectName || path.basename(target),
      RELEASE_DATE: template.nowIso(),
      FRAMEWORK_VERSION: frameworkVersion,
      SITE: siteName,
    };
    const newSite = path.join(target, siteName);

    // 1. Tools and repository files.
    copyFolder(__dirname, path.join(target, "node-tools"));
    write(path.join(target, ".gitignore"), template.repoFile("gitignore.txt", values));
    write(path.join(target, "README.md"), template.repoFile("README.md", values));
    fs.copyFileSync(path.join(sourceSite, "..", ".gitattributes"), path.join(target, ".gitattributes"));

    // 2. The app from the template.
    for (const [rel, text] of Object.entries(template.siteFiles(values))) write(path.join(newSite, ...rel.split("/")), text);
    if (fs.existsSync(path.join(sourceSite, "favicon.ico"))) fs.copyFileSync(path.join(sourceSite, "favicon.ico"), path.join(newSite, "favicon.ico"));

    // 3. The framework, copied from here and pinned with its checksum.
    copyFolder(path.join(sourceSite, "viraspa"), path.join(newSite, "viraspa"));
    const project = {
      projectName: values.PROJECT_NAME,
      framework: { version: frameworkVersion, downloadSource: "official", checksum: files.folderChecksum(path.join(newSite, "viraspa")) },
      downloadSources: [],
      components: [],
      helpers: [],
      extensions: [],
      libraries: [],
      install: { downloadSource: "official" },
      devServer: { port: options.port },
    };
    site.writeProjectFile(newSite, project);

    console.log(`Created ${target} (ViRaSPA ${frameworkVersion}).`);
    console.log("Next:");
    console.log(`  cd "${target}"`);
    console.log("  git init");
    console.log("  node node-tools/serve.js");
  });
}

module.exports = { tool };
