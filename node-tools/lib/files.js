// File helpers for the node tools: listing, SHA-256 checksums, globs,
// safe folder replacement, and reading .zip files (no dependencies).
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

const toPosix = (p) => p.split(path.sep).join("/");

// JSON from a file or buffer; tolerates the byte-order mark some Windows
// editors write at the start of UTF-8 files.
function parseJson(textOrBuffer) {
  return JSON.parse(String(textOrBuffer).replace(/^﻿/, ""));
}

function readJson(file) {
  return parseJson(fs.readFileSync(file, "utf8"));
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// Every file under `folder` (relative, forward slashes), sorted. Dot-files
// and dot-folders are skipped.
function listFiles(folder) {
  const out = [];
  (function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(toPosix(path.relative(folder, full)));
    }
  })(folder);
  return out.sort();
}

function fileChecksum(file) {
  return `sha256-${sha256(fs.readFileSync(file))}`;
}

// One checksum for a whole installed folder: it changes if any file is
// added, removed or edited. Format "sha256-<hex>".
function folderChecksum(folder, { exclude = [] } = {}) {
  const lines = listFiles(folder)
    .filter((rel) => !exclude.includes(rel))
    .map((rel) => `${rel}\0${sha256(fs.readFileSync(path.join(folder, rel)))}\n`);
  return `sha256-${sha256(Buffer.from(lines.join(""), "utf8"))}`;
}

// Same as folderChecksum, from { path: Buffer } in memory (before writing).
function filesChecksum(files) {
  const lines = Object.keys(files)
    .sort()
    .map((rel) => `${rel}\0${sha256(files[rel])}\n`);
  return `sha256-${sha256(Buffer.from(lines.join(""), "utf8"))}`;
}

// "css/*.css", "webfonts/**", "icons/*.svg" -> RegExp. "*" stays within a
// folder; "**" crosses folders.
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
      if (glob[i + 1] === "/") i++;
    } else if (ch === "*") re += "[^/]*";
    else if (ch === "?") re += "[^/]";
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

function matchesAny(rel, globs) {
  if (!globs || !globs.length) return true;
  return globs.some((glob) => globToRegExp(glob).test(rel));
}

// Writes { relPath: Buffer } into `destination`, replacing it in one step:
// files go to "<destination>.installing" first, then the old folder is
// moved away and the new one moved in. A failure leaves the old one intact.
function replaceFolder(destination, files) {
  const staging = `${destination}.installing`;
  const old = `${destination}.previous`;
  fs.rmSync(staging, { recursive: true, force: true });
  for (const [rel, data] of Object.entries(files)) {
    const target = path.join(staging, ...rel.split("/"));
    if (!target.startsWith(staging + path.sep)) throw new Error(`Unsafe file path "${rel}".`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
  fs.rmSync(old, { recursive: true, force: true });
  if (fs.existsSync(destination)) fs.renameSync(destination, old);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(staging, destination);
  fs.rmSync(old, { recursive: true, force: true });
}

// ---- zip ------------------------------------------------------------------
// Reads a .zip into { "path/in/zip": Buffer } (stored and deflated entries).
function readZip(file) {
  const data = fs.readFileSync(file);
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
    if (data.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`${file} is not a zip file.`);
  const count = data.readUInt16LE(eocd + 10);
  let offset = data.readUInt32LE(eocd + 16);
  if (offset === 0xffffffff) throw new Error(`${file} is a ZIP64 archive, which is not supported.`);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (data.readUInt32LE(offset) !== 0x02014b50) throw new Error(`${file}: damaged central directory.`);
    const method = data.readUInt16LE(offset + 10);
    const compressedSize = data.readUInt32LE(offset + 20);
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const localOffset = data.readUInt32LE(offset + 42);
    // Zips made on Windows may use backslashes; paths here always use "/".
    const name = data.toString("utf8", offset + 46, offset + 46 + nameLength).replace(/\\/g, "/");
    offset += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith("/")) continue;
    const localNameLength = data.readUInt16LE(localOffset + 26);
    const localExtraLength = data.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = data.subarray(start, start + compressedSize);
    if (method === 0) files[name] = Buffer.from(raw);
    else if (method === 8) files[name] = zlib.inflateRawSync(raw);
    else throw new Error(`${file}: "${name}" uses an unsupported compression method (${method}).`);
  }
  return files;
}

module.exports = {
  parseJson,
  readJson,
  toPosix,
  sha256,
  listFiles,
  fileChecksum,
  folderChecksum,
  filesChecksum,
  globToRegExp,
  matchesAny,
  replaceFolder,
  readZip,
};
