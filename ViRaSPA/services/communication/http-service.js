(function (Viraspa) {
  // The backend base URL every endpoint call is joined to. Set by
  // defineEndpoints() from config/endpoints.js, and changeable at runtime
  // via Viraspa.endpoints.setBaseUrl() (e.g. from init code that reads a
  // per-installation setting). Read on every call, so a change applies to
  // every request made after it.
  let baseUrl = "";

  async function request(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status}`);
    return res.json();
  }

  // Accepts only an absolute http(s) URL; drops any trailing slash.
  function setBaseUrl(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }
    if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
      console.warn(`Ignored base URL "${url}": it must be an absolute http(s) URL. Still using "${baseUrl}".`);
      return false;
    }
    baseUrl = String(url).replace(/\/+$/, "");
    return true;
  }

  // Turns config/endpoints.js's plain definitions into the frozen
  // Viraspa.endpoints registry: { baseUrl, <group>: { <name>: { method, path } } }.
  function defineEndpoints({ baseUrl: initialBaseUrl, ...groups }) {
    setBaseUrl(initialBaseUrl);

    const registry = {};
    for (const [groupName, endpoints] of Object.entries(groups)) {
      const group = {};
      for (const [name, endpoint] of Object.entries(endpoints)) {
        if (!endpoint || !endpoint.method || typeof endpoint.path !== "string" || !endpoint.path.startsWith("/")) {
          throw new Error(`Endpoint "${groupName}.${name}" needs a method and a path starting with "/".`);
        }
        group[name] = Object.freeze({ method: endpoint.method.toUpperCase(), path: endpoint.path });
      }
      registry[groupName] = Object.freeze(group);
    }

    return Object.freeze({ ...registry, getBaseUrl: () => baseUrl, setBaseUrl });
  }

  // "/users/{id}" + { id: 7 } -> "<baseUrl>/users/7", plus ?query values.
  function buildUrl(endpoint, params = {}, query) {
    const path = endpoint.path.replace(/\{(\w+)\}/g, (_, key) => {
      if (params[key] === undefined || params[key] === null) {
        throw new Error(`Missing path parameter "${key}" for ${endpoint.method} ${endpoint.path}.`);
      }
      return encodeURIComponent(params[key]);
    });

    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query || {})) {
      if (value !== undefined && value !== null) search.append(key, value);
    }
    const queryString = search.toString();
    return `${baseUrl}${path}${queryString ? `?${queryString}` : ""}`;
  }

  // Calls a Viraspa.endpoints entry: its method, the current base URL + its
  // path, with optional path params, query values and JSON body.
  function call(endpoint, { params, query, body } = {}) {
    return request(endpoint.method, buildUrl(endpoint, params, query), body);
  }

  Viraspa.services = Viraspa.services || {};
  Viraspa.services.communication = { request, call, defineEndpoints };
})(window.Viraspa);
