(function (Viraspa) {
  class Page {
    constructor(container, route) {
      this.container = container;
      this.route = route;
      // e.g. "pages/home/home" - the page's .html/.css/.model.json, found
      // from its route's folder by naming convention.
      this.basePath = Viraspa.core.pageLoader.basePath(route.page);
    }

    async beforeLoad() {}

    // Default: fetch and render the page's own .html/.model.json/.css. A
    // page only overrides this to do more, calling `await super.onLoad()`
    // first.
    async onLoad() {
      const { template, model } = await Viraspa.core.pageLoader.fetchPage(this.basePath);
      this.renderTemplate(template, model);
    }

    async afterLoad() {}

    renderTemplate(template, model) {
      Viraspa.core.emit("page:beforeDataBinding", { page: this });
      const html = Viraspa.services.databinding.bindTemplate(template, model);
      Viraspa.core.emit("page:onDataBinding", { page: this, model });
      this.container.innerHTML = html;
      Viraspa.core.emit("page:afterDataBinding", { page: this });
      return html;
    }
  }

  Viraspa.core = Viraspa.core || {};
  Viraspa.core.Page = Page;
})(window.Viraspa);
