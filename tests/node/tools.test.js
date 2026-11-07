// Node tests for the node tools' building blocks.
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const files = require("../../node-tools/lib/files");
const serverRules = require("../../node-tools/lib/server-rules");
const routes = require("../../node-tools/lib/routes");
const { defineTool, kebab } = require("../../node-tools/lib/options");
const sources = require("../../node-tools/lib/sources");
const { withHeadTags } = require("../../node-tools/prerender");

const SITE = path.join(__dirname, "..", "..", "ViRaSPA");

test("options: flags are config keys in kebab-case", () => {
  assert.equal(kebab("outputFolder"), "output-folder");
  assert.equal(kebab("renderLevel"), "render-level");
  const tool = defineTool({ name: "x.js", summary: "", usage: "", configSection: "x", options: [{ key: "port", type: "number", default: 1 }] });
  assert.match(tool.helpText(), /--port <number>\s+x\.port/);
});

test("files: zip round trip and folder checksums", () => {
  const entries = { "a.txt": Buffer.from("hello"), "dir/b.txt": Buffer.from("x".repeat(1000)) };
  const zip = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "vs-test-")), "t.zip");
  fs.writeFileSync(zip, files.writeZip(entries));
  const back = files.readZip(zip);
  assert.equal(back["a.txt"].toString(), "hello");
  assert.equal(back["dir/b.txt"].length, 1000);
  assert.equal(files.filesChecksum(back), files.filesChecksum(entries));
});

test("files: globs", () => {
  assert.ok(files.matchesAny("webfonts/fa-solid.woff2", ["webfonts/*.woff2"]));
  assert.ok(!files.matchesAny("webfonts/sub/x.woff2", ["webfonts/*.woff2"]));
  assert.ok(files.matchesAny("a/b/c.md", ["**/*.md"]));
});

test("routes: the sample's routes load in Node", () => {
  const { routes: list } = routes.loadRoutes(SITE);
  assert.ok(list.find((r) => r.path === "/about"));
  const head = routes.resolveHead(list.find((r) => r.path === "/about"), { siteAddress: "https://x.example", fallbackTitle: "", fallbackDescription: "" });
  assert.equal(head.canonical, "https://x.example/about");
});

test("server rules: every server type mentions the known routes", () => {
  for (const type of ["iis", "apache", "nginx"]) {
    const rules = serverRules.generate(type, ["/", "/about"]);
    assert.match(rules.content, /about/);
    assert.match(rules.content, /prerendered/);
  }
  assert.equal(serverRules.generate("none", []), null);
});

test("sources: built-in and template locations", () => {
  const official = sources.findSource("official", {});
  assert.match(sources.itemBase(official, { kind: "component", name: "vs-card", version: "0.1.0" }), /ViRaSPA-Components@vs-card-v0\.1\.0\/components\/vs-card$/);
  const own = { name: "x", type: "folder", location: "D:/Shared" };
  assert.equal(sources.itemBase(own, { kind: "extension", name: "owzy", version: "1.0.0" }), "D:/Shared/extensions/owzy/1.0.0");
});

test("prerender: head tags are added and escaped", () => {
  const html = withHeadTags('<html><head><title>x</title><meta name="description" content="d"></head></html>', {
    title: 'A "quoted" <title>',
    description: "Desc",
    image: "https://x/i.png",
    canonical: "https://x/a",
  });
  assert.match(html, /<title>A &quot;quoted&quot; &lt;title&gt;<\/title>/);
  assert.match(html, /og:image" content="https:\/\/x\/i\.png"/);
});
