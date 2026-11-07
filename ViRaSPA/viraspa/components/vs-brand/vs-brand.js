(function (Viraspa) {
  // The site's logo and name, linking home.
  //   <vs-brand name="VSales" logo="app/assets/icons/favicon.svg"></vs-brand>
  //   <vs-brand name="VSales" icon="lucide:store" href="/"></vs-brand>
  // Attributes: name, href (default "/"), logo (an image) or icon.
  class VsBrand extends Viraspa.core.Component {
    static tag = "vs-brand";
    static folder = Viraspa.core.frameworkUrl("components/vs-brand");
    static isolation = "full";

    prepareModel(model) {
      const escapeHtml = Viraspa.utility.dom.escapeHtml;
      if (model.logo) model.logoHtml = `<img class="logo" src="${escapeHtml(model.logo)}" alt="" part="logo">`;
      else if (model.icon) {
        const icon = typeof model.icon === "object" ? JSON.stringify(model.icon) : model.icon;
        model.logoHtml = `<vs-icon class="logo" icon="${escapeHtml(icon)}" part="logo"></vs-icon>`;
      }
      else model.logoHtml = "";
      // An app path ("/") gets the site's sub-folder, if it has one.
      model.href = Viraspa.core.toUrlPath(model.href || "/");
      return model;
    }
  }

  Viraspa.core.defineComponent(VsBrand);
})(window.Viraspa);
