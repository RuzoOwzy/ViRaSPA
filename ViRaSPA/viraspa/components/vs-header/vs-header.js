(function (Viraspa) {
  // The top bar of the app shell. It only arranges what you put in it:
  //   <vs-header sticky>
  //     <vs-brand slot="brand" name="VSales"></vs-brand>
  //     <vs-menu menu="main"></vs-menu>
  //     <vs-user-menu slot="end" name="Amina"></vs-user-menu>
  //   </vs-header>
  // Slots: brand, (default) the middle, end. Attribute: sticky.
  // Colours: --vs-header-background, --vs-header-color.
  class VsHeader extends Viraspa.core.Component {
    static tag = "vs-header";
    static folder = Viraspa.core.frameworkUrl("components/vs-header");
    static isolation = "full";
    static hasModel = false;
  }

  Viraspa.core.defineComponent(VsHeader);
})(window.Viraspa);
