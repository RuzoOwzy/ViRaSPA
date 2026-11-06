(function (Viraspa) {
  // Profile: the signed-in user's details from Viraspa.session.
  class ProfilePage extends Viraspa.core.Page {
    async onLoad() {
      const { template, model } = await Viraspa.core.pageLoader.fetchPage(this.basePath);
      const user = Viraspa.session.user() || {};
      Object.assign(model, {
        name: user.name || "",
        email: user.email || "",
        roles: Viraspa.session.roles().join(", ") || "none",
        privileges: Viraspa.session.privileges().join(", ") || "none",
      });
      this.renderTemplate(template, model);
      await this.display();
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages.profile = ProfilePage;
})(window.Viraspa);
