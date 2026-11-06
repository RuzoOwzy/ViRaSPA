(function (Viraspa) {
  // A spinner with an optional message, shown while something is working.
  //   <vs-busy-indicator active message="Loading users..."></vs-busy-indicator>
  //   <vs-busy-indicator overlay active></vs-busy-indicator>  covers its
  //       positioned parent (give the parent position: relative)
  // Attributes: active, message, overlay, delay (ms before it appears,
  // default 200, so quick work never flashes a spinner).
  // Screen readers hear the message (role="status").
  class VsBusyIndicator extends Viraspa.core.Component {
    static tag = "vs-busy-indicator";
    static folder = Viraspa.core.frameworkUrl("components/vs-busy-indicator");
    static isolation = "full";
    static observedAttributes = ["active", "message"];

    attributeChangedCallback(name) {
      if (!this._started) return;
      if (name === "message") {
        const text = this.componentRoot.querySelector(".message");
        if (text) text.textContent = this.getAttribute("message") || "";
      } else {
        this.updateVisibility();
      }
    }

    async afterLoad() {
      this.updateVisibility();
    }

    updateVisibility() {
      clearTimeout(this._timer);
      if (!this.hasAttribute("active")) {
        this.removeAttribute("visible");
        return;
      }
      const delay = Number(this.getAttribute("delay") ?? 200);
      this._timer = setTimeout(() => this.setAttribute("visible", ""), Math.max(0, delay));
    }

    show(message) {
      if (message !== undefined) this.setAttribute("message", message);
      this.setAttribute("active", "");
    }

    hide() {
      this.removeAttribute("active");
    }
  }

  Viraspa.core.defineComponent(VsBusyIndicator);
})(window.Viraspa);
