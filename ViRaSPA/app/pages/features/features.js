(function (Viraspa) {
  // Features: every core capability with links, plus small live demos.
  class FeaturesPage extends Viraspa.core.Page {
    async onLoad() {
      await super.onLoad();
      this.container.querySelector(".demo-toast").addEventListener("click", () =>
        Viraspa.toast.show("Hello from Viraspa.toast.show().", { type: "success" })
      );
      this.container.querySelector(".demo-busy").addEventListener("click", () =>
        Viraspa.busy.run(() => new Promise((resolve) => setTimeout(resolve, 1500)), { message: "Working for 1.5 seconds..." })
      );
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages.features = FeaturesPage;
})(window.Viraspa);
