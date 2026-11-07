(function (Viraspa) {
  // Test helpers for the browser. Not loaded by the app: tests/run.html
  // loads it. Write tests as:
  //
  //   const { test, assert, mount, mockEndpoint, fakeClock, reset } = Viraspa.testing;
  //   test("the card shows its heading", async () => {
  //     const card = await mount("vs-card", { heading: "Hello" });
  //     assert.equal(card.shadowRoot.querySelector(".heading").textContent, "Hello");
  //   });
  //
  // reset() runs before every test: it signs out, clears ViRaSPA's saved
  // settings, removes mounted elements and undoes mocks and fake clocks.
  // Dependency injection without a container: mockEndpoint replaces the
  // network for one endpoint, fakeClock replaces time.

  const tests = [];
  const cleanups = [];
  let area = null;

  function test(name, fn) {
    tests.push({ name, fn });
  }

  // ---- assertions --------------------------------------------------------
  class AssertionError extends Error {}
  const show = (v) => {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };
  const fail = (message) => {
    throw new AssertionError(message);
  };

  function deepEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
  }

  const assert = {
    ok: (value, message) => value || fail(message || `Expected a true value, got ${show(value)}.`),
    equal: (actual, expected, message) => Object.is(actual, expected) || fail(message || `Expected ${show(expected)}, got ${show(actual)}.`),
    notEqual: (actual, expected, message) => !Object.is(actual, expected) || fail(message || `Expected anything but ${show(expected)}.`),
    deepEqual: (actual, expected, message) => deepEqual(actual, expected) || fail(message || `Expected ${show(expected)}, got ${show(actual)}.`),
    match: (text, pattern, message) => pattern.test(String(text)) || fail(message || `${show(text)} doesn't match ${pattern}.`),
    async throws(fn, pattern, message) {
      try {
        await fn();
      } catch (err) {
        if (pattern && !pattern.test(err.message)) fail(message || `Threw "${err.message}", expected ${pattern}.`);
        return err;
      }
      fail(message || "Expected an error, none was thrown.");
    },
  };

  // ---- helpers -----------------------------------------------------------
  function testArea() {
    if (!area || !area.isConnected) {
      area = document.createElement("div");
      area.id = "vs-test-area";
      document.body.appendChild(area);
    }
    return area;
  }

  // Mounts a component (tag name or class) with props; resolves when ready.
  async function mount(tagOrClass, props = {}) {
    const tag = typeof tagOrClass === "string" ? tagOrClass : tagOrClass.tag;
    await Viraspa.core.components.load(tag);
    const el = document.createElement(tag);
    el.props = props;
    testArea().appendChild(el);
    await el.ready;
    return el;
  }

  // Renders a template string with a model into a fresh element; returns
  // { element, scope } (scope.dispose() ends its bindings).
  function render(template, model = {}, owner = null) {
    const element = document.createElement("div");
    testArea().appendChild(element);
    const scope = Viraspa.state.createScope();
    Viraspa.services.databinding.render(element, template, model, { owner, scope });
    cleanups.push(() => scope.dispose());
    return { element, scope };
  }

  // Answers calls to `endpoint` (from Viraspa.endpoints) with `response`
  // (a value, or (request) => value) instead of the network. Returns
  // { calls, restore }. Other requests go to the real fetch.
  function mockEndpoint(endpoint, response, { status = 200 } = {}) {
    const realFetch = window.fetch;
    const pattern = new RegExp(
      "^" + Viraspa.endpoints.getBaseUrl().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + endpoint.path.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{\w+\\?\}/g, "[^/?]+") + "(\\?.*)?$"
    );
    const calls = [];
    window.fetch = async (url, init = {}) => {
      const method = (init.method || "GET").toUpperCase();
      if (method === endpoint.method && pattern.test(String(url))) {
        const request = { url: String(url), method, headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : undefined };
        calls.push(request);
        const value = typeof response === "function" ? await response(request) : response;
        return new Response(value === undefined ? null : JSON.stringify(value), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return realFetch(url, init);
    };
    const restore = () => (window.fetch = realFetch);
    cleanups.push(restore);
    return { calls, restore };
  }

  // Controls time: Date.now, new Date(), setTimeout and setInterval.
  // clock.tick(ms) moves time forward and runs due timers.
  function fakeClock(start = Date.now()) {
    const RealDate = Date;
    const real = { setTimeout: window.setTimeout, clearTimeout: window.clearTimeout, setInterval: window.setInterval, clearInterval: window.clearInterval };
    let now = start;
    let nextId = 1;
    const timers = new Map();
    class FakeDate extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [now]));
      }
      static now() {
        return now;
      }
    }
    window.Date = FakeDate;
    window.setTimeout = (fn, ms = 0, ...args) => {
      const id = nextId++;
      timers.set(id, { at: now + Math.max(0, ms), fn, args });
      return id;
    };
    window.setInterval = (fn, ms = 0, ...args) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn, args, every: Math.max(1, ms) });
      return id;
    };
    window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
    const clock = {
      now: () => now,
      tick(ms) {
        const end = now + ms;
        for (;;) {
          const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
          if (!due) break;
          const [id, timer] = due;
          now = timer.at;
          if (timer.every) timer.at += timer.every;
          else timers.delete(id);
          timer.fn(...timer.args);
        }
        now = end;
      },
      restore() {
        window.Date = RealDate;
        Object.assign(window, real);
      },
    };
    cleanups.push(() => clock.restore());
    return clock;
  }

  async function reset() {
    while (cleanups.length) {
      try {
        cleanups.pop()();
      } catch (err) {
        console.warn("A test cleanup failed:", err);
      }
    }
    if (area) area.replaceChildren();
    if (Viraspa.session && Viraspa.session.isSignedIn()) await Viraspa.session.logout({ navigate: false, reason: "test" });
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith("viraspa")) localStorage.removeItem(key);
    } catch {
      // storage blocked
    }
    if (Viraspa.i18n && Viraspa.i18n.locale.peek() !== Viraspa.i18n.defaultLocale()) await Viraspa.i18n.setLocale(Viraspa.i18n.defaultLocale(), { remember: false });
  }

  const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 0));

  // Runs every registered test in order; shows and returns the results.
  async function run({ output = document.getElementById("test-results") } = {}) {
    const results = [];
    for (const t of tests) {
      await reset();
      const started = performance.now();
      try {
        await t.fn();
        results.push({ name: t.name, ok: true, ms: Math.round(performance.now() - started) });
      } catch (err) {
        results.push({ name: t.name, ok: false, error: err && err.message ? err.message : String(err) });
      }
    }
    await reset();
    const summary = { passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
    window.__viraspaTestResults = summary;
    if (output) {
      output.innerHTML = "";
      const head = document.createElement("h2");
      head.textContent = `${summary.passed} passed, ${summary.failed} failed`;
      head.className = summary.failed ? "failed" : "passed";
      output.appendChild(head);
      const list = document.createElement("ul");
      for (const r of results) {
        const li = document.createElement("li");
        li.className = r.ok ? "passed" : "failed";
        li.textContent = `${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? ` (${r.ms} ms)` : ` - ${r.error}`}`;
        list.appendChild(li);
      }
      output.appendChild(list);
      const json = document.createElement("pre");
      json.id = "test-results-json";
      json.hidden = true;
      json.textContent = JSON.stringify(summary);
      output.appendChild(json);
    }
    return summary;
  }

  Viraspa.testing = { test, assert, mount, render, mockEndpoint, fakeClock, reset, run, nextFrame };
})(window.Viraspa);
