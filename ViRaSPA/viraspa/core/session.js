(function (Viraspa) {
  // The signed-in user's session. The framework handles the generic parts:
  // storing the session (localStorage), privilege and role checks, guarding
  // private routes, attaching the token to API calls, reacting to 401
  // answers and expiry, and keeping browser tabs in step. The project
  // supplies an adapter that talks to its own backend:
  //
  //   Viraspa.session.configure({
  //     adapter: {
  //       async login({ username, password, rememberMe }) {
  //         // call your API; throw new Error("Wrong email or password.") on failure
  //         return { user: { id, name, email }, token, privileges: ["users.view"], roles: ["admin"], expiresIn: 3600 };
  //       },
  //       async logout(session) {},            // optional: tell the backend
  //       async loginWith(providerId) {},       // optional: external sign-in (OAuth...)
  //     },
  //     loginRoute: "/login", homeRoute: "/dashboard",
  //   });
  //
  // Every automatic behaviour can be switched off or replaced (see DEFAULTS).
  // Checks in the browser only shape the interface - the backend must
  // enforce every privilege itself.

  const DEFAULTS = {
    adapter: null,
    storageKey: "viraspa:session",
    loginRoute: "/login",
    homeRoute: "/",
    forbiddenRoute: null, // shown when a signed-in user lacks a privilege (default: not-found page)
    // An API call answered 401 Unauthorized:
    //   "logout" - sign out and go to the login page (default)
    //   "notify" - keep the session, show a message
    //   "ignore" - do nothing (the call still fails)
    //   function(info) - your own handling
    onUnauthorized: "logout",
    // The session's expiry time passed: same choices.
    onExpired: "logout",
    // Add "Authorization: Bearer <token>" to calls to the endpoints' base
    // URL (true), to no calls (false), or decide per URL: (url) => boolean.
    attachToken: true,
    // Sign in/out in one tab applies to the others.
    syncAcrossTabs: true,
    // Minutes added to the expiry on every successful API call (0 = off).
    slidingExpiry: 0,
    messages: {
      unauthorized: "Your session is no longer valid. Please sign in again.",
      expired: "Your session has expired. Please sign in again.",
    },
  };

  let options = { ...DEFAULTS, messages: { ...DEFAULTS.messages } };
  let state = null; // { user, token, privileges, roles, expiresAt }
  let expiryTimer = null;

  // ---- storage --------------------------------------------------------
  function read() {
    try {
      const raw = localStorage.getItem(options.storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.expiresAt && Date.now() >= parsed.expiresAt) return { ...parsed, expired: true };
      return parsed;
    } catch {
      return null;
    }
  }

  function write(value) {
    try {
      if (value) localStorage.setItem(options.storageKey, JSON.stringify(value));
      else localStorage.removeItem(options.storageKey);
    } catch {
      // storage blocked (private mode...): the session lives in memory only
    }
  }

  function changed(reason) {
    scheduleExpiry();
    Viraspa.core.emit("sessionChanged", { signedIn: isSignedIn(), user: user(), reason });
  }

  function scheduleExpiry() {
    clearTimeout(expiryTimer);
    if (!state || !state.expiresAt) return;
    const wait = state.expiresAt - Date.now();
    // setTimeout can't wait longer than ~24.8 days; check again later then.
    expiryTimer = setTimeout(() => (Date.now() >= state?.expiresAt ? react("onExpired", { reason: "expired" }) : scheduleExpiry()), Math.min(Math.max(wait, 0), 2 ** 31 - 1));
  }

  function normalize(result) {
    if (!result || typeof result !== "object") throw new Error("The session adapter's login() must return { user, token, privileges, roles }.");
    const expiresAt = result.expiresAt
      ? new Date(result.expiresAt).getTime()
      : result.expiresIn
        ? Date.now() + Number(result.expiresIn) * 1000
        : null;
    return {
      user: result.user || {},
      token: result.token || null,
      privileges: Array.isArray(result.privileges) ? result.privileges.map(String) : [],
      roles: Array.isArray(result.roles) ? result.roles.map(String) : [],
      expiresAt,
    };
  }

  // ---- public API -----------------------------------------------------
  function configure(changes = {}) {
    options = { ...options, ...changes, messages: { ...options.messages, ...(changes.messages || {}) } };
    const stored = read();
    state = stored && !stored.expired ? stored : null;
    if (stored && stored.expired) write(null);
    scheduleExpiry();
  }

  async function login(credentials) {
    if (!options.adapter || typeof options.adapter.login !== "function") {
      throw new Error("No session adapter: call Viraspa.session.configure({ adapter: { login } }) in app/config/init.js.");
    }
    state = normalize(await options.adapter.login(credentials));
    write(state);
    changed("login");
    return user();
  }

  async function loginWith(providerId) {
    if (!options.adapter || typeof options.adapter.loginWith !== "function") {
      throw new Error(`Signing in with "${providerId}" is not set up (the session adapter has no loginWith).`);
    }
    const result = await options.adapter.loginWith(providerId);
    if (result) {
      state = normalize(result);
      write(state);
      changed("login");
    }
    return user();
  }

  async function logout({ reason = "logout", navigate = true } = {}) {
    const previous = state;
    state = null;
    write(null);
    changed(reason);
    if (previous && options.adapter && typeof options.adapter.logout === "function") {
      try {
        await options.adapter.logout(previous);
      } catch (err) {
        console.warn("The session adapter's logout() failed:", err);
      }
    }
    if (navigate && isPrivatePath(location.pathname)) Viraspa.core.navigate(loginPath(location.pathname + location.search));
  }

  const isSignedIn = () => Boolean(state);
  const user = () => (state ? structuredClone(state.user) : null);
  const token = () => (state ? state.token : null);
  const privileges = () => (state ? [...state.privileges] : []);
  const roles = () => (state ? [...state.roles] : []);
  const hasPrivilege = (name) => Boolean(state && state.privileges.includes(name));
  const hasAnyPrivilege = (names) => (names || []).some(hasPrivilege);
  const hasAllPrivileges = (names) => (names || []).every(hasPrivilege);
  const hasRole = (name) => Boolean(state && state.roles.includes(name));

  // Whether the current user may open `route`: access "private" needs a
  // signed-in user; requires { privileges, match: "all" | "any", roles }
  // needs those too.
  function canAccess(route) {
    if (!route) return false;
    const needsSignIn = route.access === "private" || Boolean(route.requires);
    if (!needsSignIn) return true;
    if (!isSignedIn()) return false;
    const req = route.requires || {};
    if (req.privileges && req.privileges.length) {
      const ok = req.match === "any" ? hasAnyPrivilege(req.privileges) : hasAllPrivileges(req.privileges);
      if (!ok) return false;
    }
    if (req.roles && req.roles.length && !req.roles.some(hasRole)) return false;
    return true;
  }

  function loginPath(returnTo) {
    const target = options.loginRoute || "/login";
    return returnTo && returnTo !== target ? `${target}?returnTo=${encodeURIComponent(returnTo)}` : target;
  }

  // Where to go after signing in: ?returnTo= (same-site paths only) or homeRoute.
  function returnPath() {
    const value = new URLSearchParams(location.search).get("returnTo");
    return value && value.startsWith("/") && !value.startsWith("//") ? value : options.homeRoute || "/";
  }

  function isPrivatePath(pathname) {
    const path = Viraspa.core.normalizePath(pathname);
    const route = (Viraspa.routes || []).find((r) => r.path && Viraspa.core.normalizePath(r.path) === path);
    return Boolean(route && (route.access === "private" || route.requires));
  }

  // The framework's guard: true, or a path to go to instead.
  async function guard(route) {
    if (canAccess(route)) return true;
    if (!isSignedIn()) return loginPath(location.pathname + location.search);
    return options.forbiddenRoute || false;
  }

  // ---- API integration (used by the communication service) -------------
  function authorizationHeader(url) {
    if (!state || !state.token) return null;
    const rule = options.attachToken;
    let attach = false;
    if (typeof rule === "function") attach = Boolean(rule(url));
    else if (rule) {
      const base = Viraspa.endpoints && Viraspa.endpoints.getBaseUrl ? Viraspa.endpoints.getBaseUrl() : "";
      attach = Boolean(base) && (url === base || url.startsWith(`${base}/`) || url.startsWith(`${base}?`));
    }
    return attach ? `Bearer ${state.token}` : null;
  }

  function react(optionName, info) {
    const choice = options[optionName];
    if (!state && info.reason !== "expired") return;
    if (typeof choice === "function") return choice(info);
    if (choice === "ignore") return;
    const message = info.reason === "expired" ? options.messages.expired : options.messages.unauthorized;
    if (choice === "notify") {
      Viraspa.toast.show(message, { type: "warning" });
      return;
    }
    Viraspa.toast.show(message, { type: "warning" });
    logout({ reason: info.reason });
  }

  // Called by the communication service after each response.
  function responseSeen(url, status) {
    if (status === 401 && authorizationHeader(url) !== null) {
      react("onUnauthorized", { reason: "unauthorized", url, status });
    } else if (status < 400 && state && state.expiresAt && options.slidingExpiry > 0 && authorizationHeader(url)) {
      state.expiresAt = Math.max(state.expiresAt, Date.now() + options.slidingExpiry * 60000);
      write(state);
      scheduleExpiry();
    }
  }

  // ---- privilege attributes in HTML ------------------------------------
  //   data-privilege-required="users.edit users.delete"
  //   data-privilege-match="all" (default) | "any"
  //   data-privilege-denied="hide" (default) | "disable" | "readonly"
  //   data-role-required="admin manager"   (any of them)
  //   data-visible-when="signed-in" | "signed-out"
  const SELECTOR = "[data-privilege-required],[data-role-required],[data-visible-when]";

  function allowedFor(el) {
    const when = el.getAttribute("data-visible-when");
    if (when === "signed-in" && !isSignedIn()) return { ok: false, how: "hide" };
    if (when === "signed-out" && isSignedIn()) return { ok: false, how: "hide" };
    const required = (el.getAttribute("data-privilege-required") || "").split(/[\s,]+/).filter(Boolean);
    const roleList = (el.getAttribute("data-role-required") || "").split(/[\s,]+/).filter(Boolean);
    let ok = true;
    if (required.length) ok = el.getAttribute("data-privilege-match") === "any" ? hasAnyPrivilege(required) : hasAllPrivileges(required);
    if (ok && roleList.length) ok = roleList.some(hasRole);
    return { ok, how: el.getAttribute("data-privilege-denied") || "hide" };
  }

  function applyTo(el) {
    const { ok, how } = allowedFor(el);
    // Remember the element's own state once, so allowing it again restores it.
    if (!el.hasAttribute("data-vs-original")) {
      el.setAttribute("data-vs-original", JSON.stringify({ hidden: el.hidden, disabled: Boolean(el.disabled), readOnly: Boolean(el.readOnly) }));
    }
    const original = JSON.parse(el.getAttribute("data-vs-original"));
    el.hidden = original.hidden || (!ok && how === "hide");
    const fields = el.matches("input, select, textarea, button, fieldset") ? [el] : [];
    if (how === "disable") {
      for (const f of fields.length ? fields : el.querySelectorAll("input, select, textarea, button")) f.disabled = !ok || original.disabled;
      if (el.matches("a")) el.toggleAttribute("aria-disabled", !ok);
      el.classList.toggle("vs-denied", !ok);
    }
    if (how === "readonly") {
      for (const f of fields.length ? fields : el.querySelectorAll("input, textarea")) f.readOnly = !ok || original.readOnly;
      for (const f of el.querySelectorAll("select, input[type=checkbox], input[type=radio], button")) f.disabled = !ok;
      el.classList.toggle("vs-denied", !ok);
    }
  }

  // Applies the attributes inside `root` (a document, element or shadow
  // root). Called by the framework after rendering and on every change.
  function applyPrivileges(root = document) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches(SELECTOR)) applyTo(root);
    for (const el of root.querySelectorAll(SELECTOR)) applyTo(el);
  }

  function applyEverywhere(root = document) {
    applyPrivileges(root);
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) applyEverywhere(el.shadowRoot);
  }

  document.addEventListener("viraspa:sessionChanged", () => applyEverywhere());

  // ---- other tabs ----------------------------------------------------------
  window.addEventListener("storage", (event) => {
    if (!options.syncAcrossTabs || event.key !== options.storageKey) return;
    const before = isSignedIn();
    const stored = read();
    state = stored && !stored.expired ? stored : null;
    changed("other-tab");
    if (before && !state && isPrivatePath(location.pathname)) Viraspa.core.navigate(loginPath(location.pathname + location.search));
  });

  configure();

  Viraspa.session = {
    configure,
    login,
    loginWith,
    logout,
    isSignedIn,
    user,
    token,
    privileges,
    roles,
    hasPrivilege,
    hasAnyPrivilege,
    hasAllPrivileges,
    hasRole,
    canAccess,
    guard,
    returnPath,
    loginPath,
    applyPrivileges,
    authorizationHeader,
    responseSeen,
    options: () => ({ ...options, adapter: options.adapter ? "(set)" : null }),
  };
})(window.Viraspa);
