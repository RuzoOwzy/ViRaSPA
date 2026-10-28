(function (Viraspa) {
  async function request(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status}`);
    return res.json();
  }

  Viraspa.services = Viraspa.services || {};
  Viraspa.services.communication = { request };
})(window.Viraspa);
