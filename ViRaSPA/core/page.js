(function (Viraspa) {
  class Page {
    constructor(container, route) {
      this.container = container;
      this.route = route;
    }

    async beforeLoad() {}
    async onLoad() {}
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
