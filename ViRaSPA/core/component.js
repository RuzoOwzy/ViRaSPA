(function (Viraspa) {
  class Component {
    constructor(props = {}) {
      this.props = props;
      this.html = "";
    }

    async beforeLoad() {}
    async onLoad() {}
    async afterLoad() {}

    renderTemplate(template, model) {
      Viraspa.core.emit("component:beforeDataBinding", { component: this });
      this.html = Viraspa.services.databinding.bindTemplate(template, model);
      Viraspa.core.emit("component:onDataBinding", { component: this, model });
      Viraspa.core.emit("component:afterDataBinding", { component: this });
      return this.html;
    }
  }

  Viraspa.core = Viraspa.core || {};
  Viraspa.core.Component = Component;
})(window.Viraspa);
