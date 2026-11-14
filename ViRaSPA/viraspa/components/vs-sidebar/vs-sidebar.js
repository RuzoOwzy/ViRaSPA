(function (Viraspa) {
  // A side panel for the app shell, usually holding a vertical menu:
  //   <vs-sidebar collapsible>
  //     <vs-menu orientation="vertical" menu="side"></vs-menu>
  //   </vs-sidebar>
  // Attributes:
  //   collapsible  shows a button that collapses the sidebar
  //   collapse     how it collapses: "rail" (default) - down to icons, with
  //                the labels as tooltips; "hide" - out of sight, so the
  //                page gets the full width. On screens under 768px a
  //                "hide" sidebar opens over the page and closes again on a
  //                link, Escape or a click outside it.
  //   collapsed    the collapsed state (the user's choice is remembered in
  //                this browser; on screens under 768px it starts collapsed)
  //   storage-key  where the choice is remembered (default "vs-sidebar")
  // A button anywhere on the page opens and closes it (needed with "hide",
  // where the sidebar's own button is out of sight when it is collapsed):
  //   <button type="button" data-sidebar-toggle>…</button>        the first sidebar
  //   <button type="button" data-sidebar-toggle="docs-nav">…</button>  by id
  // Such buttons get aria-expanded and aria-controls. In rail mode,
  // collapsing also sets `collapsed` on the vs-menu elements inside, so they
  // show icons with tooltips.
  const PHONE = "(max-width: 767px)";
  let idCounter = 0;

  class VsSidebar extends Viraspa.core.Component {
    static tag = "vs-sidebar";
    static folder = Viraspa.core.frameworkUrl("components/vs-sidebar");
    static isolation = "full";
    static observedAttributes = ["collapsed", "collapse"];

    storageKey() {
      return this.getAttribute("storage-key") || "vs-sidebar";
    }

    get mode() {
      return this.getAttribute("collapse") === "hide" ? "hide" : "rail";
    }

    isPhone() {
      return window.matchMedia(PHONE).matches;
    }

    async beforeLoad() {
      if (!this.id) this.id = `vs-sidebar-${++idCounter}`;
      let saved = null;
      try {
        saved = localStorage.getItem(this.storageKey());
      } catch {
        // storage blocked: just don't remember
      }
      // On phones a sidebar always starts closed; elsewhere the user's choice wins.
      const collapsed = this.isPhone() ? true : saved !== null ? saved === "collapsed" : false;
      if (this.hasAttribute("collapsible") || this.mode === "hide") this.toggleAttribute("collapsed", collapsed);
    }

    async afterLoad() {
      this.listen(this.componentRoot.querySelector(".collapse"), "click", () => this.toggle());
      this.listen(this.componentRoot.querySelector(".backdrop"), "click", () => this.toggle(true));
      this.listen(document, "click", (event) => {
        const button = event.composedPath().find((el) => el.nodeType === 1 && el.hasAttribute("data-sidebar-toggle"));
        if (button && this.controlledBy(button)) {
          event.preventDefault();
          this.toggle();
          return;
        }
        // A link chosen in an open phone drawer closes it.
        if (this.isDrawer() && event.composedPath().some((el) => el.localName === "a") && event.composedPath().includes(this)) this.toggle(true, { remember: false });
      });
      this.listen(document, "keydown", (event) => {
        if (event.key === "Escape" && this.isDrawer()) {
          this.toggle(true, { remember: false });
          const button = this.toggleButtons()[0];
          if (button) button.focus();
        }
      });
      this.listen(window.matchMedia(PHONE), "change", () => {
        if (this.isPhone()) this.toggleAttribute("collapsed", true);
        this.syncChildren();
      });
      this.syncChildren();
    }

    // An open "hide" sidebar on a phone: it floats over the page.
    isDrawer() {
      return this.mode === "hide" && this.isPhone() && !this.hasAttribute("collapsed");
    }

    controlledBy(button) {
      const target = button.getAttribute("data-sidebar-toggle");
      if (target) return target === this.id;
      return document.querySelector("vs-sidebar") === this;
    }

    toggleButtons() {
      return [...document.querySelectorAll("[data-sidebar-toggle]")].filter((button) => this.controlledBy(button));
    }

    toggle(force, { remember = true } = {}) {
      const collapsed = force !== undefined ? Boolean(force) : !this.hasAttribute("collapsed");
      this.toggleAttribute("collapsed", collapsed);
      // A phone's drawer state is not a preference worth keeping.
      if (!remember || this.isPhone()) return;
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
      const rail = this.mode === "rail";
      for (const menu of this.querySelectorAll("vs-menu")) menu.toggleAttribute("collapsed", rail && collapsed);
      this.toggleAttribute("data-drawer", this.isDrawer());
      // Hidden content can't be reached with Tab.
      this.inert = this.mode === "hide" && collapsed;
      const label = collapsed ? "Expand menu" : "Collapse menu";
      const button = this.componentRoot.querySelector(".collapse");
      if (button) {
        button.setAttribute("aria-expanded", String(!collapsed));
        button.setAttribute("aria-label", label);
        button.title = label;
      }
      for (const toggle of this.toggleButtons()) {
        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.setAttribute("aria-controls", this.id);
        if (!toggle.hasAttribute("aria-label") && !toggle.textContent.trim()) toggle.setAttribute("aria-label", "Menu");
      }
    }
  }

  Viraspa.core.defineComponent(VsSidebar);
})(window.Viraspa);
