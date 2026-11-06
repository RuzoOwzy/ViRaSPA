(function (Viraspa) {
  // <vs-icon icon="lucide:house"></vs-icon>
  // <vs-icon icon="fontawesome:github:brands" label="GitHub"></vs-icon>
  // element.icon = { set: "fontawesome", name: "gear", style: "solid" };
  // Size follows the font size (1em); colour follows the text (currentColor).
  // Without `label` the icon is decorative (hidden from screen readers).
  class VsIcon extends Viraspa.core.Component {
    static tag = "vs-icon";
    static folder = Viraspa.core.frameworkUrl("components/vs-icon");
    static isolation = "full";
    static sharedStyles = [];
    static hasModel = false;
    static observedAttributes = ["icon", "label"];

    constructor() {
      super();
      this._renderCount = 0;
      // A value set before the element was upgraded.
      if (Object.prototype.hasOwnProperty.call(this, "icon")) {
        const value = this.icon;
        delete this.icon;
        this._icon = value;
      }
    }

    get icon() {
      return this._icon !== undefined ? this._icon : this.getAttribute("icon");
    }

    set icon(value) {
      this._icon = value;
      if (this._started) this.update();
    }

    async onLoad() {
      await Viraspa.core.styleIsolation.apply(this);
      await this.update();
    }

    attributeChangedCallback() {
      if (this._started) this.update();
    }

    async update() {
      const label = this.getAttribute("label");
      if (label) {
        this.setAttribute("role", "img");
        this.setAttribute("aria-label", label);
        this.removeAttribute("aria-hidden");
      } else {
        this.removeAttribute("role");
        this.removeAttribute("aria-label");
        this.setAttribute("aria-hidden", "true");
      }
      const renderId = ++this._renderCount;
      const element = await Viraspa.icons.render(this.icon, this.componentRoot);
      if (renderId !== this._renderCount) return; // a newer icon was set meanwhile
      this.componentRoot.replaceChildren(...(element ? [element] : []));
    }
  }

  Viraspa.core.defineComponent(VsIcon);
})(window.Viraspa);
