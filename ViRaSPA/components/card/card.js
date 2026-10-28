(function (Viraspa) {
  class Card extends Viraspa.core.Component {
    async onLoad() {
      const { template, model: defaults } = await Viraspa.core.pageLoader.fetchComponent("components/card/card");
      this.renderTemplate(template, { ...defaults, ...this.props });
    }
  }

  Viraspa.components = Viraspa.components || {};
  Viraspa.components.Card = Card;
})(window.Viraspa);
