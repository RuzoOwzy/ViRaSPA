(function (Viraspa) {
  // <vs-stat-tile label="Sales Today" value="TZS 1,250,000" icon="lucide:banknote"
  //               trend="up" trend-text="+12% vs yesterday"></vs-stat-tile>
  // See README.md.
  const ARROWS = { up: "▲", down: "▼", flat: "■" };

  class VsStatTile extends Viraspa.core.Component {
    static tag = "vs-stat-tile";
    static folder = "components/vs-stat-tile";
    static isolation = "full";

    prepareModel(model) {
      const escapeHtml = Viraspa.utility.dom.escapeHtml;
      const icon = model.icon && typeof model.icon === "object" ? JSON.stringify(model.icon) : model.icon;
      model.iconHtml = icon ? `<vs-icon class="icon" icon="${escapeHtml(icon)}" part="icon"></vs-icon>` : "";
      model.trend = ARROWS[model.trend] ? model.trend : "";
      model.trendArrow = model.trend ? `<span aria-hidden="true">${ARROWS[model.trend]}</span>` : "";
      model.trendWord = { up: "Up", down: "Down", flat: "No change" }[model.trend] || "";
      return model;
    }
  }

  Viraspa.core.defineComponent(VsStatTile);
})(window.Viraspa);
