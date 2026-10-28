(function (Viraspa) {
  class NotFoundPage extends Viraspa.core.Page {
    async onLoad() {
      const { template, model } = await Viraspa.core.pageLoader.fetchPage("pages/not-found/not-found");
      this.renderTemplate(template, model);
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages["not-found"] = NotFoundPage;
})(window.Viraspa);
