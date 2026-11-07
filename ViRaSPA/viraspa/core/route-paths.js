// Route paths with parameters: "/customers/:id" matches /customers/42 and
// gives { id: "42" }. Shared by the router (Viraspa.routePaths) and the node
// tools (require("<site>/viraspa/core/route-paths.js")), so the browser, the
// dev server, the server rules and the head injector agree on what matches.
//
// Rules:
//   - a segment ":name" matches one non-empty segment (no "/"); the value is
//     URL-decoded and keeps its letter case;
//   - other segments match case-insensitively; a trailing slash is ignored;
//   - a route without parameters wins over one with parameters, so
//     "/customers/new" beats "/customers/:id" whatever their order.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Viraspa.routePaths = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const PARAM = /^:([A-Za-z_][A-Za-z0-9_]*)$/;
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const compiled = new Map();

  // "/about/" -> "/about" ("/" stays "/").
  function trim(path) {
    const text = String(path || "/");
    const trimmed = text.length > 1 ? text.replace(/\/+$/, "") : text;
    return trimmed || "/";
  }

  // { keys, regex, source, isStatic } for a route path. `source` is a
  // regular expression with [^/]+ for each parameter (for server rules).
  function compile(path) {
    const key = trim(path);
    if (!compiled.has(key)) {
      const keys = [];
      const parts = key
        .split("/")
        .slice(1)
        .map((segment) => {
          const param = PARAM.exec(segment);
          if (!param) return escapeRegex(segment);
          keys.push(param[1]);
          return "([^/]+)";
        });
      const source = `^/${parts.join("/")}/?$`;
      compiled.set(key, Object.freeze({ keys: Object.freeze(keys), regex: new RegExp(source, "i"), source, isStatic: keys.length === 0 }));
    }
    return compiled.get(key);
  }

  const hasParams = (path) => !compile(path).isStatic;

  // { route, params } for an app path ("/customers/42"), or null.
  function match(routes, appPath) {
    const path = trim(appPath);
    let withParams = null;
    for (const route of routes || []) {
      if (!route || !route.path) continue;
      const pattern = compile(route.path);
      const found = pattern.regex.exec(path);
      if (!found) continue;
      const params = {};
      pattern.keys.forEach((name, i) => {
        try {
          params[name] = decodeURIComponent(found[i + 1]);
        } catch {
          params[name] = found[i + 1];
        }
      });
      if (pattern.isStatic) return { route, params };
      if (!withParams) withParams = { route, params };
    }
    return withParams;
  }

  // A route path with values filled in: build("/customers/:id", { id: 42 })
  // is "/customers/42" (values are URL-encoded).
  function build(routePath, params = {}) {
    return trim(routePath).replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (whole, name) =>
      params[name] === undefined || params[name] === null ? whole : encodeURIComponent(String(params[name]))
    );
  }

  return Object.freeze({ trim, compile, match, build, hasParams });
});
