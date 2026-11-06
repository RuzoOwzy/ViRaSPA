(function (Viraspa) {
  // Short, non-blocking messages:
  //   Viraspa.toast.show("Saved.", { type: "success" });
  //   const toast = await Viraspa.toast.show("Working...", { duration: 0 }); // stays
  //   toast.close();
  // type: "info" (default) | "success" | "warning" | "error"
  // duration: milliseconds before it closes by itself (0 = until closed).
  // One <vs-toast> region is added to the page the first time.
  async function region() {
    let el = document.querySelector("vs-toast");
    if (!el) {
      el = document.createElement("vs-toast");
      document.body.appendChild(el);
    }
    await Viraspa.core.components.load("vs-toast");
    await el.ready;
    return el;
  }

  async function show(message, options = {}) {
    return (await region()).show(message, options);
  }

  Viraspa.toast = { show };
})(window.Viraspa);
