(function (Viraspa) {
  // Base class for framework pages. The router creates one per visit (or
  // keeps it, for routes with keepAlive: true) and renders it into its own
  // element, `this.container` (<div class="vs-page" data-page="name">).
  //
  // Pages work with the normal `document` (no Shadow DOM): page CSS is
  // switched on only while the page is shown.
  class Page {
    constructor(container, route, { signal, display } = {}) {
      this.container = container;
      this.route = route;
      // Aborted when the user leaves this page (or a newer navigation wins
      // before it is shown) - pass it to fetch/call to cancel requests.
      this.signal = signal;
      this._display = display || (async () => {});
      // e.g. "app/pages/home/home" - the page's .html/.css/.model.json.
      this.basePath = Viraspa.core.pageLoader.basePath(route.page);
    }

    async beforeLoad() {}

    // Default: fetch the page's .html and .model.json, render them and show
    // the page. A page that does more overrides this and calls
    // `await super.onLoad()` first; work after that (API calls...) runs on
    // the visible page.
    async onLoad() {
      const { template, model } = await Viraspa.core.pageLoader.fetchPage(this.basePath);
      this.renderTemplate(template, model);
      await this.display();
    }

    async afterLoad() {}

    renderTemplate(template, model) {
      const { emit } = Viraspa.core;
      // Dispatched on document: the page's element may not be on screen yet.
      emit("pageBeforeDataBinding", { page: this });
      const html = Viraspa.services.databinding.bindTemplate(template, model);
      emit("pageOnDataBinding", { page: this, model });
      this.container.innerHTML = html;
      Viraspa.core.components.scan(this.container); // autoload components used in the page
      emit("pageAfterDataBinding", { page: this });
      return html;
    }

    // Shows this page (replacing the previous one) once its stylesheet has
    // loaded. Called by the default onLoad; a page that renders itself calls
    // it when its first content is ready. If it is never called, the page is
    // shown after onLoad finishes. Does nothing if a newer navigation won.
    display() {
      return this._display();
    }
  }

  Viraspa.core = Viraspa.core || {};
  Viraspa.core.Page = Page;
})(window.Viraspa);
