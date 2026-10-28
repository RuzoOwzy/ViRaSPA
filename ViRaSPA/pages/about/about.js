(function (Viraspa) {
  class AboutPage extends Viraspa.core.Page {
    async onLoad() {
      const { template, model } = await Viraspa.core.pageLoader.fetchPage("pages/about/about");
      this.renderTemplate(template, model);
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages.about = AboutPage;
})(window.Viraspa);
