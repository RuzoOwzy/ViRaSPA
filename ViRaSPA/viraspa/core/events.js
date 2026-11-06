(function (Viraspa) {
  Viraspa.core = Viraspa.core || {};

  // Every framework event name starts with "viraspa:" (reserved for the
  // framework), e.g. "viraspa:pageBeforeLoad". Events are DOM CustomEvents,
  // so plain code listens with document.addEventListener(name, handler).
  // `target` defaults to document; page events are dispatched on the page's
  // own element and bubble up to document.
  Viraspa.core.emit = function (name, detail, target = document) {
    const event = new CustomEvent(`viraspa:${name}`, { detail, bubbles: true, composed: true });
    target.dispatchEvent(event);
    return event;
  };

  Viraspa.core.runHook = async function (instance, hook, ...args) {
    if (typeof instance[hook] === "function") {
      return instance[hook](...args);
    }
  };

  // Project init code (see app/config/init.js). Unlike the "viraspa:appInit"
  // event, these are awaited, in registration order, before the layout and
  // first page load - so e.g. a base URL read at startup is in place before
  // any page calls an endpoint.
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
