(function (Viraspa) {
  // The bottom bar of the app shell; shows whatever you put in it.
  //   <vs-footer>© 2026 VSales</vs-footer>
  // Colours: --vs-footer-background, --vs-footer-color.
  class VsFooter extends Viraspa.core.Component {
    static tag = "vs-footer";
    static folder = Viraspa.core.frameworkUrl("components/vs-footer");
    static isolation = "full";
    static hasModel = false;
  }

  Viraspa.core.defineComponent(VsFooter);
})(window.Viraspa);
