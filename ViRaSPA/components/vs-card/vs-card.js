(function (Viraspa) {
  // <vs-card heading="Leanne Graham" subheading="leanne@example.com" icon="lucide:user">
  //   Body content.
  //   <a slot="footer" href="/users/1">Open</a>
  // </vs-card>
  // See README.md for attributes, slots, parts and CSS variables.
  class VsCard extends Viraspa.core.Component {
    static tag = "vs-card";
    static folder = "components/vs-card";
    static isolation = "full";

    prepareModel(model) {
      const escapeHtml = Viraspa.utility.dom.escapeHtml;
      const icon = model.icon && typeof model.icon === "object" ? JSON.stringify(model.icon) : model.icon;
      model.iconHtml = icon ? `<vs-icon class="icon" icon="${escapeHtml(icon)}" part="icon"></vs-icon>` : "";
      return model;
    }

    async afterLoad() {
      // Hide the body and footer areas when nothing is placed in them.
      for (const [selector, area] of [
        ["slot:not([name])", ".body"],
        ['slot[name="footer"]', ".footer"],
      ]) {
        const slot = this.componentRoot.querySelector(selector);
        const element = this.componentRoot.querySelector(area);
        const update = () =>
          (element.hidden = !slot
            .assignedNodes()
            .some((node) => node.nodeType === Node.ELEMENT_NODE || node.textContent.trim()));
        slot.addEventListener("slotchange", update);
        update();
      }
    }
  }

  Viraspa.core.defineComponent(VsCard);
})(window.Viraspa);
