// <native-counter label="Clicks"></native-counter>
// A component written in plain JavaScript with the standard Web Components
// APIs only - no Viraspa.* calls, no framework base class. The framework
// leaves it alone; it works on any page, in any framework or none.
(function () {
  class NativeCounter extends HTMLElement {
    constructor() {
      super();
      this.count = 0;
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `
        <style>
          :host { display: inline-flex; align-items: center; gap: 0.5rem; }
          button { font: inherit; padding: 0.35rem 0.8rem; border-radius: 6px; border: 1px solid #b9c9c1;
                   background: #fff; cursor: pointer; }
          button:hover { background: #eef4f1; }
          output { min-width: 2ch; font-weight: 700; }
        </style>
        <button type="button" part="button"></button>
        <output part="count" aria-live="polite">0</output>`;
      this.button = root.querySelector("button");
      this.output = root.querySelector("output");
      this.button.addEventListener("click", () => {
        this.count += 1;
        this.output.textContent = String(this.count);
        this.dispatchEvent(new CustomEvent("count-change", { detail: { count: this.count }, bubbles: true }));
      });
    }

    static get observedAttributes() {
      return ["label"];
    }

    connectedCallback() {
      this.button.textContent = this.getAttribute("label") || "Count";
    }

    attributeChangedCallback() {
      this.button.textContent = this.getAttribute("label") || "Count";
    }
  }

  if (!customElements.get("native-counter")) customElements.define("native-counter", NativeCounter);
})();
