(function (Viraspa) {
  Viraspa.core = Viraspa.core || {};

  Viraspa.core.emit = function (name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  };

  Viraspa.core.runHook = async function (instance, hook, ...args) {
    if (typeof instance[hook] === "function") {
      return instance[hook](...args);
    }
  };

  // Project init code (see config/init.js). Unlike the "app:init" event,
  // these are awaited, in registration order, before the layout and first
  // page load - so e.g. a base URL read at startup is in place before any
  // page calls an endpoint.
  const initHandlers = [];

  Viraspa.core.onInit = function (handler) {
    initHandlers.push(handler);
  };

  Viraspa.core.runInit = async function () {
    for (const handler of initHandlers) {
      try {
        await handler();
      } catch (err) {
        console.error("An onInit handler failed; continuing startup:", err);
      }
    }
  };
})(window.Viraspa);
