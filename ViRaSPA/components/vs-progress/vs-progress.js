(function (Viraspa) {
  // Progress: how far a task has come, or that it is still going.
  //
  //   <vs-progress value="40"></vs-progress>                 a bar at 40%
  //   <vs-progress type="ring" value="3" max="8" show-value></vs-progress>
  //   <vs-progress type="dots" label="Loading orders"></vs-progress>   no value: still going
  //
  // type: bar (default) | ring | dots. Without `value` it is indeterminate
  // (the bar slides, the ring spins, the dots pulse). show-value prints
  // "40%" (or "3 / 8" with show-value="count"). `label` is read by screen
  // readers (role="progressbar"). Colours: --vs-progress-color,
  // --vs-progress-track; size: --vs-progress-size (bar height / ring size).
  // (For a page-wide loading line use Viraspa.busy - the top line.)
  class VsProgress extends Viraspa.core.Component {
    static tag = "vs-progress";
    static folder = "components/vs-progress";
    static isolation = "full";
    static hasModel = false;
    static observedAttributes = ["value", "max", "type", "label", "show-value"];

    get value() {
      const v = this.getAttribute("value");
      return v === null || v === "" ? null : Number(v);
    }
    set value(v) {
      if (v === null || v === undefined) this.removeAttribute("value");
      else this.setAttribute("value", String(v));
    }
    get max() {
      return Number(this.getAttribute("max")) || 100;
    }

    async afterLoad() {
      this.box = this.componentRoot.querySelector(".progress");
      this.text = this.componentRoot.querySelector(".text");
      this.update();
    }

    attributeChangedCallback() {
      if (this.box) this.update();
    }

    update() {
      const type = ["bar", "ring", "dots"].includes(this.getAttribute("type")) ? this.getAttribute("type") : "bar";
      const value = this.value;
      const determinate = value !== null && Number.isFinite(value);
      const ratio = determinate ? Math.max(0, Math.min(1, value / this.max)) : 0;
      this.box.dataset.type = type;
      this.box.toggleAttribute("data-indeterminate", !determinate);
      this.box.style.setProperty("--vs-progress-ratio", String(ratio));
      this.box.setAttribute("aria-label", this.getAttribute("label") || (Viraspa.i18n ? Viraspa.i18n.t("Progress") : "Progress"));
      if (determinate) {
        this.box.setAttribute("aria-valuenow", String(value));
        this.box.setAttribute("aria-valuemax", String(this.max));
      } else {
        this.box.removeAttribute("aria-valuenow");
      }
      const show = this.getAttribute("show-value");
      this.text.hidden = show === null || !determinate;
      this.text.textContent = show === "count" ? `${value} / ${this.max}` : new Intl.NumberFormat(Viraspa.i18n ? Viraspa.i18n.locale.peek() : undefined, { style: "percent" }).format(ratio);
    }
  }

  Viraspa.core.defineComponent(VsProgress);
})(window.Viraspa);
