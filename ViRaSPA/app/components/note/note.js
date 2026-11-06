(function (Viraspa) {
  // A note box with "scoped" isolation: its styles stay inside it, while the
  // page's styles still reach in (so links and text inside look like the
  // rest of the page). Content given between its tags fills its <slot>.
  //   <app-note heading="Tip">Any <a href="/about">HTML</a> here.</app-note>
  class Note extends Viraspa.core.Component {
    static tag = "app-note";
    static folder = "app/components/note";
    static isolation = "scoped";
  }

  Viraspa.core.defineComponent(Note);
})(window.Viraspa);
