(function (Viraspa) {
  // Template helpers shared by every page and component: functions you can
  // use inside {{ }} both as a call and as a pipe.
  //
  //   Viraspa.templates.add("fullName", (user) => `${user.first} ${user.last}`);
  //   {{ fullName(user) }}        a call (any number of arguments)
  //   {{ user | fullName }}       a pipe (the value is the first argument)
  //
  //   Viraspa.templates.add("initials", (name, count = 2) => ...);
  //   {{ user.name | initials:3 }}
  //
  // Add them at startup (app/config/init.js, or an app/utils file). A helper
  // that reads signals keeps the binding live, like any expression. Names are
  // looked up after the page's or component's own names, so a page method
  // with the same name wins there. The built-in pipes (number, date, currency,
  // upper...) come from Viraspa.format; Viraspa.format.addPipe() still adds a
  // pipe-only function.
  const helpers = new Map();
  const RESERVED = new Set(["t", "format", "true", "false", "null", "undefined", "this"]);

  function add(name, fn) {
    if (!/^[A-Za-z_$][\w$]*$/.test(name || "")) throw new Error(`Template helper name "${name}" must be a plain name, e.g. "fullName".`);
    if (RESERVED.has(name)) throw new Error(`"${name}" is a built-in template name.`);
    if (typeof fn !== "function") throw new Error(`Template helper "${name}" needs a function.`);
    if (helpers.has(name)) throw new Error(`The template helper "${name}" already exists.`);
    helpers.set(name, fn);
  }

  Viraspa.templates = {
    add,
    has: (name) => helpers.has(name),
    get: (name) => helpers.get(name),
    names: () => [...helpers.keys()],
    // For the binding service: all helpers as one scope object.
    scope: () => Object.fromEntries(helpers),
  };
})(window.Viraspa);
