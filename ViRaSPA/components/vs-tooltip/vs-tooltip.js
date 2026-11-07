(function (Viraspa) {
  // A tooltip with rich content (HTML, links, buttons) for another element.
  // (For plain text, the tooltip helper's data-tooltip="…" is simpler.)
  //
  //   <button id="stock-info">Stock</button>
  //   <vs-tooltip for="stock-info" placement="bottom">
  //     <strong>Dar es Salaam:</strong> 120 · <strong>Arusha:</strong> 35 <a href="/stock">Details</a>
  //   </vs-tooltip>
  //
  // Shown on hover (after `delay`, default 300 ms) and on keyboard focus of
  // the target; it stays while the pointer is over it, so its links can be
  // used; hidden on leave, Escape or blur. placement: top (default), bottom,
  // left, right (flipped when there is no room). Events: "vs-show", "vs-hide".
  // Methods: show(), hide(). The target gets aria-describedby while shown.
  class VsTooltip extends Viraspa.core.Component {
    static tag = "vs-tooltip";
    static folder = "components/vs-tooltip";
    static isolation = "full";
    static hasModel = false;
    static observedAttributes = ["for"];

    get target() {
      const id = this.getAttribute("for");
      return id ? this.getRootNode().getElementById(id) : this.previousElementSibling;
    }

    async afterLoad() {
      this.box = this.componentRoot.querySelector(".box");
      this.box.id = Viraspa.utility.dom.uid("vs-tooltip");
      this.box.setAttribute("popover", "manual");
      this.attach();
      this.listen(this.box, "pointerenter", () => clearTimeout(this._hideTimer));
      this.listen(this.box, "pointerleave", () => this.hideSoon());
      this.listen(this.box, "keydown", (e) => e.key === "Escape" && this.hide(true));
    }

    attributeChangedCallback() {
      if (this.box) this.attach();
    }

    attach() {
      if (this._detach) this._detach();
      const target = this.target;
      if (!target) return;
      const delay = Number(this.getAttribute("delay") || 300);
      const enter = () => {
        clearTimeout(this._hideTimer);
        this._showTimer = setTimeout(() => this.show(), delay);
      };
      const leave = () => {
        clearTimeout(this._showTimer);
        this.hideSoon();
      };
      const focus = () => target.matches(":focus-visible") && this.show();
      const key = (e) => e.key === "Escape" && this.hide();
      target.addEventListener("pointerenter", enter);
      target.addEventListener("pointerleave", leave);
      target.addEventListener("focus", focus);
      target.addEventListener("blur", leave);
      target.addEventListener("keydown", key);
      this._detach = () => {
        target.removeEventListener("pointerenter", enter);
        target.removeEventListener("pointerleave", leave);
        target.removeEventListener("focus", focus);
        target.removeEventListener("blur", leave);
        target.removeEventListener("keydown", key);
      };
      this._scope.add(() => this._detach && this._detach());
    }

    show() {
      const target = this.target;
      if (!target || !this.box || this.box.matches(":popover-open")) return;
      this.box.showPopover();
      this._stop = Viraspa.utility.dom.follow(this.box, target, { placement: `${this.getAttribute("placement") || "top"}-start`, offset: 8 });
      target.setAttribute("aria-describedby", `${(target.getAttribute("aria-describedby") || "").replace(this.box.id, "")} ${this.box.id}`.trim());
      // aria-describedby can't point into a shadow root: describe with the text too.
      target.setAttribute("aria-description", this.textContent.trim().replace(/\s+/g, " "));
      this.dispatchEvent(new CustomEvent("vs-show", { bubbles: true, composed: true }));
    }

    hideSoon() {
      clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => this.hide(), 150);
    }

    hide(refocus = false) {
      clearTimeout(this._showTimer);
      if (!this.box || !this.box.matches(":popover-open")) return;
      this.box.hidePopover();
      if (this._stop) this._stop();
      const target = this.target;
      if (target) {
        target.removeAttribute("aria-description");
        const rest = (target.getAttribute("aria-describedby") || "").replace(this.box.id, "").trim();
        if (rest) target.setAttribute("aria-describedby", rest);
        else target.removeAttribute("aria-describedby");
        if (refocus) target.focus();
      }
      this.dispatchEvent(new CustomEvent("vs-hide", { bubbles: true, composed: true }));
    }
  }

  Viraspa.core.defineComponent(VsTooltip);
})(window.Viraspa);
