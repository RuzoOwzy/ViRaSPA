(function (Viraspa) {
  // Project init code: runs once at startup, after the framework and
  // app/config/endpoints.js have loaded and before the layout and first page
  // load. Register work with Viraspa.core.onInit(async () => { ... }); the
  // framework waits for it (and logs, then continues, if it fails).

  // The backend address for this environment (see app/config/environment.js).
  Viraspa.core.onInit(() => {
    const address = Viraspa.environment && Viraspa.environment.settings.apiBaseAddress;
    if (address) Viraspa.endpoints.setBaseUrl(address);
  });

  // The user menu's items. (It never lists Dashboard: that's in the side menu.)
  Viraspa.core.onInit(() => {
    const userMenu = document.querySelector("vs-user-menu");
    if (!userMenu) return;
    userMenu.items = [
      { label: "Profile", href: "/profile", icon: "lucide:user" },
      { label: "Change Credentials", href: "/change-credentials", icon: "lucide:key-round" },
      { divider: true },
      { label: "Sign Out", icon: "lucide:log-out", action: () => Viraspa.session.logout({ navigate: false }).then(() => Viraspa.core.navigate("/")) },
    ];
  });

  // Another example - one frontend installed on many servers, each with its
  // own backend: read a settings file an admin edits on that server.
  // `fresh: true` skips the browser cache. Anything the frontend fetches is
  // public - never put secrets in such a file.
  //
  //   Viraspa.core.onInit(async () => {
  //     const settings = await Viraspa.utility.assetLoader.fetchJson("<your-settings-file>.json", { fresh: true });
  //     Viraspa.endpoints.setBaseUrl(settings.apiBaseUrl);
  //   });
})(window.Viraspa);
