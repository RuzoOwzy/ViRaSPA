// test.js - runs the tests: the Node tests (tests/node/*.test.js, with
// node --test) and the browser tests (<site>/tests/run.html, in the Edge or
// Chrome already installed, headless). Exit code 1 if anything fails, so CI
// can use it.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync, execFile } = require("child_process");
const { defineTool } = require("./lib/options");

const tool = defineTool({
  name: "test.js",
  summary: "runs the Node tests and the browser tests (headless Edge or Chrome).",
  description: [
    "Node tests: every tests/node/*.test.js at the repository root, with node --test.",
    "Browser tests: <site>/tests/run.html (its tests are in <site>/tests/browser/), served by a temporary",
    "local server and opened in the installed Edge or Chrome in headless mode. You can also open",
    "/tests/run.html in a normal browser while serve.js runs.",
  ].join("\n"),
  usage: "node node-tools/test.js [flags]",
  configSection: "test",
  options: [
    { key: "node", type: "boolean", default: true, description: "Run the Node tests (--no-node to skip)." },
    { key: "browser", type: "boolean", default: true, description: "Run the browser tests (--no-browser to skip)." },
    { key: "browserPath", type: "string", valueName: "path", default: "", description: "Edge or Chrome to use (found automatically when omitted)." },
    { key: "waitMs", type: "number", default: 30000, description: "How long the browser tests may take (virtual time)." },
    { key: "bundled", type: "boolean", default: false, description: "Run the browser tests against a bundled copy of the site (bundle.js, all steps) instead." },
  ],
  examples: ["node node-tools/test.js", "node node-tools/test.js --bundled", "node node-tools/test.js --no-browser", "node node-tools/test.js --browser-path /usr/bin/chromium"],
});

function runNodeTests(repoRoot) {
  const folder = path.join(repoRoot, "tests", "node");
  const testFiles = fs.existsSync(folder) ? fs.readdirSync(folder).filter((f) => f.endsWith(".test.js")).map((f) => path.join(folder, f)) : [];
  if (!testFiles.length) {
    console.log("Node tests: none found in tests/node.");
    return true;
  }
  console.log(`Node tests (${testFiles.length} files):`);
  const result = spawnSync(process.execPath, ["--test", "--test-reporter=spec", ...testFiles], { stdio: "inherit", cwd: repoRoot });
  return result.status === 0;
}

async function runBrowserTests(siteFolder, options) {
  if (!fs.existsSync(path.join(siteFolder, "tests", "run.html"))) {
    console.log("Browser tests: no tests/run.html in the site folder.");
    return true;
  }
  const { findBrowser } = require("./prerender");
  const { createServer } = require("./serve");
  const browser = findBrowser(options.browserPath);
  const server = createServer({ siteFolder, usePrerendered: false });
  await new Promise((resolve) => server.listen(0, "localhost", resolve));
  const url = `http://localhost:${server.address().port}/tests/run.html`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "viraspa-test-"));
  console.log(`\nBrowser tests (${path.basename(browser)}, ${url}):`);
  try {
    const html = await new Promise((resolve, reject) => {
      const args = ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, `--virtual-time-budget=${options.waitMs}`, "--dump-dom", url];
      execFile(browser, args, { maxBuffer: 64 * 1024 * 1024, timeout: options.waitMs + 120000, windowsHide: true }, (err, stdout) => {
        if (err && !stdout) reject(err);
        else resolve(stdout);
      });
    });
    const match = /<pre id="test-results-json"[^>]*>([\s\S]*?)<\/pre>/.exec(html);
    if (!match) {
      console.log("  The browser tests did not finish (no results found). Open /tests/run.html with serve.js to see why.");
      return false;
    }
    const decode = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    const summary = JSON.parse(decode(match[1]));
    for (const r of summary.results) console.log(`  ${r.ok ? "✔" : "✖"} ${r.name}${r.ok ? "" : `\n      ${r.error}`}`);
    console.log(`  ${summary.passed} passed, ${summary.failed} failed`);
    return summary.failed === 0;
  } finally {
    server.close();
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  }
}

if (require.main === module) {
  tool.run(async ({ options, siteFolder }) => {
    const repoRoot = path.dirname(siteFolder);
    let ok = true;
    if (options.node) ok = runNodeTests(repoRoot) && ok;
    if (options.browser) {
      let folder = siteFolder;
      let temp = null;
      if (options.bundled) {
        const { bundleSite } = require("./lib/bundle");
        const { readSite } = require("./bundle");
        const files = require("./lib/files");
        temp = fs.mkdtempSync(path.join(os.tmpdir(), "viraspa-bundled-"));
        const { site, report } = bundleSite(readSite(siteFolder));
        files.replaceFolder(path.join(temp, "site"), site);
        folder = path.join(temp, "site");
        console.log(`\nBundled copy for the browser tests (${report.length} steps):`);
        for (const line of report) console.log(`  ${line}`);
      }
      try {
        ok = (await runBrowserTests(folder, options)) && ok;
      } finally {
        if (temp) fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
      }
    }
    console.log(ok ? "\nAll tests passed." : "\nSome tests failed.");
    if (!ok) process.exitCode = 1;
  });
}

module.exports = { tool };
