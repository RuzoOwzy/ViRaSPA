// Node.js HTTP server that serves the ViRaSPA/ folder over
// http://localhost:<port>/ - not a build step, just serves the files as-is.
// Required because browsers block fetch() of local files under file://,
// which the separate .html/.css/.js/.model.json files depend on.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "ViRaSPA");
const PORT = process.env.PORT || 8027;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function send(res, status, filePath, data) {
  const ext = path.extname(filePath);
  res.writeHead(status, { "Content-Type": MIME[ext] || "application/octet-stream" });
  res.end(data);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const filePath = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (!err) {
      send(res, 200, filePath, data);
      return;
    }

    // SPA fallback: core/router.js now does path-based routing (/about,
    // /contact, ...) via the History API, so a refresh/bookmark/shared link
    // makes the browser request that path directly. A path with no file
    // extension that didn't match a real file is one of those client
    // routes, not a missing asset - hand back index.html so the client
    // router can read location.pathname and load the right page. A path
    // WITH an extension (.js/.css/.json/image/...) that's missing is a
    // genuinely missing asset, so that still 404s.
    if (path.extname(urlPath) === "") {
      fs.readFile(path.join(ROOT, "index.html"), (fallbackErr, fallbackData) => {
        if (fallbackErr) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found: " + urlPath);
          return;
        }
        send(res, 200, "index.html", fallbackData);
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found: " + urlPath);
  });
});

server.listen(PORT, () => {
  console.log(`ViRaSPA (Node HTTP server) running at http://localhost:${PORT}/`);
});
