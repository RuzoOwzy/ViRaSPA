(function (Viraspa) {
  // A list of navigation links, horizontal or vertical, with optional
  // groups, nested items, drop-downs and a search box.
  //
  //   <vs-menu menu="main"></vs-menu>                    built from the routes
  //   <vs-menu orientation="vertical" menu="side" searchable collapsible-groups></vs-menu>
  //   menuElement.items = [                              or given directly
  //     { label: "Dashboard", href: "/dashboard", icon: { set: "lucide", name: "layout-dashboard" } },
  //     { divider: true },
  //     { group: "Reports", items: [                     a group with a heading
  //       { label: "Sales", href: "/reports/sales", items: [   an item with nested items
  //         { label: "By region", href: "/reports/sales/regions" },
  //       ] },
  //       { group: "Archive", items: [ … ] },            groups can nest
  //     ] },
  //     { label: "Website", href: "https://example.com", external: true },
  //   ];
  //
  // From routes: every route with `nav` whose nav.menus includes this
  // menu's name ("main" when nav.menus is missing), in nav.order then route
  // order, leaving out routes the current user can't open.
  // nav: { label, icon, menus: ["main", "side"], order, divider: "before",
  //        group: "Reports" or "Reports/Archive" (nested groups),
  //        parent: "<route name>" (nested under that route's item),
  //        keywords: "more words the search box finds" },
  // or a list of such entries. A group's heading appears where its first
  // item would be.
  //
  // Attributes:
  //   orientation         "horizontal" (default) | "vertical"
  //   collapsed           vertical only: icons alone, the label shows as a tooltip
  //   menu                which routes to list (default "main")
  //   label               accessible name of the navigation (default "Main")
  //   searchable          vertical: a search box on top that filters the
  //                       items (case and accents ignored), keeping the groups
  //                       and parents of what matches
  //   collapsible-groups  vertical: group headings and items with nested items
  //                       open and close (remembered in this browser); the
  //                       group of the current page is always open
  //   search-placeholder  the search box's placeholder (default "Search…")
  //   toggle-icon         "more" (three dots) instead of the burger for the
  //                       folded small-screen menu, e.g. when a burger in the
  //                       header already opens a side menu
  //
  // Vertical menus show nested items and nested groups indented
  // (--vs-menu-indent). Horizontal menus show an item with nested items, or
  // a group, as a drop-down: click, Enter, Space or ArrowDown opens it,
  // Escape or a click elsewhere closes it. Horizontal menus fold into a
  // toggle button ("hamburger") on screens narrower than 768px, where the
  // drop-downs open in place. The current page's link gets
  // aria-current="page".
  const t = (text) => Viraspa.i18n.t(text);
  let uidCounter = 0;

  // "Élodie" -> "elodie", keeping a map back to the original positions.
  function fold(text) {
    let out = "";
    const map = [];
    for (let i = 0; i < text.length; i++) {
      const plain = text[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      for (const ch of plain) {
        out += ch;
        map.push(i);
      }
    }
    return { text: out, map };
  }

  class VsMenu extends Viraspa.core.Component {
    static tag = "vs-menu";
    static folder = Viraspa.core.frameworkUrl("components/vs-menu");
    static isolation = "full";
    static content = "none"; // no content of its own: may be written self-closing
    static observedAttributes = ["orientation", "searchable", "collapsible-groups"];

    constructor() {
      super();
      this._uid = `m${++uidCounter}`;
      this._query = "";
      if (Object.prototype.hasOwnProperty.call(this, "items")) {
        const value = this.items;
        delete this.items;
        this._items = value;
      }
    }

    get items() {
      return this._items || null;
    }

    // Setting items re-renders the menu (e.g. after the user's rights change).
    // While the menu is still loading, its first render picks them up (or
    // afterLoad renders again), so the elements never get replaced twice.
    set items(value) {
      this._items = value;
      this._itemsVersion = (this._itemsVersion || 0) + 1;
      if (this._loaded) this.render();
    }

    routeItems(menuName) {
      // A route's nav may be one entry or a list (to appear differently in
      // different menus, e.g. "Home" in the public menu, "Website" in the side menu).
      const entries = (Viraspa.routes || [])
        .flatMap((route, index) => [].concat(route.nav || []).map((nav) => ({ route, nav, index })))
        .filter(({ nav }) => (nav.menus || ["main"]).includes(menuName))
        // A route with parameters ("/customers/:id") has no single address to link to.
        .filter(({ route }) => !(route.path && Viraspa.routePaths.hasParams(route.path)))
        // Routes the current user can't open (private, missing privileges) are left out.
        .filter(({ route }) => Viraspa.session.canAccess(route))
        .sort((a, b) => (a.nav.order ?? a.index) - (b.nav.order ?? b.index));

      const byName = new Map();
      for (const entry of entries) {
        entry.item = { label: entry.nav.label, href: entry.route.path, icon: entry.nav.icon, keywords: entry.nav.keywords };
        if (entry.route.name && !byName.has(entry.route.name)) byName.set(entry.route.name, entry.item);
      }
      const root = [];
      const groupIn = (list, path) => {
        let container = list;
        for (const name of String(path).split("/").map((s) => s.trim()).filter(Boolean)) {
          let group = container.find((x) => x.group === name);
          if (!group) container.push((group = { group: name, items: [] }));
          container = group.items;
        }
        return container;
      };
      for (const { nav, item } of entries) {
        const parent = nav.parent && byName.get(nav.parent);
        const container = parent && parent !== item ? (parent.items = parent.items || []) : nav.group ? groupIn(root, nav.group) : root;
        if (nav.divider === "before") container.push({ divider: true });
        container.push(item);
      }
      return root;
    }

    // Dividers only between items: none first, last or twice in a row
    // (e.g. when the items above one are hidden for this user).
    tidy(items) {
      return items
        .filter((item, i, all) => !item.divider || (i > 0 && i < all.length - 1 && !all[i - 1].divider && all.slice(0, i).some((x) => !x.divider)))
        .map((item) => (item.items ? { ...item, items: this.tidy(item.items) } : item))
        .filter((item) => !(item.group && !item.items.some((x) => !x.divider)));
    }

    prepareModel(model) {
      this._renderedVersion = this._itemsVersion || 0;
      const items = this.tidy(this._items || this.routeItems(model.menu || "main"));
      model.orientation = model.orientation === "vertical" ? "vertical" : "horizontal";
      model.label = t(model.label);
      model.toggleLabel = t(model.toggleLabel);
      // "more" (three dots) where a burger already opens a side menu.
      model.toggleIconPath = this.getAttribute("toggle-icon") === "more" ? "M12 5h.01M12 12h.01M12 19h.01" : "M4 6h16M4 12h16M4 18h16";
      this._nodeCount = 0;
      this._vertical = model.orientation === "vertical";
      model.itemsHtml = this.renderItems(items, 0, "");
      const searchable = this._vertical && this.hasAttribute("searchable");
      const escapeHtml = Viraspa.utility.dom.escapeHtml;
      model.searchHtml = searchable
        ? `<div class="search-box" part="search"><input type="search" class="search" value="${escapeHtml(this._query)}" placeholder="${escapeHtml(t(this.getAttribute("search-placeholder") || "Search…"))}" aria-label="${escapeHtml(t("Search the menu"))}" autocomplete="off" spellcheck="false" part="search-input"><p class="no-match" hidden part="no-match">${escapeHtml(t("No match"))}</p></div>`
        : "";
      return model;
    }

    renderItems(items, level, path) {
      return items.map((item) => this.renderItem(item, level, path)).join("");
    }

    renderItem(original, level, path) {
      const escapeHtml = Viraspa.utility.dom.escapeHtml;
      if (original.divider) return '<li class="divider" role="separator" part="divider"></li>';
      const collapsible = this._vertical && this.hasAttribute("collapsible-groups");

      if (original.group) {
        const heading = t(original.group);
        const key = `${path}/${original.group}`;
        const id = `${this._uid}-g${++this._nodeCount}`;
        const open = this.isOpen(key);
        // A button where it opens and closes something: a collapsible vertical
        // group, or a top-level horizontal group (its drop-down). Groups
        // inside a drop-down are plain headings.
        const dropdownOpener = !this._vertical && level === 0;
        const headingHtml =
          collapsible || dropdownOpener
            ? `<button type="button" class="heading heading-button" id="${id}" aria-expanded="${dropdownOpener ? "false" : String(open)}" data-node="${escapeHtml(key)}" part="heading"><span class="label">${escapeHtml(heading)}</span><span class="chevron" aria-hidden="true"></span></button>`
            : `<span class="heading" id="${id}" part="heading">${escapeHtml(heading)}</span>`;
        return (
          `<li class="group level-${level}${!this._vertical && level === 0 ? " dropdown-host" : ""}" data-key="${escapeHtml(key)}" data-search="${escapeHtml(heading)}">` +
          headingHtml +
          `<ul class="sub${!this._vertical && level === 0 ? " dropdown" : ""}" role="list" aria-labelledby="${id}">${this.renderItems(original.items, level + 1, key)}</ul></li>`
        );
      }

      const item = { ...original, label: t(original.label) };
      const icon = item.icon ? (typeof item.icon === "object" ? JSON.stringify(item.icon) : item.icon) : "";
      const external = item.external ? ' target="_blank" rel="noopener external"' : "";
      // App paths ("/about") get the site's sub-folder, if it has one.
      const href = item.href && !item.external ? Viraspa.core.toUrlPath(item.href) : item.href;
      const children = item.items && item.items.some((x) => !x.divider) ? item.items : null;
      const key = `${path}/${original.label}`;
      const search = [item.label, item.keywords ? t(item.keywords) : ""].join(" ");
      const inner =
        (icon ? `<vs-icon class="icon" icon="${escapeHtml(icon)}"></vs-icon>` : "") + `<span class="label">${escapeHtml(item.label)}</span>`;
      const dropdown = children && !this._vertical && level === 0;
      const link = href
        ? `<a class="link" href="${escapeHtml(href)}" data-menu-label="${escapeHtml(item.label)}"${external} part="link">${inner}</a>`
        : `<button type="button" class="link parent-button" data-menu-label="${escapeHtml(item.label)}" aria-expanded="false" data-node="${escapeHtml(key)}" part="link">${inner}<span class="chevron" aria-hidden="true"></span></button>`;
      if (!children) return `<li class="item level-${level}" data-search="${escapeHtml(search)}">${link}</li>`;
      const subId = `${this._uid}-s${++this._nodeCount}`;
      const open = dropdown ? false : !collapsible || this.isOpen(key);
      // A parent with its own page gets a separate button for its nested items.
      const expander =
        href && (dropdown || collapsible)
          ? `<button type="button" class="expander" aria-expanded="${String(open)}" aria-controls="${subId}" aria-label="${escapeHtml(t("Show {label} items").replace("{label}", item.label))}" data-node="${escapeHtml(key)}" part="expander"><span class="chevron" aria-hidden="true"></span></button>`
          : "";
      const linkHtml = href ? link : link.replace('aria-expanded="false"', `aria-expanded="${String(open)}" aria-controls="${subId}"`);
      return (
        `<li class="item parent level-${level}${dropdown ? " dropdown-host" : ""}" data-key="${escapeHtml(key)}" data-search="${escapeHtml(search)}">` +
        `<div class="row">${linkHtml}${expander}</div>` +
        `<ul class="sub${dropdown ? " dropdown" : ""}" id="${subId}" role="list">${this.renderItems(children, level + 1, key)}</ul></li>`
      );
    }

    // ---- Open / closed groups (vertical, collapsible-groups) -------------------

    storageKey(key) {
      return `vs-menu:${this.getAttribute("menu") || "main"}:${key}`;
    }

    isOpen(key) {
      try {
        return localStorage.getItem(this.storageKey(key)) !== "closed";
      } catch {
        return true;
      }
    }

    remember(key, open) {
      try {
        if (open) localStorage.removeItem(this.storageKey(key));
        else localStorage.setItem(this.storageKey(key), "closed");
      } catch {
        // storage blocked: just don't remember
      }
    }

    nodeOf(button) {
      return button.closest("li");
    }

    setNodeOpen(li, open, { remember = true } = {}) {
      li.classList.toggle("closed", !open);
      li.classList.toggle("open", open);
      for (const button of li.querySelectorAll(":scope > .heading-button, :scope > .row > .expander, :scope > .row > .parent-button")) button.setAttribute("aria-expanded", String(open));
      if (remember && this._vertical && li.dataset.key) this.remember(li.dataset.key, open);
      // A drop-down that would run off the right edge opens leftwards.
      const dropdown = open && li.classList.contains("dropdown-host") && li.querySelector(":scope > .dropdown");
      if (dropdown) {
        li.classList.remove("align-end");
        if (dropdown.getBoundingClientRect().right > document.documentElement.clientWidth - 8) li.classList.add("align-end");
      }
    }

    closeDropdowns(except) {
      for (const li of this.componentRoot.querySelectorAll(".dropdown-host.open")) if (li !== except) this.setNodeOpen(li, false, { remember: false });
    }

    // ---- Lifecycle -------------------------------------------------------------

    async afterLoad() {
      // this.listen: removed automatically when the menu leaves the page.
      this.listen(document, "viraspa:routeChanged", () => this.highlightActive());
      // Signing in or out changes which routes are listed; a new language
      // changes the labels.
      this.listen(document, "viraspa:sessionChanged", () => !this._items && this.render());
      this.listen(document, "viraspa:localeChanged", () => this.render());
      this.listen(this.componentRoot, "click", (event) => this.onClick(event));
      this.listen(this.componentRoot, "keydown", (event) => this.onKey(event));
      this.listen(this.componentRoot, "input", (event) => {
        if (event.target.classList.contains("search")) this.applySearch(event.target.value);
      });
      // The folded (small-screen) menu and open drop-downs close on a click
      // elsewhere or Escape.
      this.listen(document, "click", (event) => {
        if (!event.composedPath().includes(this)) {
          this.setOpen(false);
          this.closeDropdowns();
        }
      });
      this.listen(document, "keydown", (event) => {
        if (event.key === "Escape") this.setOpen(false);
      });
      this._loaded = true;
      if (this._renderedVersion !== (this._itemsVersion || 0)) await this.render();
      else this.afterRender();
    }

    renderTemplate(template, model) {
      const html = super.renderTemplate(template, model);
      this.afterRender();
      return html;
    }

    afterRender() {
      if (!this.componentRoot.querySelector(".menu")) return;
      // Closed groups start closed (the class, from the stored state).
      for (const button of this.componentRoot.querySelectorAll("[data-node][aria-expanded]")) {
        const li = this.nodeOf(button);
        li.classList.toggle("closed", button.getAttribute("aria-expanded") === "false");
      }
      this.highlightActive();
      if (this._query) this.applySearch(this._query);
    }

    attributeChangedCallback() {
      if (this._started) this.render();
    }

    onClick(event) {
      const toggle = event.target.closest(".toggle");
      if (toggle) {
        this.setOpen(!this.componentRoot.querySelector(".menu").classList.contains("open"));
        return;
      }
      const opener = event.target.closest(".heading-button, .expander, .parent-button");
      if (opener) {
        const li = this.nodeOf(opener);
        const dropdown = li.classList.contains("dropdown-host");
        const willOpen = dropdown ? !li.classList.contains("open") : li.classList.contains("closed");
        if (dropdown) this.closeDropdowns(li);
        this.setNodeOpen(li, willOpen, { remember: !dropdown });
        return;
      }
      if (event.target.closest("a")) {
        this.setOpen(false);
        this.closeDropdowns();
      }
    }

    onKey(event) {
      const target = event.target;
      if (target.classList.contains("search")) {
        if (event.key === "Escape" && target.value) {
          event.stopPropagation();
          target.value = "";
          this.applySearch("");
        } else if (event.key === "ArrowDown" || event.key === "Enter") {
          const first = this.visibleLinks()[0];
          if (first) {
            event.preventDefault();
            if (event.key === "Enter" && first.tagName === "A") first.click();
            else first.focus();
          }
        }
        return;
      }
      const host = target.closest(".dropdown-host");
      if (!host) return;
      if (event.key === "Escape" && host.classList.contains("open")) {
        event.stopPropagation();
        this.setNodeOpen(host, false, { remember: false });
        const opener = host.querySelector(":scope > .heading-button, :scope > .row > .expander, :scope > .row > .parent-button");
        if (opener) opener.focus();
        return;
      }
      const links = [...host.querySelectorAll(".dropdown a.link, .dropdown .parent-button")];
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!host.classList.contains("open")) {
          this.closeDropdowns(host);
          this.setNodeOpen(host, true, { remember: false });
        }
        const index = links.indexOf(target);
        const next = links[index + 1] || links[0];
        if (next) next.focus();
      } else if (event.key === "ArrowUp" && links.includes(target)) {
        event.preventDefault();
        const index = links.indexOf(target);
        (links[index - 1] || links[links.length - 1]).focus();
      }
    }

    setOpen(open) {
      const menu = this.componentRoot.querySelector(".menu");
      if (!menu) return;
      menu.classList.toggle("open", open);
      const toggle = this.componentRoot.querySelector(".toggle");
      if (toggle) toggle.setAttribute("aria-expanded", String(open));
    }

    // ---- Search ----------------------------------------------------------------

    visibleLinks() {
      return [...this.componentRoot.querySelectorAll(".list a.link, .list .parent-button")].filter((el) => el.offsetParent !== null);
    }

    applySearch(value) {
      this._query = value;
      const list = this.componentRoot.querySelector(".list");
      if (!list) return;
      const words = fold(value.trim()).text.split(/\s+/).filter(Boolean);
      const searching = words.length > 0;
      this.toggleAttribute("data-searching", searching);
      const visit = (li) => {
        const own = fold(li.dataset.search || "").text;
        const ownMatch = searching && words.every((w) => own.includes(w));
        let childMatch = false;
        for (const child of li.querySelectorAll(":scope > ul > li, :scope > .sub > li")) if (visit(child)) childMatch = true;
        // A matching group or parent shows everything inside it.
        if (ownMatch) for (const inner of li.querySelectorAll("li")) inner.hidden = false;
        const show = !searching || ownMatch || childMatch;
        if (!li.classList.contains("divider")) li.hidden = !show;
        else li.hidden = searching;
        this.highlight(li, searching ? words : []);
        return show && !li.classList.contains("divider");
      };
      let any = false;
      for (const li of list.querySelectorAll(":scope > li")) if (visit(li)) any = true;
      const noMatch = this.componentRoot.querySelector(".no-match");
      if (noMatch) noMatch.hidden = any || !searching;
    }

    highlight(li, words) {
      const label = li.querySelector(":scope > .heading .label, :scope > span.heading, :scope > .link .label, :scope > .row > .link .label");
      if (!label) return;
      if (label.dataset.text === undefined) label.dataset.text = label.textContent;
      const text = label.dataset.text;
      const escapeHtml = Viraspa.utility.dom.escapeHtml;
      if (!words.length) {
        if (label.innerHTML !== escapeHtml(text)) label.textContent = text;
        return;
      }
      const { text: folded, map } = fold(text);
      const marks = new Array(text.length).fill(false);
      for (const word of words) {
        let from = 0;
        let at;
        while ((at = folded.indexOf(word, from)) !== -1) {
          for (let i = at; i < at + word.length; i++) marks[map[i]] = true;
          from = at + word.length;
        }
      }
      let html = "";
      let open = false;
      for (let i = 0; i < text.length; i++) {
        if (marks[i] && !open) (html += "<mark>"), (open = true);
        if (!marks[i] && open) (html += "</mark>"), (open = false);
        html += escapeHtml(text[i]);
      }
      if (open) html += "</mark>";
      label.innerHTML = html;
    }

    // ---- Current page ------------------------------------------------------------

    highlightActive() {
      const normalize = Viraspa.core.normalizePath;
      const appPath = (p) => normalize(Viraspa.core.toAppPath(p));
      const here = appPath(location.pathname);
      for (const li of this.componentRoot.querySelectorAll("li.contains-active")) li.classList.remove("contains-active");
      for (const link of this.componentRoot.querySelectorAll("a.link")) {
        const active = link.origin === location.origin && appPath(link.pathname) === here;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
        if (!active) continue;
        // Its groups and parents are marked, and (vertical) opened.
        let li = link.closest("li").parentElement.closest("li");
        while (li) {
          li.classList.add("contains-active");
          if (this._vertical && li.classList.contains("closed")) this.setNodeOpen(li, true, { remember: false });
          li = li.parentElement.closest("li");
        }
      }
    }
  }

  Viraspa.core.defineComponent(VsMenu);
})(window.Viraspa);
