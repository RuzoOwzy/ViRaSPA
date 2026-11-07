(function (Viraspa) {
  // A context menu (right-click menu) for an element or a group of elements.
  //
  //   <vs-context-menu for="#orders tbody tr">
  //     <button value="open" data-icon="lucide:external-link" data-shortcut="Enter">Open</button>
  //     <button value="edit" data-icon="lucide:pencil" data-shortcut="F2">Edit</button>
  //     <hr>
  //     <button value="delete" data-icon="lucide:trash-2" class="danger">Delete</button>
  //   </vs-context-menu>
  //   menu.addEventListener("vs-menu-select", (e) => act(e.detail.value, e.detail.target));
  //
  // - `for`: a CSS selector (matched in the same document or shadow root),
  //   or the parent element when left out. detail.target is the element that
  //   was right-clicked (e.g. the table row).
  // - Opens with a right-click, a long press on touch screens, and the
  //   keyboard (the Menu key or Shift+F10 on a focused target; keys = { open }).
  // - Up/Down/Home/End move, Enter/Space choose, Escape closes, letters jump.
  // - "vs-menu-open" (cancelable, detail: { target, items }) fires first: change
  //   items (e.g. disable "Delete") or cancel. Items: <button> with value,
  //   disabled, data-icon, data-shortcut; <hr> for a divider.
  const KEYS = { open: ["shift+f10", "contextmenu"] };

  class VsContextMenu extends Viraspa.core.Component {
    static tag = "vs-context-menu";
    static folder = "components/vs-context-menu";
    static isolation = "full";
    static hasModel = false;
    static observedAttributes = ["for"];

    async afterLoad() {
      this.menu = this.componentRoot.querySelector('[role="menu"]');
      this.menu.setAttribute("popover", "auto");
      this.decorate();
      this.listen(this.menu, "keydown", (e) => this.onMenuKey(e));
      this.listen(this.menu, "toggle", (e) => {
        if (e.newState === "closed") this.closed();
      });
      this.listen(this, "click", (e) => {
        const item = e.composedPath().find((n) => n instanceof HTMLButtonElement && this.contains(n));
        if (item && !item.disabled) this.choose(item);
      });
      this.attach();
    }

    attributeChangedCallback() {
      if (this.menu) this.attach();
    }

    items() {
      return [...this.querySelectorAll(":scope > button")];
    }

    // Roles, icons and shortcut hints for the light-DOM items.
    decorate() {
      for (const el of this.children) {
        if (el.localName === "hr") el.setAttribute("role", "separator");
        if (el.localName !== "button") continue;
        el.setAttribute("role", "menuitem");
        el.tabIndex = -1;
        if (el.dataset.icon && !el.querySelector("vs-icon")) el.insertAdjacentHTML("afterbegin", `<vs-icon icon="${Viraspa.utility.dom.escapeHtml(el.dataset.icon)}" aria-hidden="true"></vs-icon>`);
        if (el.dataset.shortcut && !el.querySelector(".shortcut")) el.insertAdjacentHTML("beforeend", `<kbd class="shortcut" aria-hidden="true">${Viraspa.utility.dom.escapeHtml(el.dataset.shortcut)}</kbd>`);
        if (el.dataset.shortcut) el.setAttribute("aria-keyshortcuts", el.dataset.shortcut);
      }
      Viraspa.core.components.scan(this);
    }

    targetFor(node) {
      const selector = this.getAttribute("for");
      const path = node && node.composedPath ? node.composedPath() : [node];
      if (!selector) {
        const parent = this.parentElement;
        return path.includes(parent) ? parent : null;
      }
      const root = this.getRootNode();
      const all = [...root.querySelectorAll(selector)];
      return path.find((n) => all.includes(n)) || null;
    }

    attach() {
      if (this._detach) this._detach();
      const root = this.getRootNode() === document ? document : this.getRootNode();
      const onContext = (e) => {
        const target = this.targetFor(e);
        if (!target) return;
        e.preventDefault();
        this.openAt(target, { x: e.clientX, y: e.clientY });
      };
      const onKey = (e) => {
        if (e.defaultPrevented) return;
        if (Viraspa.keyboard.actionFor(e, this.keymap(KEYS)) !== "open") return;
        const target = this.targetFor(e);
        if (!target) return;
        e.preventDefault();
        const r = target.getBoundingClientRect();
        this.openAt(target, { x: r.left + 8, y: r.bottom });
      };
      // Long press (touch): about half a second without moving.
      let timer = null;
      const onDown = (e) => {
        if (e.pointerType !== "touch") return;
        const target = this.targetFor(e);
        if (!target) return;
        timer = setTimeout(() => this.openAt(target, { x: e.clientX, y: e.clientY }), 550);
      };
      const cancel = () => clearTimeout(timer);
      root.addEventListener("contextmenu", onContext);
      root.addEventListener("keydown", onKey);
      root.addEventListener("pointerdown", onDown);
      root.addEventListener("pointerup", cancel);
      root.addEventListener("pointermove", cancel);
      this._detach = () => {
        root.removeEventListener("contextmenu", onContext);
        root.removeEventListener("keydown", onKey);
        root.removeEventListener("pointerdown", onDown);
        root.removeEventListener("pointerup", cancel);
        root.removeEventListener("pointermove", cancel);
      };
      this._scope.add(() => this._detach && this._detach());
    }

    // Opens the menu for `target` at a point (or under the target).
    openAt(target, point) {
      const open = new CustomEvent("vs-menu-open", { detail: { target, items: this.items() }, bubbles: true, composed: true, cancelable: true });
      if (!this.dispatchEvent(open)) return;
      this.decorate();
      this._target = target;
      this._returnFocus = document.activeElement;
      if (this.menu.matches(":popover-open")) this.menu.hidePopover();
      this.menu.showPopover();
      Viraspa.utility.dom.position(this.menu, target, { placement: point || "bottom-start" });
      const first = this.items().find((i) => !i.disabled);
      if (first) first.focus();
    }

    close() {
      if (this.menu.matches(":popover-open")) this.menu.hidePopover();
    }

    closed() {
      const back = this._returnFocus;
      if (back && back.isConnected && back.focus) back.focus();
    }

    choose(item) {
      const detail = { value: item.value || item.textContent.trim(), item, target: this._target };
      this.close();
      this.dispatchEvent(new CustomEvent("vs-menu-select", { detail, bubbles: true, composed: true }));
    }

    onMenuKey(event) {
      const items = this.items().filter((i) => !i.disabled);
      const current = items.indexOf(event.composedPath().find((n) => items.includes(n)));
      let next = null;
      if (event.key === "ArrowDown") next = items[(current + 1) % items.length];
      else if (event.key === "ArrowUp") next = items[(current - 1 + items.length) % items.length];
      else if (event.key === "Home") next = items[0];
      else if (event.key === "End") next = items[items.length - 1];
      else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (items[current]) this.choose(items[current]);
        return;
      } else if (event.key === "Tab") {
        event.preventDefault();
        this.close();
        return;
      } else if (event.key.length === 1 && /\S/.test(event.key)) {
        const letter = event.key.toLowerCase();
        const order = [...items.slice(current + 1), ...items.slice(0, current + 1)];
        next = order.find((i) => i.textContent.trim().toLowerCase().startsWith(letter)) || null;
      }
      if (next) {
        event.preventDefault();
        next.focus();
      }
    }
  }

  Viraspa.core.defineComponent(VsContextMenu);

  // The items are the page's own buttons: their inner layout is styled here.
  if (!document.getElementById("vs-context-menu-page-styles")) {
    const style = document.createElement("style");
    style.id = "vs-context-menu-page-styles";
    style.textContent = `
      vs-context-menu > button vs-icon { flex: none; color: var(--vs-color-text-muted); }
      vs-context-menu > button .shortcut { margin-inline-start: auto; padding-inline-start: 1.5rem; color: var(--vs-color-text-muted); font: .8em ui-monospace, Consolas, monospace; background: none; border: 0; }
    `;
    document.head.appendChild(style);
  }
})(window.Viraspa);
