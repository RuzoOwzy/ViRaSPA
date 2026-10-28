(function (Viraspa) {
  class Footer extends Viraspa.core.Component {
    async onLoad() {
      const { template, model } = await Viraspa.core.pageLoader.fetchComponent("components/footer/footer");
      this.renderTemplate(template, model);
    }
  }

  Viraspa.components = Viraspa.components || {};
  Viraspa.components.Footer = Footer;
})(window.Viraspa);
