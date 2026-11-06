(function (Viraspa) {
  // A simple card. Full isolation, with the shared base styles (base.css)
  // adopted into its shadow root - so .text-muted works inside it.
  // Uses Component's default onLoad: card.html + card.model.json defaults,
  // overridden by attributes (<app-card title="...">) and props.
  class Card extends Viraspa.core.Component {
    static tag = "app-card";
    static folder = "app/components/card";
    static isolation = "full";
  }

  Viraspa.core.defineComponent(Card);
})(window.Viraspa);
