// The minimal project template (node-tools/templates/project/), shared by
// create-project.js and clean-sample.js. Placeholders look like
// %%PROJECT_NAME%% so they never clash with ViRaSPA's {{ }} templates.
"use strict";

const fs = require("fs");
const path = require("path");
const files = require("./files");

const TEMPLATE = path.join(__dirname, "..", "templates", "project");

function fillText(text, values) {
  return text.replace(/%%([A-Z_]+)%%/g, (match, key) => (values[key] !== undefined ? values[key] : match));
}

// The template's site files: { "index.html": text, "app/config/routes.js": text, ... }
function siteFiles(values) {
  const root = path.join(TEMPLATE, "site");
  const out = {};
  for (const rel of files.listFiles(root)) out[rel] = fillText(fs.readFileSync(path.join(root, rel), "utf8"), values);
  return out;
}

function repoFile(name, values) {
  return fillText(fs.readFileSync(path.join(TEMPLATE, name), "utf8"), values);
}

function nowIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

module.exports = { TEMPLATE, siteFiles, repoFile, nowIso };
