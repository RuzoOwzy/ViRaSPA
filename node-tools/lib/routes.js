// Reads the app's routes (app/config/routes.js, a browser script) in Node,
// and resolves a route's head information the same way the browser does.
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadRoutes(siteFolder) {
  const file = path.join(siteFolder, "app", "config", "routes.js");
  const code = fs.readFileSync(file, "utf8");
  const sandbox = { window: { Viraspa: {} } };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox, { filename: file, timeout: 2000 });
  const routes = sandbox.window.Viraspa.routes || [];
  return { routes, notFoundRoute: sandbox.window.Viraspa.notFoundRoute || null };
}

function normalizePath(p) {
  const trimmed = p.length > 1 ? p.replace(/\/+$/, "") : p;
  return (trimmed || "/").toLowerCase();
}

const isPrivate = (route) => route.access === "private" || Boolean(route.requires);
const hasPlaceholders = (text) => typeof text === "string" && /\{\{/.test(text);

// { title, description, image, canonical } with absolute addresses.
function resolveHead(route, { siteAddress, fallbackTitle, fallbackDescription }) {
  const head = route.head || {};
  const base = (siteAddress || "").replace(/\/+$/, "");
  const abs = (url) => {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    return base ? `${base}/${url.replace(/^\/+/, "")}` : "";
  };
  const pick = (value, fallback) => (value && !hasPlaceholders(value) ? value : fallback);
  return {
    title: pick(head.title, route.title || fallbackTitle),
    description: pick(head.description, fallbackDescription),
    image: hasPlaceholders(head.image) ? "" : abs(head.image),
    canonical: base ? `${base}${route.path === "/" ? "/" : route.path}` : "",
    dynamic: [head.title, head.description, head.image].some(hasPlaceholders),
  };
}

module.exports = { loadRoutes, normalizePath, isPrivate, resolveHead };
