(function (Viraspa) {
  // Tooltips from one attribute:
  //   <button data-tooltip="Save (Ctrl+S)">💾</button>
  //   <span data-tooltip="Due in 3 days" data-tooltip-placement="bottom">…</span>
  //
  // Shown on hover (after a short delay), on keyboard focus and on a long
  // press on touch screens; hidden on leave, blur, Escape or scrolling.
  // Screen readers hear the text (aria-describedby while shown). Works for
  // elements inside components' shadow roots too. Placement: top (default),
  // bottom, left, right - flipped when there is no room.
  // Viraspa.tooltip.configure({ delay: 400, touchDelay: 500 })

  const settings = { delay: 400, touchDelay: 500 };
  let tip = null;
  let owner = null;
  let showTimer = null;

  function element() {
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "vs-tooltip";
      tip.id = "vs-tooltip";
      tip.setAttribute("role", "tooltip");
      tip.hidden = true;
      document.body.appendChild(tip);
    }
    return tip;
  }

  const holder = (event) => event.composedPath().find((n) => n instanceof Element && n.hasAttribute("data-tooltip") && n.getAttribute("data-tooltip"));

  function place(target, placement) {
    const box = target.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const gap = 8;
    const fits = {
      top: box.top - t.height - gap >= 0,
      bottom: box.bottom + t.height + gap <= innerHeight,
      left: box.left - t.width - gap >= 0,
      right: box.right + t.width + gap <= innerWidth,
    };
    const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" };
    const side = fits[placement] || !fits[opposite[placement]] ? placement : opposite[placement];
    let x;
    let y;
    if (side === "top" || side === "bottom") {
      x = box.left + box.width / 2 - t.width / 2;
      y = side === "top" ? box.top - t.height - gap : box.bottom + gap;
    } else {
      y = box.top + box.height / 2 - t.height / 2;
      x = side === "left" ? box.left - t.width - gap : box.right + gap;
    }
    x = Math.max(4, Math.min(x, innerWidth - t.width - 4));
    y = Math.max(4, Math.min(y, innerHeight - t.height - 4));
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    tip.dataset.side = side;
  }

  function show(target) {
    const text = target.getAttribute("data-tooltip");
    if (!text) return;
    element().textContent = Viraspa.i18n ? Viraspa.i18n.t(text) : text;
    tip.hidden = false;
    owner = target;
    target.setAttribute("aria-describedby", `${(target.getAttribute("aria-describedby") || "").replace(/\bvs-tooltip\b/, "")} vs-tooltip`.trim());
    place(target, target.getAttribute("data-tooltip-placement") || "top");
  }

  function hide() {
    clearTimeout(showTimer);
    if (!owner) return;
    const described = (owner.getAttribute("aria-describedby") || "").replace(/\bvs-tooltip\b/, "").trim();
    if (described) owner.setAttribute("aria-describedby", described);
    else owner.removeAttribute("aria-describedby");
    owner = null;
    if (tip) tip.hidden = true;
  }

  function later(target, delay) {
    clearTimeout(showTimer);
    showTimer = setTimeout(() => show(target), delay);
  }

  document.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    const target = holder(event);
    if (target && target !== owner) later(target, settings.delay);
  });
  document.addEventListener("pointerout", (event) => {
    const target = holder(event);
    if (target && !event.composedPath().includes(event.relatedTarget)) hide();
  });
  document.addEventListener("focusin", (event) => {
    const target = holder(event);
    if (target && target.matches(":focus-visible, :focus-within")) show(target);
  });
  document.addEventListener("focusout", () => hide());
  document.addEventListener("keydown", (event) => event.key === "Escape" && owner && hide());
  // Scrolling: a tooltip for the focused element moves along (focusing an
  // element often scrolls it into view); a hover tooltip closes.
  window.addEventListener(
    "scroll",
    () => {
      if (!owner) return;
      if (owner.matches(":focus, :focus-within")) place(owner, owner.getAttribute("data-tooltip-placement") || "top");
      else hide();
    },
    true
  );

  // Touch: a long press shows the tooltip (a tap still clicks as usual).
  let touchTimer = null;
  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    const target = holder(event);
    if (!target) return;
    touchTimer = setTimeout(() => show(target), settings.touchDelay);
  });
  for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, () => clearTimeout(touchTimer));

  Viraspa.tooltip = {
    configure: (options = {}) => Object.assign(settings, options),
    show: (target) => show(target),
    hide,
  };
})(window.Viraspa);
