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
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  try {
    if (fs.existsSync(destination)) renameWithRetry(destination, old);
    renameWithRetry(staging, destination);
    fs.rmSync(old, { recursive: true, force: true });
  } catch (err) {
    // Windows refuses to rename a folder something holds open (a running
    // server, Explorer, an editor): copy over it in place instead.
    if (!["EPERM", "EBUSY", "EACCES"].includes(err.code)) throw err;
    if (!fs.existsSync(destination) && fs.existsSync(old)) fs.renameSync(old, destination);
    overwriteFolder(destination, files);
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function renameWithRetry(from, to, attempts = 5) {
  for (let i = 1; ; i++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (err) {
      if (i >= attempts || !["EPERM", "EBUSY", "EACCES"].includes(err.code)) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150 * i); // short pause
    }
  }
}

// Makes `folder` hold exactly `files` by writing them in place and deleting the rest.
function overwriteFolder(folder, files) {
  for (const [rel, data] of Object.entries(files)) {
    const target = path.join(folder, ...rel.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
  for (const rel of listFiles(folder)) {
    if (!Object.prototype.hasOwnProperty.call(files, rel)) fs.rmSync(path.join(folder, ...rel.split("/")), { force: true });
  }
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

// Writes { "path/in/zip": Buffer } as a .zip (deflated) and returns it.
function writeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, data] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name, "utf8");
    const deflated = zlib.deflateRawSync(data);
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = zlib.crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(useDeflate ? 8 : 0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

module.exports = {
  writeZip,
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
  overwriteFolder,
  renameWithRetry,
  readZip,
};
