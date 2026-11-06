(function (Viraspa) {
  // Sign-in page: the official <vs-login-form> component. It hands the
  // credentials to Viraspa.session.login (the adapter in app/config/session.js).
  class LoginPage extends Viraspa.core.Page {
    async onLoad() {
      // Already signed in: go straight on.
      if (Viraspa.session.isSignedIn()) {
        Viraspa.core.navigate(Viraspa.session.returnPath());
        return;
      }
      const { template, model } = await Viraspa.core.pageLoader.fetchPage(this.basePath);
      this.renderTemplate(template, model);
      const form = this.container.querySelector("vs-login-form");
      // Set before the form loads, so its buttons render.
      form.providers = [
        { id: "google", label: "Google", icon: "fontawesome:google:brands" },
        { id: "microsoft", label: "Microsoft", icon: "fontawesome:microsoft:brands" },
      ];
      form.addEventListener("vs-login-success", () => Viraspa.core.navigate(Viraspa.session.returnPath()));
      await this.display();
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages.login = LoginPage;
})(window.Viraspa);
