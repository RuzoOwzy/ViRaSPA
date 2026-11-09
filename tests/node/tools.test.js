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
const { compactJs, compactCss, topLevelDeclarations } = require("../../node-tools/lib/compact");
const { bundleSite } = require("../../node-tools/lib/bundle");
const vm = require("vm");

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
    const all = rules.files.map((f) => f.content).join("\n");
    assert.match(all, /about/);
    assert.match(all, /prerendered/);
    assert.match(all, /no-cache/);
  }
  assert.deepEqual(serverRules.generate("nginx", ["/"]).files.map((f) => f.fileName), ["nginx-http.conf", "nginx-server.conf"]);
  assert.equal(serverRules.generate("none", []), null);
});

test("sources: built-in and template locations", () => {
  const official = sources.findSource("official", {});
  assert.match(sources.itemBase(official, { kind: "component", name: "vs-card", version: "0.1.0" }), /ViRaSPA-Extensions@vs-card-v0\.1\.0\/ViRaSPA-Extensions\/components\/vs-card$/);
  assert.match(sources.itemBase(official, { kind: "helper", name: "forms", version: "0.1.0" }), /ViRaSPA-Extensions@forms-v0\.1\.0\/ViRaSPA-Extensions\/helpers\/forms$/);
  const kinded = { name: "y", type: "folder", location: "../ViRaSPA-Extensions/ViRaSPA-Extensions/{kind}/{name}" };
  assert.equal(sources.itemBase(kinded, { kind: "helper", name: "forms", version: "0.1.0" }), "../ViRaSPA-Extensions/ViRaSPA-Extensions/helpers/forms");
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

test("compact: comments and indentation go, strings, templates and regexes stay", () => {
  const source = [
    "// first remark",
    "(function () {",
    "  /* block */ const url = \"http://x // not a comment\";",
    "  const re = /\\/\\*[^*]*\\*\\//g; // regex with comment-like text",
    "  const t = `  keep   ${ 1 + 1 }  spaces // here`;",
    "  return a / b / c; /*! licence */",
    "})();",
  ].join("\n");
  const out = compactJs(source);
  assert.ok(!out.includes("first remark") && !out.includes("block"));
  assert.ok(out.includes('"http://x // not a comment"'));
  assert.ok(out.includes("/\\/\\*[^*]*\\*\\//g"));
  assert.ok(out.includes("`  keep   ${ 1 + 1 }  spaces // here`"));
  assert.ok(out.includes("/*! licence */"));
  assert.ok(!/^\s/m.test(out), "no indentation left");
  new vm.Script(out);
  assert.equal(compactCss("a {\n  color: red; /* x */\n  content: \"/* y */\";\n}\n"), 'a {\ncolor: red;\ncontent: "/* y */";\n}\n');
});

test("compact: every framework and app file still parses", () => {
  for (const rel of files.listFiles(SITE)) {
    if (!rel.endsWith(".js") || rel.startsWith("lib/")) continue;
    const out = compactJs(fs.readFileSync(path.join(SITE, rel), "utf8"));
    assert.doesNotThrow(() => new vm.Script(out, { filename: rel }), rel);
    assert.equal(compactJs(out), out, `${rel}: compacting twice changes nothing`);
  }
});

test("compact: top-level declarations", () => {
  assert.deepEqual(topLevelDeclarations("(function () { var a = 1; })(); window.x = function () {};"), []);
  assert.deepEqual(topLevelDeclarations("const a = 1;\nfunction b() {}\nclass C {}").map((d) => d.name), ["a", "b", "C"]);
});

test("bundle: framework, app, pack and preload on an in-memory site", () => {
  const site = {};
  for (const rel of files.listFiles(SITE)) if (!rel.startsWith("lib/")) site[rel] = fs.readFileSync(path.join(SITE, rel));
  const { site: out, report } = bundleSite(site);
  assert.ok(out["viraspa/viraspa.bundle.js"] && out["app/app.bundle.js"] && out["app/viraspa-pack.js"]);
  assert.match(out["viraspa/viraspa.js"].toString(), /FRAMEWORK_SCRIPTS = \["viraspa\.bundle\.js"\]/);
  assert.match(out["app/config/startup.js"].toString(), /app\/app\.bundle\.js/);
  assert.match(out["index.html"].toString(), /rel="preload" href="viraspa\/viraspa\.bundle\.js\?v=/);
  assert.match(out["viraspa/viraspa.bundle.js"].toString(), /components\.provide\("vs-header"/);
  for (const name of ["viraspa/viraspa.bundle.js", "app/app.bundle.js", "app/viraspa-pack.js"]) new vm.Script(out[name].toString(), { filename: name });
  assert.equal(site["viraspa/viraspa.js"].toString().includes("viraspa.bundle.js"), false, "the input is not changed");
  assert.ok(!report.some((line) => /not isolated/.test(line)), report.join("\n"));

  // Official components: only those needed at startup (vs-popup, from
  // startup.js components) are bundled and packed; the others load when used.
  const app = out["app/app.bundle.js"].toString();
  const pack = out["app/viraspa-pack.js"].toString();
  assert.match(app, /components\.provide\("vs-popup"/);
  assert.doesNotMatch(app, /components\.provide\("vs-table"/);
  assert.match(pack, /components\/vs-popup\/vs-popup\.css/);
  assert.doesNotMatch(pack, /components\/vs-table\/vs-table\.css/);
  assert.match(pack, /components\/vs-table\/component-viraspa\.json/, "manifests stay in the pack");
  const all = bundleSite(site, { components: "all" }).site["app/app.bundle.js"].toString();
  assert.match(all, /components\.provide\("vs-table"/);
  assert.throws(() => bundleSite(site, { components: "some" }), /startup" or "all/);
});

test("routes: parameters match the same way in the tools and in the browser", () => {
  const browser = require("../../ViRaSPA/viraspa/core/route-paths.js");
  const cases = ["/people/3", "/People/3/", "/people", "/people/3/x", "/about", "/ABOUT/", "/a/b%20c/d"];
  for (const routePath of ["/people/:id", "/about", "/a/:x/d", "/"]) {
    const tool = routes.routePattern(routePath);
    for (const p of cases) assert.equal(tool.test(p), browser.compile(routePath).regex.test(p), `${routePath} vs ${p}`);
  }
  const rules = serverRules.generate("apache", ["/", "/people/:id"]).content;
  assert.match(rules, /people\/\[\^\/\]\+/);

  // IIS (checked on a real IIS 10 with URL Rewrite): the known-routes test
  // reads the matched path {R:0} (no leading "/"), and the 404 page is
  // served as a file so the status stays 404 ("ExecuteURL" turned it into 200).
  const webConfig = serverRules.generate("iis", ["/", "/about", "/people/:id"]).content;
  assert.match(webConfig, /input="\{R:0\}" pattern="\^\(about\|people\/\[\^\/\]\+\)\?\/\?\$"/);
  assert.doesNotMatch(webConfig, /\{URL\}/);
  assert.match(webConfig, /<error statusCode="404" path="index\.html" responseMode="File" \/>/);
});

test("head injector: parameters, lookups, 404 and private pages", async () => {
  const { createHeadInjector } = require("../../node-tools/lib/head-injector");
  const inject = createHeadInjector({
    siteFolder: SITE,
    siteAddress: "https://example.com",
    lookups: {
      person: async ({ id }) => (id === "3" ? { name: "Clementine <B>", company: "Romaguera" } : null),
    },
  });
  const found = await inject("/People/3/");
  assert.equal(found.status, 200);
  assert.match(found.html, /<title>Clementine &lt;B&gt; · ViRaSPA Sample<\/title>/);
  assert.match(found.html, /og:description" content="Clementine &lt;B&gt; works at Romaguera\./);
  assert.match(found.html, /canonical" href="https:\/\/example\.com\/people\/3"/);
  assert.equal((await inject("/people/999")).status, 404);
  const privatePage = await inject("/dashboard");
  assert.equal(privatePage.status, 200);
  assert.doesNotMatch(privatePage.html, /og:title/);
  assert.equal(await inject("/no-such-page"), null);
  const failing = createHeadInjector({ siteFolder: SITE, lookups: { person: async () => { throw new Error("db down"); } } });
  const fallback = await failing("/people/3");
  assert.equal(fallback.status, 200);
  assert.match(fallback.html, /<title>Person · ViRaSPA<\/title>/);
});
