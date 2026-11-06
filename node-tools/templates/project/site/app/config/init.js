(function (Viraspa) {
  // Runs once at startup, before the layout and the first page. Register
  // work with Viraspa.core.onInit(async () => { ... }); it is awaited.

  // The backend address for this environment (app/config/environment.js).
  Viraspa.core.onInit(() => {
    const address = Viraspa.environment && Viraspa.environment.settings.apiBaseAddress;
    if (address) Viraspa.endpoints.setBaseUrl(address);
  });

  // Signing in: give the session an adapter that calls your backend.
  //   Viraspa.session.configure({
  //     adapter: { async login({ username, password }) { /* call your API */ return { user, token, privileges, roles, expiresIn }; } },
  //     loginRoute: "/login", homeRoute: "/",
  //   });
})(window.Viraspa);
