(function (Viraspa) {
  // Shows a busy indicator while work runs, and lets the work be cancelled.
  //
  //   const users = await Viraspa.busy.run(
  //     ({ signal }) => Viraspa.services.communication.call(Viraspa.endpoints.users.list, { signal }),
  //     { message: "Loading users...", target: "#users-table", signal: this.signal }
  //   );
  //
  // options:
  //   message  text next to the spinner (screen readers hear it too)
  //   target   an element or selector to cover; without it a small
  //            indicator shows at the top of the window
  //   delay    ms before the indicator appears (default 200), so quick work
  //            never flashes a spinner
  //   signal   an AbortSignal (e.g. a page's this.signal) that cancels the work
  // fn receives { signal }, aborted when `signal` aborts or cancelAll() runs.
  // Events: viraspa:busyStart and viraspa:busyEnd (detail: { message, target }).
  // Runs on the same target share one indicator; it hides when the last ends.
  //
  // Without a target, the indicator is a thin line across the top of the
  // window that creeps forward while work runs (as on YouTube), also shown
  // while the router loads a page. Viraspa.busy.configure({
  //   style: "top-line" (default) | "overlay" (a small spinner at the top) | "both",
  //   navigation: true,     // the line during page navigation
  //   topLineDelay: 150,    // ms before it appears: quick work shows nothing
  // }). Colour: --vs-top-line-color. Also Viraspa.busy.topLine.start()/done().

  const settings = { style: "top-line", navigation: true, topLineDelay: 150 };

  function configure(options = {}) {
    if (options.style !== undefined && !["top-line", "overlay", "both"].includes(options.style)) {
      throw new Error(`busy style "${options.style}" must be "top-line", "overlay" or "both".`);
    }
    Object.assign(settings, options);
  }

  // ---- the top line --------------------------------------------------------
  const line = { el: null, count: 0, value: 0, trickle: null, showTimer: null, hideTimer: null };

  function setLine(value) {
    line.value = value;
    if (line.el) {
      line.el.style.setProperty("--vs-top-line-progress", String(value));
      line.el.setAttribute("aria-valuenow", String(Math.round(value * 100)));
    }
  }

  function startLine(message) {
    line.count++;
    if (line.count > 1) return;
    clearTimeout(line.hideTimer);
    line.showTimer = setTimeout(() => {
      if (!line.el) {
        line.el = document.createElement("div");
        line.el.className = "vs-top-line";
        line.el.setAttribute("role", "progressbar");
        line.el.setAttribute("aria-valuemin", "0");
        line.el.setAttribute("aria-valuemax", "100");
        document.body.appendChild(line.el);
      }
      line.el.setAttribute("aria-label", message || (Viraspa.i18n ? Viraspa.i18n.t("Loading") : "Loading"));
      setLine(0.08);
      line.el.classList.add("is-active");
      // Creeps toward 90% (never reaching it) until the work is done.
      line.trickle = setInterval(() => setLine(line.value + (0.9 - line.value) * 0.12), 250);
    }, Math.max(0, settings.topLineDelay));
  }

  function doneLine() {
    if (line.count === 0) return;
    line.count--;
    if (line.count > 0) return;
    clearTimeout(line.showTimer);
    clearInterval(line.trickle);
    if (!line.el || !line.el.classList.contains("is-active")) return;
    setLine(1);
    line.hideTimer = setTimeout(() => {
      line.el.classList.remove("is-active");
      setLine(0);
    }, 300);
  }

  const active = new Map(); // target element (or "global") -> { count, indicator }
  const controllers = new Set();

  function indicatorFor(key, target) {
    let entry = active.get(key);
    if (entry) return entry;
    const indicator = document.createElement("vs-busy-indicator");
    if (key !== "global") indicator.setAttribute("overlay", "");
    if (key === "global") {
      indicator.setAttribute("data-vs-global-busy", "");
      document.body.appendChild(indicator);
    } else {
      if (getComputedStyle(target).position === "static") {
        target.dataset.vsBusyPositioned = "";
        target.style.position = "relative";
      }
      target.appendChild(indicator);
    }
    entry = { count: 0, indicator };
    active.set(key, entry);
    return entry;
  }

  async function run(fn, { message = "", target = null, delay = 200, signal } = {}) {
    const element = typeof target === "string" ? document.querySelector(target) : target;
    const key = element || "global";
    const useLine = !element && settings.style !== "overlay";
    const useIndicator = element || settings.style !== "top-line";
    if (useLine) startLine(message);
    const entry = useIndicator ? indicatorFor(key, element) : { count: 0, indicator: document.createElement("span") };
    entry.count++;
    entry.indicator.setAttribute("delay", String(delay));
    if (message) entry.indicator.setAttribute("message", message);
    entry.indicator.setAttribute("active", "");
    entry.indicator.setAttribute("aria-busy", "true");
    if (element) element.setAttribute("aria-busy", "true");

    const controller = new AbortController();
    controllers.add(controller);
    const onAbort = () => controller.abort(signal.reason);
    if (signal) {
      if (signal.aborted) controller.abort(signal.reason);
      else signal.addEventListener("abort", onAbort, { once: true });
    }

    Viraspa.core.emit("busyStart", { message, target: element });
    try {
      return await fn({ signal: controller.signal });
    } finally {
      controllers.delete(controller);
      if (signal) signal.removeEventListener("abort", onAbort);
      entry.count--;
      if (useLine) doneLine();
      if (useIndicator && entry.count <= 0) {
        entry.indicator.remove();
        active.delete(key);
        if (element) {
          element.removeAttribute("aria-busy");
          if (element.dataset.vsBusyPositioned !== undefined) {
            element.style.position = "";
            delete element.dataset.vsBusyPositioned;
          }
        }
      }
      Viraspa.core.emit("busyEnd", { message, target: element });
    }
  }

  // Cancels every running Viraspa.busy.run (e.g. a "Cancel" button).
  function cancelAll(reason) {
    for (const controller of controllers) controller.abort(reason);
  }

  const isBusy = () => active.size > 0;

  Viraspa.busy = {
    run,
    cancelAll,
    isBusy,
    configure,
    settings: () => ({ ...settings }),
    topLine: { start: startLine, done: doneLine },
  };
})(window.Viraspa);
