(function (Viraspa) {
  // The top bar of the app shell. It only arranges what you put in it:
  //   <vs-header sticky>
  //     <vs-brand slot="brand" name="VSales"></vs-brand>
  //     <vs-menu menu="main"></vs-menu>
  //     <vs-user-menu slot="end" name="Amina"></vs-user-menu>
  //   </vs-header>
  // Slots: start (e.g. a burger button for a vs-sidebar: <button slot="start"
  // class="vs-menu-button" data-sidebar-toggle>), brand, (default) the middle,
  // end. Attribute: sticky.
  // Colours: --vs-header-background, --vs-header-color.
  class VsHeader extends Viraspa.core.Component {
    static tag = "vs-header";
    static folder = Viraspa.core.frameworkUrl("components/vs-header");
    static isolation = "full";
    static hasModel = false;

    async afterLoad() {
      // The start area takes no room (no gap) while nothing is in it.
      const start = this.componentRoot.querySelector(".start");
      const slot = start.querySelector("slot");
      const sync = () => (start.hidden = slot.assignedElements().length === 0);
      this.listen(slot, "slotchange", sync);
      sync();
    }
  }

  Viraspa.core.defineComponent(VsHeader);
})(window.Viraspa);
