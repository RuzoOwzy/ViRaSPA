(function (Viraspa) {
  // The signed-in user's name with a dropdown panel below it.
  //   <vs-user-menu name="Amina Juma" email="amina@example.com"></vs-user-menu>
  //   userMenu.items = [
  //     { label: "Profile", href: "/profile", icon: "lucide:user" },
  //     { label: "Change Credentials", href: "/change-credentials", icon: "lucide:key-round" },
  //     { divider: true },
  //     { label: "Sign Out", icon: "lucide:log-out", action: () => Viraspa.session.logout() },
  //   ];
  // Attributes: name, email, avatar (image URL; initials are shown otherwise).
  // An item with `action` is a button; one with `href` is a link. Choosing
  // any item closes the panel and dispatches a "vs-select" event
  // (detail: { item }). Keyboard: Enter/Space opens, arrows move, Escape closes.
  class VsUserMenu extends Viraspa.core.Component {
    static tag = "vs-user-menu";
    static folder = Viraspa.core.frameworkUrl("components/vs-user-menu");
    static isolation = "full";

    constructor() {
      super();
      if (Object.prototype.hasOwnProperty.call(this, "items")) {
        const value = this.items;
        delete this.items;
        this._items = value;
      }
    }

    get items() {
      return this._items || [];
    }

    set items(value) {
      this._items = value;
      if (this._started) this.render();
    }

    prepareModel(model) {
      const escapeHtml = Viraspa.utility.dom.escapeHtml;
      const words = String(model.name || "").trim().split(/\s+/).filter(Boolean);
      model.initials = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
      model.avatarHtml = model.avatar
        ? `<img class="avatar" src="${escapeHtml(model.avatar)}" alt="" part="avatar">`
        : `<span class="avatar" aria-hidden="true" part="avatar">${escapeHtml(model.initials)}</span>`;
      model.emailHtml = model.email ? `<div class="email">${escapeHtml(model.email)}</div>` : "";
      model.itemsHtml = this.items
        .map((item, index) => {
          if (item.divider) return '<div class="divider" role="separator"></div>';
          const icon = item.icon ? (typeof item.icon === "object" ? JSON.stringify(item.icon) : item.icon) : "";
          const inner = (icon ? `<vs-icon class="icon" icon="${escapeHtml(icon)}"></vs-icon>` : "") + `<span>${escapeHtml(item.label)}</span>`;
          return item.href
            ? `<a class="item" role="menuitem" tabindex="-1" href="${escapeHtml(item.href)}" data-index="${index}" part="item">${inner}</a>`
            : `<button class="item" type="button" role="menuitem" tabindex="-1" data-index="${index}" part="item">${inner}</button>`;
        })
        .join("");
      return model;
    }

    async afterLoad() {
      const root = this.componentRoot;
      root.addEventListener("click", (event) => {
        if (event.target.closest(".trigger")) this.setOpen(!this.isOpen());
        const item = event.target.closest(".item");
        if (item) this.choose(Number(item.dataset.index));
      });
      root.addEventListener("keydown", (event) => this.onKeyDown(event));
      document.addEventListener("click", (event) => {
        if (!event.composedPath().includes(this)) this.setOpen(false);
      });
    }

    isOpen() {
      const panel = this.componentRoot.querySelector(".panel");
      return Boolean(panel && !panel.hidden);
    }

    setOpen(open, { focusFirst = false } = {}) {
      const panel = this.componentRoot.querySelector(".panel");
      const trigger = this.componentRoot.querySelector(".trigger");
      if (!panel) return;
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
      if (open && focusFirst) this.menuItems()[0]?.focus();
    }

    menuItems() {
      return Array.from(this.componentRoot.querySelectorAll(".item"));
    }

    choose(index) {
      const item = this.items[index];
      this.setOpen(false);
      if (!item) return;
      this.dispatchEvent(new CustomEvent("vs-select", { detail: { item }, bubbles: true, composed: true }));
      if (typeof item.action === "function") item.action(item);
    }

    onKeyDown(event) {
      const items = this.menuItems();
      const current = items.indexOf(this.componentRoot.activeElement);
      if (event.key === "Escape" && this.isOpen()) {
        this.setOpen(false);
        this.componentRoot.querySelector(".trigger").focus();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!this.isOpen()) this.setOpen(true, { focusFirst: true });
        else items[(current + 1) % items.length]?.focus();
      } else if (event.key === "ArrowUp" && this.isOpen()) {
        event.preventDefault();
        items[(current - 1 + items.length) % items.length]?.focus();
      }
    }
  }

  Viraspa.core.defineComponent(VsUserMenu);
})(window.Viraspa);
