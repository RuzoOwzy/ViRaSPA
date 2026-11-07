(function (Viraspa) {
  // Keyboard support for apps used without a mouse (README "Keyboard").
  //
  // Shortcuts:
  //   const off = Viraspa.keyboard.shortcut("ctrl+s", save, { description: "Save" });
  //   this.shortcut("alt+n", addLine, { description: "New line" });   // in a page or component: removed with it
  //   Keys: "ctrl+s", "shift+?", "alt+m", "escape", "f2", "mod+k" (Ctrl, or Cmd on a Mac).
  //
  // The rules (the developer always wins):
  //   1. The framework handles keys last (on window, after your own
  //      handlers). If your code calls event.preventDefault(), it does nothing.
  //   2. data-keys="native" on any element switches framework keys off inside it.
  //   3. A shortcut without Ctrl/Alt/Cmd doesn't fire while the user types in
  //      a field, unless it says { inFields: true }.
  //   4. The most specific shortcut wins: one registered for an element (a
  //      component, a page) beats an app-wide one when focus is inside it.
  //   5. Nothing the browser does by itself (Ctrl+S, Ctrl+P...) is taken unless
  //      you register it.
  //
  // Components describe their keys as named actions with default keys
  // (Viraspa.keyboard.keymap), so an app or a page can move or switch off
  // each one. The "?" key shows the shortcuts in use.

  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
  const NAMES = { esc: "escape", del: "delete", return: "enter", space: " ", spacebar: " ", up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright", plus: "+" };

  const settings = {
    helpKey: "?", // false: no help overlay
    skipLink: true, // a "Skip to content" link, first in the tab order
    components: {}, // tag -> { action: "key" | false } - app-wide key changes for components
  };

  // "ctrl+shift+k" -> { ctrl, shift, alt, meta, key }
  function parse(keys) {
    const parts = String(keys).toLowerCase().split("+").map((p) => p.trim());
    // "ctrl++" ends with an empty part: the key is "+"
    if (parts[parts.length - 1] === "" && parts.length > 1) parts.splice(-2, 2, "+");
    const combo = { ctrl: false, shift: false, alt: false, meta: false, key: "" };
    for (const part of parts) {
      if (part === "ctrl" || part === "control") combo.ctrl = true;
      else if (part === "shift") combo.shift = true;
      else if (part === "alt" || part === "option") combo.alt = true;
      else if (part === "meta" || part === "cmd" || part === "command") combo.meta = true;
      else if (part === "mod") combo[IS_MAC ? "meta" : "ctrl"] = true;
      else combo.key = NAMES[part] || part;
    }
    return combo;
  }

  // Does the keydown event match "ctrl+s"? (Shift is ignored for printable
  // keys such as "?" that need it.)
  function matches(event, keys) {
    if (!keys) return false;
    const combo = typeof keys === "string" ? parse(keys) : keys;
    const key = (event.key || "").toLowerCase();
    if (key !== combo.key) return false;
    const printable = combo.key.length === 1 && combo.key !== " ";
    return event.ctrlKey === combo.ctrl && event.altKey === combo.alt && event.metaKey === combo.meta && (printable && !combo.shift ? true : event.shiftKey === combo.shift);
  }

  // How a key is shown: "Ctrl+S", "⌘K".
  function label(keys) {
    const c = parse(keys);
    const key = c.key === " " ? "Space" : c.key.length === 1 ? c.key.toUpperCase() : c.key.replace(/^arrow/, "").replace(/^\w/, (m) => m.toUpperCase());
    return [c.ctrl && "Ctrl", c.alt && (IS_MAC ? "⌥" : "Alt"), c.shift && "Shift", c.meta && (IS_MAC ? "⌘" : "Win"), key].filter(Boolean).join("+");
  }

  // ---- component key maps -----------------------------------------------
  // A component's keys: its defaults, then the app's settings for its tag,
  // then the element's own (the `keys` property, or a `keys` attribute with
  // JSON). A value of false switches an action off.
  //   keymap("vs-table-entry", { addRow: "enter", deleteRow: "ctrl+delete" }, element)
  function keymap(tag, defaults, element) {
    let own = {};
    if (element) {
      if (element.keys && typeof element.keys === "object") own = element.keys;
      else if (element.getAttribute && element.getAttribute("keys")) {
        try {
          own = JSON.parse(element.getAttribute("keys"));
        } catch {
          console.warn(`<${tag}> keys attribute is not valid JSON, e.g. keys='{"addRow": false}'.`);
        }
      }
    }
    return { ...defaults, ...(settings.components[tag] || {}), ...own };
  }

  // The action whose key the event matches, or null. Respects the rules
  // above: nothing when the event was already handled or keys are native here.
  function actionFor(event, map) {
    if (event.defaultPrevented || isNative(event)) return null;
    for (const [action, keys] of Object.entries(map)) {
      if (keys === false || keys === null) continue;
      for (const k of [].concat(keys)) if (matches(event, k)) return action;
    }
    return null;
  }

  const isNative = (event) => event.composedPath().some((node) => node instanceof Element && node.getAttribute("data-keys") === "native");
  const isField = (node) => node instanceof Element && (node.isContentEditable || /^(input|textarea|select)$/i.test(node.localName));

  // ---- shortcuts ------------------------------------------------------------
  const shortcuts = new Set(); // { combo, keys, handler, within, description, inFields }

  function shortcut(keys, handler, options = {}) {
    if (typeof handler !== "function") throw new Error(`Viraspa.keyboard.shortcut("${keys}") needs a function.`);
    const entry = { keys, combo: parse(keys), handler, within: options.within || null, description: options.description || "", inFields: Boolean(options.inFields) };
    shortcuts.add(entry);
    return () => shortcuts.delete(entry);
  }

  function onKeyDown(event) {
    if (event.defaultPrevented || event.isComposing || isNative(event)) return;
    const path = event.composedPath();
    const inField = path.some(isField);
    const hasModifier = event.ctrlKey || event.altKey || event.metaKey;
    let best = null;
    let bestDepth = Infinity;
    for (const entry of shortcuts) {
      if (!matches(event, entry.combo)) continue;
      if (inField && !hasModifier && !entry.inFields) continue;
      if (entry.within) {
        if (!entry.within.isConnected || entry.within.closest("[hidden]")) continue;
        const depth = path.indexOf(entry.within);
        // Element shortcuts fire when focus is inside the element, or for a
        // page's own shortcuts, anywhere while it is the page on screen.
        const pageWide = entry.within.classList && entry.within.classList.contains("vs-page");
        if (depth === -1 && !pageWide) continue;
        const rank = depth === -1 ? 1000 : depth;
        if (rank < bestDepth) {
          best = entry;
          bestDepth = rank;
        }
      } else if (!best) {
        best = entry;
      }
    }
    if (!best) {
      if (settings.helpKey && !inField && matches(event, settings.helpKey)) {
        event.preventDefault();
        showHelp();
      }
      return;
    }
    event.preventDefault();
    best.handler(event);
  }

  // ---- help overlay ---------------------------------------------------------
  function active() {
    return [...shortcuts].filter((s) => s.description && (!s.within || (s.within.isConnected && !s.within.closest("[hidden]"))));
  }

  function showHelp() {
    const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
    const dialog = document.createElement("dialog");
    dialog.className = "vs-keyboard-help";
    dialog.setAttribute("aria-label", t("Keyboard shortcuts"));
    const rows = active()
      .map((s) => `<tr><td><kbd>${Viraspa.utility.dom.escapeHtml(label(s.keys))}</kbd></td><td>${Viraspa.utility.dom.escapeHtml(t(s.description))}</td></tr>`)
      .join("");
    dialog.innerHTML =
      `<h2>${t("Keyboard shortcuts")}</h2>` +
      (rows ? `<table>${rows}</table>` : `<p>${t("This page has no shortcuts.")}</p>`) +
      `<p class="vs-keyboard-help-note">${t("Tab moves between fields; Esc closes.")}</p>` +
      `<form method="dialog"><button>${t("Close")}</button></form>`;
    document.body.appendChild(dialog);
    const previous = document.activeElement;
    dialog.addEventListener("close", () => {
      dialog.remove();
      if (previous && previous.focus) previous.focus();
    });
    dialog.showModal();
  }

  // ---- focus helpers --------------------------------------------------------
  const TABBABLE = 'a[href], area[href], button, input, select, textarea, iframe, summary, [contenteditable=""], [contenteditable="true"], [tabindex]';

  // Elements Tab reaches inside `root`, in order.
  function tabbables(root) {
    return [...root.querySelectorAll(TABBABLE)].filter(
      (el) => !el.disabled && el.tabIndex >= 0 && !el.closest("[hidden], [inert]") && (el.offsetParent !== null || el.getClientRects().length > 0)
    );
  }

  // Keeps Tab inside `container` (e.g. a popup) until release() is called;
  // then focus returns to where it was.
  function trapFocus(container, { initial } = {}) {
    const previous = document.activeElement;
    const onKey = (event) => {
      if (event.key !== "Tab") return;
      const list = tabbables(container);
      if (!list.length) return event.preventDefault();
      const first = list[0];
      const last = list[list.length - 1];
      const current = container.getRootNode().activeElement || document.activeElement;
      if (event.shiftKey && (current === first || !container.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !container.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", onKey);
    (initial || tabbables(container)[0] || container).focus();
    return function release() {
      container.removeEventListener("keydown", onKey);
      if (previous && previous.isConnected && previous.focus) previous.focus();
    };
  }

  // Arrow keys move focus between `items` (one tab stop for the group):
  //   roving(listElement, { items: () => list.querySelectorAll("[role=option]"), orientation: "vertical" })
  function roving(container, { items, orientation = "vertical", loop = true, onMove } = {}) {
    const list = () => [...(typeof items === "function" ? items() : container.querySelectorAll(items || "[role=option], [role=menuitem], [role=tab], [role=treeitem]"))];
    const keys = orientation === "horizontal" ? ["arrowleft", "arrowright"] : orientation === "both" ? ["arrowup", "arrowdown", "arrowleft", "arrowright"] : ["arrowup", "arrowdown"];
    const onKey = (event) => {
      if (event.defaultPrevented || isNative(event)) return;
      const key = event.key.toLowerCase();
      const all = list();
      if (!all.length) return;
      const current = all.indexOf(event.composedPath().find((n) => all.includes(n)));
      let next = -1;
      if (key === "home") next = 0;
      else if (key === "end") next = all.length - 1;
      else if (keys.includes(key)) {
        const back = key === "arrowup" || key === "arrowleft";
        next = current + (back ? -1 : 1);
        if (loop) next = (next + all.length) % all.length;
        else next = Math.max(0, Math.min(all.length - 1, next));
      } else return;
      event.preventDefault();
      all.forEach((el, i) => el.setAttribute("tabindex", i === next ? "0" : "-1"));
      all[next].focus();
      if (onMove) onMove(all[next], next);
    };
    container.addEventListener("keydown", onKey);
    const all = list();
    all.forEach((el, i) => el.setAttribute("tabindex", i === 0 ? "0" : "-1"));
    return () => container.removeEventListener("keydown", onKey);
  }

  // ---- skip link ----------------------------------------------------------
  function addSkipLink() {
    if (!settings.skipLink || document.querySelector(".vs-skip-link")) return;
    const link = document.createElement("a");
    link.className = "vs-skip-link";
    link.href = "#page-root";
    link.textContent = Viraspa.i18n ? Viraspa.i18n.t("Skip to content") : "Skip to content";
    link.addEventListener("click", (event) => {
      const root = document.getElementById("page-root");
      if (!root) return;
      event.preventDefault();
      const heading = root.querySelector(".vs-page:not([hidden]) h1") || root;
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      heading.focus();
    });
    document.body.prepend(link);
  }

  function configure(options = {}) {
    for (const key of ["helpKey", "skipLink"]) if (key in options) settings[key] = options[key];
    if (options.components) {
      for (const [tag, map] of Object.entries(options.components)) settings.components[tag] = { ...(settings.components[tag] || {}), ...map };
    }
  }

  // On window, so handlers on elements and on document (the app's own) run first.
  window.addEventListener("keydown", onKeyDown);
  document.addEventListener("viraspa:appInit", addSkipLink);

  Viraspa.keyboard = {
    configure,
    shortcut,
    active: () => active().map((s) => ({ keys: s.keys, label: label(s.keys), description: s.description })),
    showHelp,
    parse,
    matches,
    label,
    keymap,
    actionFor,
    tabbables,
    trapFocus,
    roving,
    isMac: IS_MAC,
  };
})(window.Viraspa);
