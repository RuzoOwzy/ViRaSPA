// serve.js - the ViRaSPA development server. Run from the repository root:
//   node node-tools/serve.js            (see --help)
// Serves the site folder as it is (no build step). Browsers need a server,
// not file://, because pages fetch their .html/.model.json files.
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { defineTool } = require("./lib/options");
const { routePattern } = require("./lib/routes");

const tool = defineTool({
  name: "serve.js",
  summary: "serves the ViRaSPA site folder over http://localhost for development.",
  description: [
    "Serves files as they are, with:",
    "  - the SPA fallback: a path without a file extension gets index.html, so the router can show the page;",
    "  - prerendered pages: /about is answered from prerendered/about/index.html when that file exists;",
    "  - real 404s: with prerendered/routes.json present, unknown addresses get index.html with status 404;",
    "  - with --head-lookups <file>, app pages get their own head tags (title, description, preview image).",
    "  - Cache-Control: no-cache plus ETags, so the browser always gets your latest edits cheaply;",
    "  - app/project-viraspa.json and dot-files are never served (they may hold local paths).",
  ].join("\n"),
  usage: "node node-tools/serve.js [flags]",
  configSection: "devServer",
  // --site-folder may also point at a deployed release (which has no project file).
  allowWithoutProject: true,
  options: [
    { key: "port", type: "number", default: 8027, env: "PORT", description: "The port to listen on." },
    {
      key: "host",
      type: "string",
      valueName: "address",
      default: "localhost",
      env: "VIRASPA_HOST",
      description: 'The address to listen on. Use "0.0.0.0" to allow other devices on your network.',
    },
    { key: "logRequests", type: "boolean", default: false, description: "Print one line per request." },
    {
      key: "headLookups",
      type: "string",
      valueName: "file",
      default: "",
      description: "A .js file with head lookups for dynamic pages (README \"Dynamic pages\"): app pages get their title, description and preview image in index.html.",
    },
  ],
  examples: [
    "node node-tools/serve.js",
    "node node-tools/serve.js --port 8030",
    "node node-tools/serve.js --port 8030 --save        (remember 8030 in app/project-viraspa.json)",
    "node node-tools/serve.js --site-folder D:\\Projects\\Shop\\site",
  ],
});

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
};

const NEVER_SERVED = [/(^|\/)\./, /^\/app\/project-viraspa\.json$/i];

function createServer({ siteFolder, logRequests, usePrerendered = true, headLookups = "" }) {
  const root = path.resolve(siteFolder);
  // Optional head injection for app pages (node-tools/lib/head-injector.js).
  let injector = null;
  if (headLookups) {
    const loaded = require(path.resolve(headLookups));
    const { createHeadInjector } = require("./lib/head-injector");
    injector = createHeadInjector({ siteFolder: root, siteAddress: loaded.siteAddress || "", lookups: loaded.lookups || loaded, reload: true });
  }

  // prerendered/routes.json (written by prerender.js) lists the app's known
  // routes: other extensionless paths get index.html with a 404 status, so
  // search engines don't index addresses that don't exist.
  function knownRoutes() {
    if (!usePrerendered) return null;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(root, "prerendered", "routes.json"), "utf8"));
      return (data.routes || []).map((p) => routePattern(p)); // "/people/:id" matches /people/3
    } catch {
      return null;
    }
  }

  function normalizeRoute(p) {
    const trimmed = p.length > 1 ? p.replace(/\/+$/, "") : p;
    return (trimmed || "/").toLowerCase();
  }

  // Resolves a URL path inside the site folder; null if it would escape it.
  function resolveInside(urlPath) {
    const full = path.resolve(root, "." + urlPath);
    return full === root || full.startsWith(root + path.sep) ? full : null;
  }

  function statFile(file) {
    try {
      const stat = fs.statSync(file);
      return stat.isFile() ? stat : null;
    } catch {
      return null;
    }
  }

  function sendFile(req, res, file, stat, status = 200) {
    const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    const headers = {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
      ETag: etag,
      "Last-Modified": stat.mtime.toUTCString(),
      "X-Content-Type-Options": "nosniff",
    };
    if (status === 200 && req.headers["if-none-match"] === etag) {
      res.writeHead(304, headers);
      res.end();
      return 304;
    }
    headers["Content-Length"] = stat.size;
    res.writeHead(status, headers);
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(file).pipe(res);
    return status;
  }

  function sendText(res, status, text) {
    res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" });
    res.end(text);
    return status;
  }

  async function handle(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      return sendText(res, 405, "Method not allowed");
    }

    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      return sendText(res, 400, "Bad request");
    }
    if (urlPath.includes("\0")) return sendText(res, 400, "Bad request");
    if (NEVER_SERVED.some((pattern) => pattern.test(urlPath))) return sendText(res, 404, `Not found: ${urlPath}`);

    const isPage = path.extname(urlPath) === "";
    // A route such as /about (or /): a prerendered copy if there is one.
    if (isPage && usePrerendered) {
      const prerendered = resolveInside(path.posix.join("/prerendered", urlPath, "index.html"));
      const prerenderedStat = prerendered && statFile(prerendered);
      if (prerenderedStat) return sendFile(req, res, prerendered, prerenderedStat);
    }

    const target = resolveInside(urlPath === "/" ? "/index.html" : urlPath);
    if (!target) return sendText(res, 403, "Forbidden");

    const stat = statFile(target);
    if (stat) return sendFile(req, res, target, stat);

    if (isPage && injector) {
      const result = await injector(urlPath);
      if (result) {
        res.writeHead(result.status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
        res.end(req.method === "HEAD" ? undefined : result.html);
        return result.status;
      }
    }

    if (isPage) {
      // index.html for the client-side router - with status 404 when the
      // known-routes list says the address doesn't exist. (A missing file
      // WITH an extension is a genuinely missing asset: plain 404.)
      const index = path.join(root, "index.html");
      const indexStat = statFile(index);
      const known = knownRoutes();
      const status = known && !known.some((pattern) => pattern.test(urlPath)) ? 404 : 200;
      if (indexStat) return sendFile(req, res, index, indexStat, status);
    }
    return sendText(res, 404, `Not found: ${urlPath}`);
  }

  return http.createServer((req, res) => {
    const started = Date.now();
    handle(req, res)
      .catch((err) => {
        console.error(err);
        return res.headersSent ? 500 : sendText(res, 500, "Server error");
      })
      .then((status) => {
        if (logRequests) console.log(`${status} ${req.method} ${req.url} (${Date.now() - started} ms)`);
      });
  });
}

if (require.main === module) {
  tool.run(({ options, sources }) => {
    const server = createServer(options);
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Error: port ${options.port} is already in use. Choose another with --port <number>.`);
      } else {
        console.error(`Error: ${err.message}`);
      }
      process.exitCode = 1;
    });
    server.listen(options.port, options.host, () => {
      const shownHost = options.host === "0.0.0.0" ? "localhost" : options.host;
      console.log(`ViRaSPA dev server: http://${shownHost}:${options.port}/`);
      console.log(`Serving ${options.siteFolder} (site folder ${sources.siteFolder}, port from ${sources.port}). Ctrl+C stops it.`);
    });
  });
}

module.exports = { tool, createServer };
