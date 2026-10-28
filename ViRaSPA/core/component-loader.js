(function (Viraspa) {
  Viraspa.core = Viraspa.core || {};

  Viraspa.core.mountComponent = async function (ComponentClass, target, props = {}) {
    const component = new ComponentClass(props);

    Viraspa.core.emit("component:beforeLoad", { component });
    await Viraspa.core.runHook(component, "beforeLoad");

    Viraspa.core.emit("component:onLoad", { component });
    await Viraspa.core.runHook(component, "onLoad");

    const host = typeof target === "string" ? Viraspa.utility.dom.qs(target) : target;
    if (props.append) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = component.html;
      host.appendChild(wrapper.firstElementChild);
    } else {
      host.innerHTML = component.html;
    }

    Viraspa.core.emit("component:afterLoad", { component });
    await Viraspa.core.runHook(component, "afterLoad");

    return component;
  };
})(window.Viraspa);
