(function (Viraspa) {
  // Uses Component's default onLoad: renders footer.html with footer.model.json.
  class Footer extends Viraspa.core.Component {
    static tag = "app-footer";
    static folder = "app/components/footer";
    static isolation = "full";
  }

  Viraspa.core.defineComponent(Footer);
})(window.Viraspa);
