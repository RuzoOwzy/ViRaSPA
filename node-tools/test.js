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
    "",
    "Other engines and phones (optional, through Playwright, which you install once outside the project):",
    "  --engine firefox | webkit | chromium (Edge/Chrome through Playwright), or a comma list;",
    "  --device \"iPhone 15\" | \"Pixel 7\" | ... (Playwright's device list: screen size, touch, user agent),",
    "     or a comma list. A device alone uses its own engine (iPhone: WebKit, Pixel: Chromium).",
    "Playwright is found from --playwright-folder (a folder where `npm install playwright` was run),",
    "the VIRASPA_PLAYWRIGHT environment variable, or the usual Node module lookup. Its browsers are",
    "taken from a browsers/ folder beside node_modules when there is one (PLAYWRIGHT_BROWSERS_PATH).",
  ].join("\n"),
  usage: "node node-tools/test.js [flags]",
  configSection: "test",
  options: [
    { key: "node", type: "boolean", default: true, description: "Run the Node tests (--no-node to skip)." },
    { key: "browser", type: "boolean", default: true, description: "Run the browser tests (--no-browser to skip)." },
    { key: "browserPath", type: "string", valueName: "path", default: "", description: "Edge or Chrome to use (found automatically when omitted)." },
    { key: "waitMs", type: "number", default: 30000, description: "How long the browser tests may take (virtual time)." },
    { key: "engine", type: "string", valueName: "names", default: "", description: "firefox, webkit or chromium (comma list) through Playwright; empty: the installed Edge or Chrome." },
    { key: "device", type: "string", valueName: "names", default: "", description: "Playwright device profiles, e.g. \"iPhone 15,Pixel 7\" (comma list)." },
    { key: "playwrightFolder", type: "string", valueName: "folder", default: "", description: "Where Playwright is installed (the folder holding node_modules/playwright)." },
    { key: "bundled", type: "boolean", default: false, description: "Run the browser tests against a bundled copy of the site (bundle.js, all steps) instead." },
    { key: "benchmark", type: "boolean", default: false, description: "Instead of the tests, run tests/benchmark.html (DOM operations, ViRaSPA against vanilla JS) through Playwright and print the times; --engine picks the browsers (default chromium: Playwright's own, else Edge or Chrome)." },
    { key: "benchmarkRuns", type: "number", default: 10, description: "Runs per benchmark operation (the median is reported)." },
  ],
  examples: ["node node-tools/test.js", "node node-tools/test.js --bundled", "node node-tools/test.js --no-node --engine firefox,webkit --playwright-folder D:\\tools\\playwright", "node node-tools/test.js --no-node --device \"iPhone 15,Pixel 7\"", "node node-tools/test.js --no-browser", "node node-tools/test.js --browser-path /usr/bin/chromium"],
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

// ---- Playwright (other engines, phone profiles) ------------------------------
function loadPlaywright(folder) {
  const candidates = [folder, process.env.VIRASPA_PLAYWRIGHT].filter(Boolean);
  for (const base of candidates) {
    try {
      const resolved = require.resolve("playwright", { paths: [path.resolve(base)] });
      const browsers = path.join(path.resolve(base), "browsers");
      if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(browsers)) process.env.PLAYWRIGHT_BROWSERS_PATH = browsers;
      return require(resolved);
    } catch {
      // try the next place
    }
  }
  try {
    return require("playwright");
  } catch {
    throw new Error("Playwright was not found. Install it once outside the project (npm install playwright, then npx playwright install firefox webkit) and pass --playwright-folder <that folder>.");
  }
}

async function launch(pw, engine) {
  const type = pw[engine];
  if (!type) throw new Error(`Unknown engine "${engine}" (use chromium, firefox or webkit).`);
  if (engine !== "chromium") return type.launch();
  // Chromium: Playwright's own if installed, else the installed Edge or Chrome.
  for (const channel of [undefined, "msedge", "chrome"]) {
    try {
      return await type.launch(channel ? { channel } : {});
    } catch (err) {
      if (channel === "chrome") throw err;
    }
  }
  return null;
}

async function runPlaywrightTests(siteFolder, options, { engine, device }) {
  const pw = loadPlaywright(options.playwrightFolder);
  const profile = device ? pw.devices[device] : null;
  if (device && !profile) throw new Error(`Unknown device "${device}". Examples: ${Object.keys(pw.devices).filter((d) => /iPhone 1[45]|Pixel [78]|Galaxy S|iPad/.test(d) && !/landscape/.test(d)).slice(0, 8).join(", ")}.`);
  const engineName = engine || (profile && profile.defaultBrowserType) || "chromium";
  const { createServer } = require("./serve");
  const server = createServer({ siteFolder, usePrerendered: false });
  await new Promise((resolve) => server.listen(0, "localhost", resolve));
  const url = `http://localhost:${server.address().port}/tests/run.html`;
  const browser = await launch(pw, engineName);
  console.log(`\nBrowser tests (${engineName} ${browser.version()}${device ? `, ${device}` : ""}, ${url}):`);
  try {
    const contextOptions = profile ? { ...profile } : {};
    if (engineName === "firefox") delete contextOptions.isMobile; // Firefox can't emulate a mobile viewport
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    await page.goto(url);
    await page.waitForSelector("#test-results-json", { state: "attached", timeout: options.waitMs });
    const summary = JSON.parse(await page.textContent("#test-results-json"));
    for (const r of summary.results) console.log(`  ${r.ok ? "✔" : "✖"} ${r.name}${r.ok ? "" : `\n      ${r.error}`}`);
    for (const message of pageErrors) console.log(`  (page error: ${message})`);
    console.log(`  ${summary.passed} passed, ${summary.failed} failed`);
    return summary.failed === 0;
  } catch (err) {
    console.log(`  The browser tests did not finish: ${err.message.split("\n")[0]}`);
    return false;
  } finally {
    await browser.close();
    server.close();
  }
}

// ---- the DOM benchmark (tests/benchmark.html) ------------------------------
async function runBenchmark(siteFolder, options, engine) {
  const pw = loadPlaywright(options.playwrightFolder);
  const { createServer } = require("./serve");
  const server = createServer({ siteFolder, usePrerendered: false });
  await new Promise((resolve) => server.listen(0, "localhost", resolve));
  const url = `http://localhost:${server.address().port}/tests/benchmark.html?auto&runs=${options.benchmarkRuns}`;
  const browser = await launch(pw, engine);
  console.log(`\nDOM benchmark (${engine} ${browser.version()}, ${options.benchmarkRuns} runs each, median, ms):`);
  try {
    const page = await (await browser.newContext()).newPage();
    await page.goto(url);
    await page.waitForFunction(() => window.benchmarkResults, null, { timeout: 600000, polling: 500 });
    const { results, mean } = await page.evaluate(() => window.benchmarkResults);
    const width = Math.max(...results.map((r) => r.name.length));
    console.log(`  ${"Operation".padEnd(width)}  Vanilla   ViRaSPA   Factor`);
    for (const r of results) console.log(`  ${r.name.padEnd(width)}  ${r.vanilla.toFixed(2).padStart(7)}   ${r.viraspa.toFixed(2).padStart(7)}   ${r.factor.toFixed(2)}×`);
    console.log(`  ${"Geometric mean".padEnd(width)}                      ${mean.toFixed(2)}×`);
    return true;
  } catch (err) {
    console.log(`  The benchmark did not finish: ${err.message.split("\n")[0]}`);
    return false;
  } finally {
    await browser.close();
    server.close();
  }
}

if (require.main === module) {
  tool.run(async ({ options, siteFolder }) => {
    const repoRoot = path.dirname(siteFolder);
    if (options.benchmark) {
      const engines = String(options.engine || "chromium").split(",").map((s) => s.trim()).filter(Boolean);
      let done = true;
      for (const engine of engines) done = (await runBenchmark(siteFolder, options, engine)) && done;
      if (!done) process.exitCode = 1;
      return;
    }
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
        const list = (text) => String(text || "").split(",").map((s) => s.trim()).filter(Boolean);
        const engines = list(options.engine);
        const devices = list(options.device);
        if (!engines.length && !devices.length) {
          ok = (await runBrowserTests(folder, options)) && ok;
        } else {
          const runs = [];
          for (const engine of engines.length ? engines : [""]) for (const device of devices.length ? devices : [""]) runs.push({ engine, device });
          for (const run of runs) ok = (await runPlaywrightTests(folder, options, run)) && ok;
        }
      } finally {
        if (temp) fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
      }
    }
    console.log(ok ? "\nAll tests passed." : "\nSome tests failed.");
    if (!ok) process.exitCode = 1;
  });
}

module.exports = { tool };
