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
})(window.Viraspa);
