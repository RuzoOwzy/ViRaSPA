// Head injection for dynamic pages (README "Dynamic pages"): when a server
// answers an app address such as /people/3 with index.html, it can first put
// that page's title, description and preview image into the <head>, so link
// previews (WhatsApp, Slack, social sites) and search engines see them.
//
//   const { createHeadInjector } = require("./node-tools/lib/head-injector");
//   const inject = createHeadInjector({
//     siteFolder: "ViRaSPA",
//     siteAddress: "https://vsales.example.com",
//     lookups: {
//       // route name -> async (params) => placeholder values, or null when the
//       // thing doesn't exist (the answer is then 404). Only public data!
//       person: async ({ id }) => db.publicProfile(id),
//     },
//   });
//   const { status, html } = await inject("/people/3"); // null: not an app page
//
// The route's head templates are the ones the browser uses
// (head: { title: "{{name}} on VibeNet" }), filled from the route's
// parameters and the lookup's values; a value with a missing placeholder
// falls back to the route's plain title or the site default. Private routes
// never get page details. Works in any Node server (http, Express...);
// node-tools/serve.js uses it with --head-lookups.
"use strict";

const fs = require("fs");
const path = require("path");
const routesLib = require("./routes");
const { withHeadTags } = require("../prerender");

// The browser's rules (viraspa/core/route-paths.js): static routes first.
function matchRoute(routes, appPath) {
  let withParams = null;
  for (const route of routes) {
    if (!route.path) continue;
    const pattern = routesLib.routePattern(route.path);
    if (!pattern.test(appPath)) continue;
    const keys = (route.path.match(/:[A-Za-z_][A-Za-z0-9_]*/g) || []).map((k) => k.slice(1));
    if (!keys.length) return { route, params: {} };
    if (!withParams) {
      const capture = new RegExp(pattern.source.replace(/\[\^\/\]\+/g, "([^/]+)"), "i").exec(appPath);
      const params = {};
      keys.forEach((key, i) => {
        try {
          params[key] = decodeURIComponent(capture[i + 1]);
        } catch {
          params[key] = capture[i + 1];
        }
      });
      withParams = { route, params };
    }
  }
  return withParams;
}

// A template with every {{placeholder}} filled, or "" when one has no value.
function fill(text, data) {
  if (typeof text !== "string" || !text) return "";
  let missing = false;
  const result = text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = key.split(".").reduce((v, k) => (v == null ? undefined : v[k]), data);
    if (value == null || value === "") missing = true;
    return value == null ? "" : String(value);
  });
  return missing ? "" : result;
}

function createHeadInjector({ siteFolder, siteAddress = "", lookups = {}, reload = false }) {
  const root = path.resolve(siteFolder);
  let cache = null;
  function load() {
    if (!cache || reload) {
      const { routes } = routesLib.loadRoutes(root);
      const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
      const title = (/<title>([\s\S]*?)<\/title>/i.exec(indexHtml) || [, ""])[1].trim();
      const description = (/<meta\s+name="description"\s+content="([^"]*)"/i.exec(indexHtml) || [, ""])[1];
      cache = { routes, indexHtml, title, description };
    }
    return cache;
  }

  const base = siteAddress.replace(/\/+$/, "");
  const absolute = (url) => (!url ? "" : /^https?:\/\//i.test(url) ? url : base ? `${base}/${url.replace(/^\/+/, "")}` : "");

  return async function inject(requestPath) {
    const { routes, indexHtml, title, description } = load();
    const appPath = routesLib.normalizePath(String(requestPath || "/").split(/[?#]/)[0]) === "/" ? "/" : String(requestPath).split(/[?#]/)[0].replace(/\/+$/, "");
    const found = matchRoute(routes, appPath);
    if (!found) return null;
    const { route, params } = found;
    // Private pages: the plain index.html - nothing about the page leaks.
    if (routesLib.isPrivate(route)) return { status: 200, html: indexHtml, route: route.name };

    let data = { ...params };
    const lookup = lookups[route.name];
    if (lookup) {
      let values;
      try {
        values = await lookup(params);
      } catch (err) {
        // A failing lookup must not take the page down: plain head tags.
        console.warn(`Head lookup for route "${route.name}" failed: ${err.message}`);
        values = {};
      }
      if (values === null || values === false) return { status: 404, html: indexHtml, route: route.name };
      data = { ...data, ...(values || {}) };
    }
    const head = route.head || {};
    const resolved = {
      title: fill(head.title, data) || route.title || title,
      description: fill(head.description, data) || description,
      image: absolute(fill(head.image, data)),
      canonical: base ? `${base}${route.path.replace(/\/+$/, "").replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, k) => encodeURIComponent(params[k])) || "/"}` : "",
    };
    return { status: 200, html: withHeadTags(indexHtml, resolved, { by: "node-tools/lib/head-injector.js" }), route: route.name };
  };
}

module.exports = { createHeadInjector, matchRoute, fill };
