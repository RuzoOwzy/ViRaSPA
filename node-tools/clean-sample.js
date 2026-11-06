// clean-sample.js - removes the ViRaSPA sample app from a project that
// started as a copy of the framework repository, leaving the minimal
// template (a Home and a Not Found page).
"use strict";

const fs = require("fs");
const path = require("path");
const { defineTool } = require("./lib/options");
const site = require("./lib/site");
const template = require("./lib/template");

// What the sample adds on top of the minimal template (site-relative).
const SAMPLE_PATHS = [
  "app/pages/about",
  "app/pages/contact",
  "app/pages/plain-native",
  "app/pages/features",
  "app/pages/login",
  "app/pages/dashboard",
  "app/pages/users",
  "app/pages/settings",
  "app/pages/profile",
  "app/pages/change-credentials",
  "app/pages/forbidden",
  "app/components/nav-bar",
  "app/components/footer",
  "app/components/card",
  "app/components/note",
  "app/components/native-counter",
  "app/config/session.js",
  "app/assets/app.css",
  "app/assets/x-responsive",
  "app/assets/jquery-extensions",
  "app/assets/icons",
];

const tool = defineTool({
  name: "clean-sample.js",
  summary: "removes the sample pages, components and assets, leaving a minimal app.",
  description: [
    "For a project that began as a copy of the ViRaSPA repository. It deletes the sample's pages,",
    "components and assets, and resets index.html, app/config/ and the Home and Not Found pages to",
    "the minimal template. app/project-viraspa.json, viraspa/ and installed components/libraries are",
    "kept (remove those with install.js remove). Run with --dry-run first to see the list; the real run",
    "needs --yes. It refuses to run in the ViRaSPA repository itself unless --force is given.",
  ].join("\n"),
  usage: "node node-tools/clean-sample.js --dry-run | --yes",
  configSection: "cleanSample",
  options: [
    { key: "dryRun", type: "boolean", default: false, configurable: false, description: "List what would be removed or reset; change nothing." },
    { key: "yes", type: "boolean", default: false, configurable: false, description: "Confirm: really remove the sample." },
    { key: "force", type: "boolean", default: false, configurable: false, description: "Allow running in the ViRaSPA framework repository." },
  ],
  examples: ["node node-tools/clean-sample.js --dry-run", "node node-tools/clean-sample.js --yes"],
});

if (require.main === module) {
  tool.run(({ options, siteFolder, project }) => {
    if (project.isFrameworkRepository && !options.force) {
      throw new Error("This is the ViRaSPA framework repository; its sample is part of it. (Use --force to clean it anyway.)");
    }
    if (!options.dryRun && !options.yes) throw new Error("Nothing done. Check the list with --dry-run, then run again with --yes.");

    const values = {
      PROJECT_NAME: project.projectName || path.basename(path.dirname(siteFolder)),
      RELEASE_DATE: template.nowIso(),
      FRAMEWORK_VERSION: site.frameworkVersion(siteFolder),
    };
    const verb = options.dryRun ? "would" : "";

    for (const rel of SAMPLE_PATHS) {
      const full = path.join(siteFolder, ...rel.split("/"));
      if (!fs.existsSync(full)) continue;
      console.log(`${verb ? "would remove" : "removed"}  ${rel}`);
      if (!options.dryRun) fs.rmSync(full, { recursive: true, force: true });
    }
    for (const [rel, text] of Object.entries(template.siteFiles(values))) {
      const full = path.join(siteFolder, ...rel.split("/"));
      const exists = fs.existsSync(full);
      if (exists && fs.readFileSync(full, "utf8") === text) continue;
      console.log(`${verb ? `would ${exists ? "reset" : "create"}` : exists ? "reset" : "created"}  ${rel}`);
      if (!options.dryRun) {
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, text, "utf8");
      }
    }
    console.log(options.dryRun ? "Dry run: nothing was changed." : "The sample was removed. Run node node-tools/serve.js to see the minimal app.");
  });
}

module.exports = { tool };
