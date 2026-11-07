(function (Viraspa) {
  // Base class for framework pages. The router creates one per visit (or
  // keeps it, for routes with keepAlive: true) and renders it into its own
  // element, `this.container` (<div class="vs-page" data-page="name">).
  //
  // Pages work with the normal `document` (no Shadow DOM): page CSS is
  // switched on only while the page is shown.
  class Page {
    constructor(container, route, { signal, display, setHead } = {}) {
      this.container = container;
      this.route = route;
      this._setHead = setHead || (() => {});
      // Aborted when the user leaves this page (or a newer navigation wins
      // before it is shown) - pass it to fetch/call to cancel requests.
      this.signal = signal;
      this._display = display || (async () => {});
      // e.g. "app/pages/home/home" - the page's .html/.css/.model.json.
      this.basePath = Viraspa.core.pageLoader.basePath(route.page);
      // The page's effects and bindings, disposed when the page is removed.
      this._scope = Viraspa.state.createScope();
      this._bindingScope = null;
    }

    // Runs fn now and whenever the signals it reads change, until the page
    // is removed. fn may return a cleanup function.
    effect(fn) {
      return this._scope.effect(fn);
    }

    // addEventListener that is removed with the page (e.g. on document).
    listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      this._scope.add(() => target.removeEventListener(type, handler, options));
    }

    // Called by the router when the page is removed.
    dispose() {
      if (this._bindingScope) this._bindingScope.dispose();
      this._scope.dispose();
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

    // Renders the template with the model. Names in {{ }} are looked up in
    // the model, then on the page itself (its signals, computed values and
    // methods), so signals on the page stay live on screen.
    renderTemplate(template, model) {
      const { emit } = Viraspa.core;
      // Dispatched on document: the page's element may not be on screen yet.
      emit("pageBeforeDataBinding", { page: this });
      if (this._bindingScope) this._bindingScope.dispose();
      this._bindingScope = Viraspa.state.createScope();
      const html = Viraspa.services.databinding.render(this.container, template, model, { owner: this, scope: this._bindingScope });
      emit("pageOnDataBinding", { page: this, model });
      Viraspa.core.components.scan(this.container); // autoload components used in the page
      Viraspa.session.applyPrivileges(this.container); // data-privilege-required...
      Viraspa.i18n.translate(this.container); // data-i18n
      emit("pageAfterDataBinding", { page: this });
      return html;
    }

    // Fills the {{placeholders}} in the route's head information, e.g.
    // head: { title: "{{name}} on VibeNet" } + this.setHeadData({ name }).
    setHeadData(data) {
      this._setHead(data, undefined);
    }

    // Replaces head values outright: this.setHead({ title, description, image }).
    setHead(values) {
      this._setHead(undefined, values);
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
