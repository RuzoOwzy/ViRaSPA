// Finds the served folder (the "site folder"): the folder that contains
// app/project-viraspa.json. Tools run from the repository root, beside the
// site folder, so they look in the current folder, the folder above
// node-tools/, and the direct sub-folders of both.
"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_FILE = path.join("app", "project-viraspa.json");

function isSiteFolder(folder) {
  return fs.existsSync(path.join(folder, PROJECT_FILE));
}

function childFolders(folder) {
  try {
    return fs
      .readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules")
      .map((entry) => path.join(folder, entry.name));
  } catch {
    return [];
  }
}

// Returns the absolute site folder, or throws an Error with advice.
function findSiteFolder(explicit) {
  if (explicit) {
    const folder = path.resolve(explicit);
    if (!isSiteFolder(folder)) {
      throw new Error(`"${folder}" is not a ViRaSPA site folder: it has no ${PROJECT_FILE}.`);
    }
    return folder;
  }

  const roots = [...new Set([process.cwd(), path.resolve(__dirname, "..", "..")])];
  for (const root of roots) {
    if (isSiteFolder(root)) return root;
    const found = childFolders(root).filter(isSiteFolder);
    if (found.length === 1) return found[0];
    if (found.length > 1) {
      throw new Error(`Found several site folders (${found.join(", ")}). Choose one with --site-folder <path>.`);
    }
  }
  throw new Error(`No site folder found (a folder containing ${PROJECT_FILE}). Run from the repository root, or pass --site-folder <path>.`);
}

function projectFilePath(siteFolder) {
  return path.join(siteFolder, PROJECT_FILE);
}

function readProjectFile(siteFolder) {
  const file = projectFilePath(siteFolder);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch (err) {
    throw new Error(`Could not read ${file}: ${err.message}`);
  }
}

function writeProjectFile(siteFolder, data) {
  fs.writeFileSync(projectFilePath(siteFolder), JSON.stringify(data, null, 2) + "\n", "utf8");
}

// The framework version, read from viraspa/viraspa.js (its single source).
function frameworkVersion(siteFolder) {
  try {
    const loader = fs.readFileSync(path.join(siteFolder, "viraspa", "viraspa.js"), "utf8");
    const match = loader.match(/var FRAMEWORK = \{[^}]*version: "([^"]+)"/);
    return match ? match[1] : "unknown";
  } catch {
    return "unknown";
  }
}

module.exports = { PROJECT_FILE, findSiteFolder, isSiteFolder, readProjectFile, writeProjectFile, projectFilePath, frameworkVersion };
