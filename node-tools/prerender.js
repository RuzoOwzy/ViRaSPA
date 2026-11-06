// prerender.js - writes ready-made copies of public pages, so search
// engines and link previews (WhatsApp, Facebook, LinkedIn, X...) see each
// page's real title, description and preview image without running
// JavaScript. Visitors still get the full app: each copy is index.html with
// the page's head tags (and, at renderLevel fullPage, its rendered content).
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { defineTool } = require("./lib/options");
const routesLib = require("./lib/routes");
const files = require("./lib/files");

const MARKER = "routes.json"; // written into every output folder

const tool = defineTool({
  name: "prerender.js",
  summary: "writes ready-made copies of public pages for search engines and link previews.",
  description: [
    "For every route with `prerender: true` (never private ones) it writes <output-folder>/<path>/index.html:",
    "index.html with that page's <title>, description, canonical address and Open Graph / Twitter preview tags.",
    'renderLevel "fullPage" also puts the page\'s rendered content inside <main id="page-root">, using the',
    "Edge or Chrome already installed on this computer in headless mode (nothing is downloaded).",
    "It also writes <output-folder>/routes.json, the list of known routes, so servers answer other",
    "addresses with a real 404 status. serve.js and the server rules from deploy.js use both.",
    "The pages are read from a temporary local server it starts itself (your own server is not touched),",
    "unless localSiteAddress is given.",
  ].join("\n"),
  usage: "node node-tools/prerender.js [flags]",
  configSection: "prerender",
  options: [
    { key: "outputFolder", type: "string", valueName: "folder", default: "prerendered", description: "Where to write, relative to the site folder (or absolute)." },
    {
      key: "liveSiteAddress",
      type: "string",
      valueName: "url",
      default: "",
      description: "The published site's address, e.g. https://vsales.example.com. Needed for canonical and preview links, which must be absolute.",
    },
    {
      key: "renderLevel",
      type: "string",
      valueName: "level",
      choices: ["headTagsOnly", "fullPage"],
      default: "headTagsOnly",
      description: "headTagsOnly: just the head tags (fast, enough for link previews). fullPage: also the page content (needs Edge or Chrome).",
    },
    { key: "localSiteAddress", type: "string", valueName: "url", default: "", description: "Read pages from this running server instead of a temporary one (fullPage only)." },
    { key: "browser", type: "string", valueName: "path", default: "", description: "Edge or Chrome to use for fullPage (found automatically when omitted)." },
    { key: "routes", type: "string", valueName: "paths", default: "", description: 'Only these paths, comma-separated, e.g. "/,/about". Default: routes with prerender: true.' },
    { key: "waitMs", type: "number", default: 5000, description: "fullPage: how long a page may take to render (virtual time)." },
    { key: "dryRun", type: "boolean", default: false, configurable: false, description: "List what would be written; write nothing." },
  ],
  examples: [
    "node node-tools/prerender.js --live-site-address https://vsales.example.com",
    "node node-tools/prerender.js --render-level fullPage --save",
    'node node-tools/prerender.js --routes "/,/about" --output-folder D:\\release\\prerendered',
  ],
});

const escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// index.html + one page's head tags.
function withHeadTags(indexHtml, head) {
  let html = indexHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(head.title)}</title>`);
  if (/<meta\s+name="description"[^>]*>/i.test(html)) {
    html = html.replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${escapeAttr(head.description)}">`);
  }
  const tags = [
    head.canonical && `<link rel="canonical" href="${escapeAttr(head.canonical)}" data-vs-head>`,
    `<meta property="og:type" content="website" data-vs-head>`,
    `<meta property="og:title" content="${escapeAttr(head.title)}" data-vs-head>`,
    head.description && `<meta property="og:description" content="${escapeAttr(head.description)}" data-vs-head>`,
    head.canonical && `<meta property="og:url" content="${escapeAttr(head.canonical)}" data-vs-head>`,
    head.image && `<meta property="og:image" content="${escapeAttr(head.image)}" data-vs-head>`,
    `<meta name="twitter:card" content="${head.image ? "summary_large_image" : "summary"}" data-vs-head>`,
    `<meta name="twitter:title" content="${escapeAttr(head.title)}" data-vs-head>`,
    head.description && `<meta name="twitter:description" content="${escapeAttr(head.description)}" data-vs-head>`,
    head.image && `<meta name="twitter:image" content="${escapeAttr(head.image)}" data-vs-head>`,
  ].filter(Boolean);
  return html.replace(/<\/head>/i, `  <!-- Prerendered by node-tools/prerender.js -->\n  ${tags.join("\n  ")}\n</head>`);
}

function findBrowser(explicit) {
  if (explicit) {
    if (!fs.existsSync(explicit)) throw new Error(`Browser not found: ${explicit}`);
    return explicit;
  }
  const pf = process.env["ProgramFiles"] || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const local = process.env.LOCALAPPDATA || "";
  const candidates = [
    path.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(local, "Google", "Chrome", "Application", "chrome.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/microsoft-edge",
  ];
  const found = candidates.find((file) => file && fs.existsSync(file));
  if (!found) throw new Error("No Edge or Chrome found for renderLevel fullPage. Give one with --browser <path>, or use headTagsOnly.");
  return found;
}

// The rendered HTML inside <main id="page-root"> for one address.
function renderPage(browser, url, waitMs, profileDir) {
  return new Promise((resolve, reject) => {
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profileDir}`,
      `--virtual-time-budget=${waitMs}`,
      "--dump-dom",
      url,
    ];
    execFile(browser, args, { maxBuffer: 64 * 1024 * 1024, timeout: waitMs + 60000, windowsHide: true }, (err, stdout) => {
      if (err && !stdout) return reject(new Error(`The browser could not render ${url}: ${err.message}`));
      const match = /<main id="page-root"[^>]*>([\s\S]*?)<\/main>/i.exec(stdout);
      if (!match) return reject(new Error(`${url} rendered without <main id="page-root">.`));
      // Only the page area: the shell and the framework's own elements are
      // rebuilt by the app in the browser.
      resolve(match[1].trim());
    });
  });
}

async function prerender({ siteFolder, options, log = console.log }) {
  const { routes } = routesLib.loadRoutes(siteFolder);
  const indexHtml = fs.readFileSync(path.join(siteFolder, "index.html"), "utf8");
  const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(indexHtml);
  const descMatch = /<meta\s+name="description"\s+content="([^"]*)"/i.exec(indexHtml);
  const outFolder = path.resolve(siteFolder, options.outputFolder);

  const wanted = options.routes
    ? options.routes.split(",").map((p) => routesLib.normalizePath(p.trim())).filter(Boolean)
    : null;
  const selected = routes.filter((r) => r.path && (wanted ? wanted.includes(routesLib.normalizePath(r.path)) : r.prerender));
  for (const r of selected.filter(routesLib.isPrivate)) log(`  skipped ${r.path}: private pages are never prerendered.`);
  const pages = selected.filter((r) => !routesLib.isPrivate(r));
  if (wanted) {
    for (const p of wanted) if (!routes.some((r) => r.path && routesLib.normalizePath(r.path) === p)) log(`  skipped ${p}: no such route.`);
  }
  if (!options.liveSiteAddress) log("  Note: no liveSiteAddress, so canonical and preview-image links are left out (they must be absolute).");

  // Safety: only replace a folder this tool made (or an empty / new one).
  if (fs.existsSync(outFolder) && fs.readdirSync(outFolder).length && !fs.existsSync(path.join(outFolder, MARKER))) {
    throw new Error(`${outFolder} exists and wasn't made by prerender.js (no ${MARKER}); choose another --output-folder.`);
  }

  const output = {};
  let server = null;
  let profileDir = null;
  try {
    let base = options.localSiteAddress.replace(/\/+$/, "");
    let browser = null;
    if (options.renderLevel === "fullPage" && pages.length) {
      browser = findBrowser(options.browser);
      if (!base) {
        const { createServer } = require("./serve");
        server = createServer({ siteFolder, usePrerendered: false });
        await new Promise((resolve) => server.listen(0, "localhost", resolve));
        base = `http://localhost:${server.address().port}`;
      }
      profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "viraspa-prerender-"));
      log(`  rendering with ${path.basename(browser)} from ${base}`);
    }

    for (const route of pages) {
      const head = routesLib.resolveHead(route, {
        siteAddress: options.liveSiteAddress,
        fallbackTitle: titleMatch ? titleMatch[1] : "",
        fallbackDescription: descMatch ? descMatch[1] : "",
      });
      if (head.dynamic) log(`  ${route.path}: its head has {{placeholders}}; the route's static values are used.`);
      let html = withHeadTags(indexHtml, head);
      if (browser) {
        const content = await renderPage(browser, `${base}${route.path}`, options.waitMs, profileDir);
        html = html.replace(/<main id="page-root">\s*<\/main>/i, `<main id="page-root">${content}</main>`);
      }
      const rel = route.path === "/" ? "index.html" : `${route.path.replace(/^\/+|\/+$/g, "")}/index.html`;
      output[rel] = Buffer.from(html, "utf8");
      log(`  ${route.path} -> ${path.relative(siteFolder, path.join(outFolder, rel))}`);
    }
  } finally {
    if (server) server.close();
    if (profileDir) fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 3 });
  }

  // Every known route (private ones too): servers answer anything else with 404.
  output[MARKER] = Buffer.from(
    JSON.stringify(
      {
        generatedBy: "node-tools/prerender.js",
        generatedAt: new Date().toISOString(),
        routes: routes.filter((r) => r.path).map((r) => routesLib.normalizePath(r.path)),
        prerendered: pages.map((r) => routesLib.normalizePath(r.path)),
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  if (!options.dryRun) files.replaceFolder(outFolder, output);
  return { outFolder, count: pages.length };
}

if (require.main === module) {
  tool.run(async ({ options, siteFolder }) => {
    console.log(`Prerendering (${options.renderLevel})${options.dryRun ? " - dry run" : ""}`);
    const { outFolder, count } = await prerender({ siteFolder, options });
    console.log(`${options.dryRun ? "Would write" : "Wrote"} ${count} page(s) and routes.json to ${outFolder}.`);
  });
}

module.exports = { tool, prerender, withHeadTags };
