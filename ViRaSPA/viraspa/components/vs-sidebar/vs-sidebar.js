(function (Viraspa) {
  // A side panel for the app shell, usually holding a vertical menu:
  //   <vs-sidebar collapsible>
  //     <vs-menu orientation="vertical" menu="side"></vs-menu>
  //   </vs-sidebar>
  // Attributes:
  //   collapsible  shows a button that collapses the sidebar to icons
  //   collapsed    the collapsed state (the user's choice is remembered in
  //                this browser; on screens under 768px it starts collapsed)
  //   storage-key  where the choice is remembered (default "vs-sidebar")
  // Collapsing also sets `collapsed` on the vs-menu elements inside, so
  // they show icons with tooltips.
  class VsSidebar extends Viraspa.core.Component {
    static tag = "vs-sidebar";
    static folder = Viraspa.core.frameworkUrl("components/vs-sidebar");
    static isolation = "full";
    static observedAttributes = ["collapsed"];

    storageKey() {
      return this.getAttribute("storage-key") || "vs-sidebar";
    }

    async beforeLoad() {
      let saved = null;
      try {
        saved = localStorage.getItem(this.storageKey());
      } catch {
        // storage blocked: just don't remember
      }
      const collapsed = saved !== null ? saved === "collapsed" : window.matchMedia("(max-width: 767px)").matches;
      if (this.hasAttribute("collapsible")) this.toggleAttribute("collapsed", collapsed);
    }

    async afterLoad() {
      this.listen(this.componentRoot.querySelector(".collapse"), "click", () => this.toggle());
      this.syncChildren();
    }

    toggle(force) {
      const collapsed = force !== undefined ? Boolean(force) : !this.hasAttribute("collapsed");
      this.toggleAttribute("collapsed", collapsed);
      try {
        localStorage.setItem(this.storageKey(), collapsed ? "collapsed" : "expanded");
      } catch {
        // storage blocked
      }
    }

    attributeChangedCallback() {
      if (this._started) this.syncChildren();
    }

    syncChildren() {
      const collapsed = this.hasAttribute("collapsed");
      for (const menu of this.querySelectorAll("vs-menu")) menu.toggleAttribute("collapsed", collapsed);
      const button = this.componentRoot.querySelector(".collapse");
      if (button) {
        button.setAttribute("aria-expanded", String(!collapsed));
        button.setAttribute("aria-label", collapsed ? "Expand menu" : "Collapse menu");
        button.title = collapsed ? "Expand menu" : "Collapse menu";
      }
    }
  }

  Viraspa.core.defineComponent(VsSidebar);
})(window.Viraspa);
