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
    const entry = indicatorFor(key, element);
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
      if (entry.count <= 0) {
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

  Viraspa.busy = { run, cancelAll, isBusy };
})(window.Viraspa);
