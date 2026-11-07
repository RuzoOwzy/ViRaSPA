// check-server.js - checks that a running web server serves a deployed
// ViRaSPA site the way the server rules (deploy.js) promise: routes,
// prerendered pages, real 404s, no-cache for index.html, hidden tool
// settings and the right file types. Read-only: it only sends GET requests.
"use strict";

const { defineTool } = require("./lib/options");

const tool = defineTool({
  name: "check-server.js",
  summary: "checks that a running web server serves a deployed site correctly (routes, 404s, caching, file types).",
  description: [
    "Sends GET requests to --url and checks what the server rules from deploy.js promise:",
    "  - known routes (from prerendered/routes.json, or --routes) answer 200 with the app, any letter case,",
    "    with or without a trailing slash; prerendered ones answer with their prerendered copy;",
    "  - unknown addresses answer 404 with the app (its not-found page), when routes.json is deployed;",
    "  - every HTML answer (index.html, routes, prerendered pages) and release.json is sent with no-cache;",
    "  - app/project-viraspa.json is never served; missing files answer 404 (not the app);",
    "  - .js, .css, .json, .svg and .woff2 files have the right Content-Type.",
    "Run it against your own server after deploying, e.g. a staging server.",
  ].join("\n"),
  usage: "node node-tools/check-server.js --url <address> [flags]",
  configSection: "checkServer",
  needsSite: false,
  options: [
    { key: "url", type: "string", valueName: "address", default: "", description: "The site's address, e.g. http://localhost:8031" },
    { key: "routes", type: "string", valueName: "paths", default: "", description: "Comma-separated known routes, when prerendered/routes.json is not deployed." },
  ],
  examples: ["node node-tools/check-server.js --url http://localhost:8031", "node node-tools/check-server.js --url https://staging.example.com --routes /,/about"],
});

async function get(base, path) {
  const res = await fetch(new URL(path, base), { redirect: "manual", headers: { "Cache-Control": "no-cache" } });
  const body = await res.text();
  return { status: res.status, type: res.headers.get("content-type") || "", cache: res.headers.get("cache-control") || "", body, location: res.headers.get("location") };
}

const isApp = (body) => /viraspa\/viraspa\.js/.test(body);

async function check({ url, routes: routesOption }) {
  if (!url) throw new Error("Give the site's address: --url http://localhost:8031");
  const base = url.endsWith("/") ? url : `${url}/`;
  const results = [];
  const record = (name, ok, detail = "") => results.push({ name, ok, detail });

  // Known routes.
  let routes = routesOption ? routesOption.split(",").map((s) => s.trim()).filter(Boolean) : [];
  let prerendered = [];
  const listing = await get(base, "prerendered/routes.json").catch(() => null);
  const hasRoutesFile = listing && listing.status === 200;
  if (hasRoutesFile) {
    try {
      const data = JSON.parse(listing.body);
      if (!routes.length) routes = data.routes || [];
      prerendered = data.prerendered || [];
    } catch {
      record("prerendered/routes.json is valid JSON", false);
    }
  }
  if (!routes.length) routes = ["/"];

  // Home and index.html.
  const home = await get(base, "");
  record("/ answers 200 with the app", home.status === 200 && isApp(home.body), `${home.status}`);
  record("/ is sent with Cache-Control: no-cache", /no-cache|no-store|max-age=0/i.test(home.cache), home.cache || "(none)");
  const index = await get(base, "index.html");
  record("index.html is sent with Cache-Control: no-cache", /no-cache|no-store|max-age=0/i.test(index.cache), index.cache || "(none)");

  for (const pattern of routes.filter((r) => r !== "/")) {
    // A route with parameters is checked with a sample value ("/people/:id" -> "/people/1").
    const route = pattern.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, "1");
    const rel = route.replace(/^\/+/, "");
    const plain = await get(base, rel);
    const isPrerendered = prerendered.includes(route);
    const expectPrerender = isPrerendered ? /Prerendered by node-tools\/prerender\.js/.test(plain.body) : true;
    record(`${route} answers 200 with ${isPrerendered ? "its prerendered copy" : "the app"}`, plain.status === 200 && isApp(plain.body) && expectPrerender, `${plain.status}${plain.location ? ` -> ${plain.location}` : ""}`);
    record(`${route} is sent with Cache-Control: no-cache`, /no-cache|no-store|max-age=0/i.test(plain.cache), plain.cache || "(none)");
    const slash = await get(base, `${rel}/`);
    record(`${route}/ (trailing slash) answers 200`, slash.status === 200 && isApp(slash.body), `${slash.status}${slash.location ? ` -> ${slash.location}` : ""}`);
    const upper = await get(base, rel.toUpperCase());
    record(`${route.toUpperCase()} (other letter case) answers 200`, upper.status === 200 && isApp(upper.body), `${upper.status}`);
  }

  // Unknown addresses.
  const unknown = await get(base, `no-such-page-${Date.now()}`);
  if (hasRoutesFile || routesOption) {
    record("an unknown address answers 404 with the app", unknown.status === 404 && isApp(unknown.body), `${unknown.status}`);
    const deep = await get(base, `${(routes.find((r) => r !== "/" && !r.includes(":")) || "/x").replace(/^\/+/, "")}/no-such-child`);
    record("an unknown sub-address answers 404 with the app", deep.status === 404 && isApp(deep.body), `${deep.status}`);
  } else {
    record("an unknown address answers with the app (no routes.json deployed, so 200 is expected)", isApp(unknown.body), `${unknown.status}`);
  }
  const missingFile = await get(base, `app/no-such-file-${Date.now()}.js`);
  record("a missing file answers 404", missingFile.status === 404, `${missingFile.status}`);

  // Hidden and no-cache files.
  const settings = await get(base, "app/project-viraspa.json");
  record("app/project-viraspa.json is not served", settings.status === 404 || settings.status === 403, `${settings.status}`);
  const release = await get(base, "release.json");
  if (release.status === 200) record("release.json is sent with Cache-Control: no-cache", /no-cache|no-store|max-age=0/i.test(release.cache), release.cache || "(none)");

  // File types.
  const types = [
    ["viraspa/viraspa.js", /javascript/],
    ["viraspa/styles/base.css", /text\/css/],
    ["app/i18n/en.json", /json/],
    ["app/assets/icons/favicon.svg", /image\/svg\+xml/],
  ];
  for (const [path, pattern] of types) {
    const res = await get(base, path);
    if (res.status === 404) continue; // not part of this site
    record(`${path} has Content-Type ${pattern.source.replace(/\\/g, "")}`, res.status === 200 && pattern.test(res.type), `${res.status} ${res.type}`);
  }
  const css = await get(base, "lib/fontawesome/7.3.1/css/all.min.css");
  if (css.status === 200) {
    const font = /url\(["']?\.\.\/webfonts\/([^"')?#]+\.woff2)/.exec(css.body);
    if (font) {
      const res = await fetch(new URL(`lib/fontawesome/7.3.1/webfonts/${font[1]}`, base));
      record("a .woff2 font has Content-Type font/woff2", res.ok && /font\/woff2|application\/font-woff2/.test(res.headers.get("content-type") || ""), `${res.status} ${res.headers.get("content-type")}`);
    }
  }

  for (const r of results) console.log(`  ${r.ok ? "✔" : "✖"} ${r.name}${r.ok ? "" : `  (got: ${r.detail})`}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${results.length - failed} passed, ${failed} failed`);
  return { results, failed };
}

if (require.main === module) {
  tool.run(async ({ options }) => {
    console.log(`Checking ${options.url}`);
    const { failed } = await check(options);
    if (failed) process.exitCode = 1;
  });
}

module.exports = { tool, check };
