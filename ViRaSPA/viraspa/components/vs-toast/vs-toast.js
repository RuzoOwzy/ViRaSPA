(function (Viraspa) {
  // The area where toasts appear. Usually created for you by
  // Viraspa.toast.show(message, { type, duration }); place one yourself to
  // choose its position: <vs-toast position="top-right"></vs-toast>
  // position: "bottom-right" (default) | "bottom-left" | "top-right" |
  //           "top-left" | "top-center" | "bottom-center"
  class VsToast extends Viraspa.core.Component {
    static tag = "vs-toast";
    static folder = Viraspa.core.frameworkUrl("components/vs-toast");
    static isolation = "full";
    static hasModel = false;

    // Shows a message; resolves at once with { close() }.
    show(message, { type = "info", duration = 4000 } = {}) {
      const region = this.componentRoot.querySelector(".region");
      const item = document.createElement("div");
      item.className = `toast ${["success", "warning", "error"].includes(type) ? type : "info"}`;
      item.setAttribute("role", type === "error" ? "alert" : "status");
      item.setAttribute("part", "toast");

      const text = document.createElement("div");
      text.className = "text";
      text.textContent = String(message);
      const close = document.createElement("button");
      close.type = "button";
      close.className = "close";
      close.setAttribute("aria-label", "Close");
      close.textContent = "×";
      item.append(text, close);
      region.appendChild(item);

      let timer = null;
      const remove = () => {
        clearTimeout(timer);
        item.classList.add("leaving");
        setTimeout(() => item.remove(), 150);
      };
      close.addEventListener("click", remove);
      if (duration > 0) timer = setTimeout(remove, duration);
      return { close: remove };
    }
  }

  Viraspa.core.defineComponent(VsToast);
})(window.Viraspa);
