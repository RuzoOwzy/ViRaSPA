(function (Viraspa) {
  // A tree: categories, a chart of accounts, folders.
  //
  //   <vs-tree selectable="single" filter></vs-tree>
  //   tree.nodes = [{ id: 1, label: "Assets", children: [{ id: 11, label: "Cash" }], expanded: true }];
  //   tree.items = flatList;            // or a flat list: id-field, parent-field ("parent"), label-field
  //   tree.load = async (node, { signal }) => fetchChildren(node.id, signal);   // children on demand (hasChildren: true)
  //
  // Node fields: id, label, children, icon, expanded, hasChildren (load on
  // expand), locked (can't be renamed, deleted or moved), disabled.
  // selectable: single | multiple (checkboxes; `cascade` checks a branch).
  // filter: a filter box; matches stay visible with their parents.
  // editable: add / rename / delete / move, each can be left out with
  // actions="add,rename" etc.; delete-leaves-only. Give the handlers that save
  // to your server (each may throw to refuse, with the message shown):
  //   tree.onAdd = async (parent, label) => ({ id: newId, label });
  //   tree.onRename = async (node, label) => {};   tree.onDelete = async (node) => {};
  //   tree.onMove = async (node, newParent) => {};
  // Keyboard (ARIA tree): Up/Down, Right (open / first child), Left (close /
  // parent), Home/End, Enter (open the node: "vs-node-open"), Space (select),
  // * (open the siblings), letters (jump); editing: Insert (add a child), F2
  // (rename), Delete, Ctrl+X then Ctrl+V (move). Keys overridable: keys =
  // { add, rename, delete, cut, paste }.
  // value: the selected id (single) or ids (multiple). Events:
  // "vs-node-select", "vs-node-open", "vs-node-toggle", "vs-selection-change".
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const esc = (s) => Viraspa.utility.dom.escapeHtml(s);
  const plain = (v) => String(v ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const KEYS = { add: "insert", rename: "f2", delete: "delete", cut: "mod+x", paste: "mod+v" };

  class VsTree extends Viraspa.core.Component {
    static tag = "vs-tree";
    static folder = "components/vs-tree";
    static isolation = "full";
    static hasModel = false;
    static observedAttributes = ["selectable", "filter", "editable", "actions"];

    constructor() {
      super();
      this._nodes = [];
      this.byId = new Map();
      this.parentOf = new Map();
      this._selected = new Set();
      this._focusId = null;
      this.load = null;
    }

    // ---- data ------------------------------------------------------------------
    get nodes() {
      return this._nodes;
    }
    set nodes(list) {
      this._nodes = Array.isArray(list) ? list : [];
      this.index();
      this.draw();
    }
    set items(flat) {
      const idF = this.getAttribute("id-field") || "id";
      const parentF = this.getAttribute("parent-field") || "parent";
      const labelF = this.getAttribute("label-field") || "label";
      const map = new Map();
      for (const item of flat || []) map.set(String(item[idF]), { ...item, id: item[idF], label: item[labelF] ?? item.label, children: [] });
      const roots = [];
      for (const node of map.values()) {
        const parent = node[parentF] !== undefined && node[parentF] !== null && node[parentF] !== "" ? map.get(String(node[parentF])) : null;
        if (parent) parent.children.push(node);
        else roots.push(node);
      }
      for (const node of map.values()) if (!node.children.length && !node.hasChildren) delete node.children;
      this.nodes = roots;
    }

    index() {
      this.byId.clear();
      this.parentOf.clear();
      const walk = (list, parent) => {
        for (const node of list) {
          this.byId.set(String(node.id), node);
          this.parentOf.set(String(node.id), parent);
          if (node.children) walk(node.children, node);
        }
      };
      walk(this._nodes, null);
    }

    node(id) {
      return this.byId.get(String(id)) || null;
    }
    parent(node) {
      return this.parentOf.get(String(node.id)) || null;
    }
    hasKids(node) {
      return Boolean((node.children && node.children.length) || node.hasChildren);
    }
    isAncestor(maybe, node) {
      for (let p = this.parent(node); p; p = this.parent(p)) if (p === maybe) return true;
      return false;
    }

    get value() {
      const ids = [...this._selected];
      return this.getAttribute("selectable") === "multiple" ? ids : ids[0] ?? "";
    }
    set value(v) {
      this._selected = new Set([].concat(v === "" || v === null || v === undefined ? [] : v).map(String));
      this.draw();
    }
    get selectedNodes() {
      return [...this._selected].map((id) => this.node(id)).filter(Boolean);
    }
    can(action) {
      if (!this.hasAttribute("editable")) return false;
      const list = this.getAttribute("actions");
      return !list || list.split(",").map((s) => s.trim()).includes(action);
    }

    // ---- set-up ----------------------------------------------------------------
    async afterLoad() {
      const root = this.componentRoot;
      this.tree = root.querySelector('[role="tree"]');
      this.filterBox = root.querySelector(".filter");
      this.message = root.querySelector(".message");
      this.filterBox.placeholder = t("Filter…");
      this.filterBox.setAttribute("aria-label", t("Filter the tree"));
      this.tree.setAttribute("aria-label", this.getAttribute("label") || t("Tree"));
      this.listen(this.filterBox, "input", () => this.draw());
      this.listen(this.tree, "click", (e) => this.onClick(e));
      this.listen(this.tree, "dblclick", (e) => {
        const item = e.target.closest('[role="treeitem"]');
        if (item && !e.target.closest("button, input")) this.openNode(this.node(item.dataset.id));
      });
      this.listen(this.tree, "keydown", (e) => this.onKey(e));
      this.listen(this.tree, "dragstart", (e) => this.onDragStart(e));
      this.listen(this.tree, "dragover", (e) => this.onDragOver(e));
      this.listen(this.tree, "drop", (e) => this.onDrop(e));
      this.listen(this.tree, "dragend", () => this.tree.querySelectorAll(".drop").forEach((el) => el.classList.remove("drop")));
      this.draw();
    }

    attributeChangedCallback() {
      if (this.tree) this.draw();
    }

    // ---- rendering ----------------------------------------------------------------
    // Ids to show for the filter: matches and their ancestors (and open them).
    visibleIds() {
      const words = plain(this.filterBox ? this.filterBox.value : "").split(/\s+/).filter(Boolean);
      if (!words.length) return null;
      const keep = new Set();
      for (const node of this.byId.values()) {
        if (words.every((w) => plain(node.label).includes(w))) {
          keep.add(String(node.id));
          for (let p = this.parent(node); p; p = this.parent(p)) keep.add(String(p.id));
        }
      }
      return keep;
    }

    // Draws the tree (named draw, not render: Component.render() renders the template).
    draw() {
      if (!this.tree) return;
      this.filterBox.hidden = !this.hasAttribute("filter");
      const visible = this.visibleIds();
      const mode = this.getAttribute("selectable");
      this.tree.setAttribute("aria-multiselectable", String(mode === "multiple"));
      const draw = (list, level) =>
        list
          .filter((n) => !visible || visible.has(String(n.id)))
          .map((n, i, all) => {
            const id = String(n.id);
            const kids = this.hasKids(n);
            const open = kids && (n.expanded || Boolean(visible));
            const state = mode === "multiple" ? this.checkState(n) : null;
            const selected = this._selected.has(id);
            const attrs = [
              `role="treeitem"`,
              `data-id="${esc(id)}"`,
              `aria-level="${level}"`,
              `aria-setsize="${all.length}"`,
              `aria-posinset="${i + 1}"`,
              kids ? `aria-expanded="${open}"` : "",
              mode === "multiple" ? `aria-checked="${state}"` : mode === "single" ? `aria-selected="${selected}"` : "",
              n.disabled ? 'aria-disabled="true"' : "",
              `tabindex="${id === String(this._focusId) ? 0 : -1}"`,
              this.can("move") && !n.locked ? 'draggable="true"' : "",
            ].join(" ");
            const icon = n.icon ? `<vs-icon class="icon" icon="${esc(n.icon)}" aria-hidden="true"></vs-icon>` : "";
            const toggle = kids ? `<span class="toggle" aria-hidden="true"></span>` : `<span class="leaf" aria-hidden="true"></span>`;
            const check = mode === "multiple" ? `<span class="check" data-state="${state}" aria-hidden="true"></span>` : "";
            const tools = this.hasAttribute("editable") && !n.locked
              ? `<span class="tools">${this.can("add") ? `<button type="button" class="tool add" tabindex="-1" aria-label="${esc(t("Add under {name}").replace("{name}", n.label))}">+</button>` : ""}${
                  this.can("delete") && (!this.hasAttribute("delete-leaves-only") || !kids) ? `<button type="button" class="tool remove" tabindex="-1" aria-label="${esc(t("Delete {name}").replace("{name}", n.label))}">&times;</button>` : ""
                }</span>`
              : "";
            const lock = n.locked ? `<span class="lock" title="${esc(t("Locked"))}" aria-hidden="true">🔒</span>` : "";
            const children = open && n.children ? `<ul role="group">${draw(n.children, level + 1)}</ul>` : open && n.hasChildren && !n.children ? `<ul role="group"><li class="loading" role="none">${esc(t("Loading…"))}</li></ul>` : "";
            return `<li ${attrs} part="node"><div class="row${selected ? " selected" : ""}" part="row">${toggle}${check}${icon}<span class="label" part="label">${esc(n.label)}</span>${lock}${tools}</div>${children}</li>`;
          })
          .join("");
      this.tree.innerHTML = draw(this._nodes, 1) || `<li class="empty" role="none">${esc(this._nodes.length ? t("No match") : t("Nothing here yet."))}</li>`;
      // Indentation via CSS variables set from script (CSP-safe), not inline styles in HTML.
      for (const item of this.tree.querySelectorAll('[role="treeitem"]')) item.querySelector(":scope > .row").style.setProperty("--level", item.getAttribute("aria-level"));
      if (!this.tree.querySelector('[tabindex="0"]')) {
        const first = this.tree.querySelector('[role="treeitem"]');
        if (first) first.tabIndex = 0;
      }
      Viraspa.core.components.scan(this.tree);
    }

    // "true" | "false" | "mixed" for checkboxes (with cascade, from the children).
    checkState(node) {
      if (!this.hasAttribute("cascade") || !node.children || !node.children.length) return String(this._selected.has(String(node.id)));
      const states = node.children.map((c) => this.checkState(c));
      if (states.every((s) => s === "true")) return "true";
      if (states.every((s) => s === "false") && !this._selected.has(String(node.id))) return "false";
      return "mixed";
    }

    item(id) {
      return this.tree.querySelector(`[data-id="${CSS.escape(String(id))}"]`);
    }

    focusNode(node, { scroll = true } = {}) {
      if (!node) return;
      this._focusId = node.id;
      for (const el of this.tree.querySelectorAll('[role="treeitem"][tabindex="0"]')) el.tabIndex = -1;
      const el = this.item(node.id);
      if (!el) return;
      el.tabIndex = 0;
      el.focus({ preventScroll: !scroll });
      if (scroll) el.querySelector(".row").scrollIntoView({ block: "nearest" });
    }

    // ---- expanding ----------------------------------------------------------------
    async toggle(node, open = !node.expanded) {
      if (!node || !this.hasKids(node)) return;
      node.expanded = open;
      this.draw();
      this.focusNode(node, { scroll: false });
      this.dispatchEvent(new CustomEvent("vs-node-toggle", { detail: { node, expanded: open }, bubbles: true, composed: true }));
      if (open && node.hasChildren && !node.children && typeof this.load === "function") {
        try {
          node.children = (await this.load(node, { signal: undefined })) || [];
        } catch (err) {
          node.children = [];
          this.say(err && err.message ? err.message : t("The items could not be loaded."));
        }
        if (!node.children.length) node.hasChildren = false;
        this.index();
        this.draw();
        this.focusNode(node, { scroll: false });
      }
    }

    // ---- selecting -------------------------------------------------------------------
    select(node) {
      const mode = this.getAttribute("selectable");
      if (!node || node.disabled || !mode) return;
      const id = String(node.id);
      if (mode === "single") this._selected = new Set([id]);
      else {
        const on = this.checkState(node) !== "true";
        const apply = (n) => {
          if (on) this._selected.add(String(n.id));
          else this._selected.delete(String(n.id));
          if (this.hasAttribute("cascade") && n.children) n.children.forEach(apply);
        };
        apply(node);
      }
      this.draw();
      this.focusNode(node, { scroll: false });
      this.dispatchEvent(new CustomEvent("vs-node-select", { detail: { node }, bubbles: true, composed: true }));
      this.dispatchEvent(new CustomEvent("vs-selection-change", { detail: { nodes: this.selectedNodes, value: this.value }, bubbles: true, composed: true }));
    }

    openNode(node) {
      if (!node || node.disabled) return;
      this.dispatchEvent(new CustomEvent("vs-node-open", { detail: { node }, bubbles: true, composed: true }));
    }

    onClick(event) {
      const item = event.target.closest('[role="treeitem"]');
      if (!item) return;
      const node = this.node(item.dataset.id);
      if (event.target.closest(".add")) return this.startAdd(node);
      if (event.target.closest(".remove")) return this.remove(node);
      if (event.target.closest("input")) return;
      if (event.target.closest(".toggle")) return this.toggle(node);
      this.focusNode(node, { scroll: false });
      if (this.getAttribute("selectable")) this.select(node);
      else if (this.hasKids(node)) this.toggle(node);
    }

    // ---- keyboard -------------------------------------------------------------------
    visibleItems() {
      return [...this.tree.querySelectorAll('[role="treeitem"]')].filter((el) => !el.parentElement.closest('[aria-expanded="false"]'));
    }

    onKey(event) {
      if (event.target.closest("input")) return; // editing a label
      const el = event.target.closest('[role="treeitem"]');
      if (!el) return;
      const node = this.node(el.dataset.id);
      const items = this.visibleItems();
      const i = items.indexOf(el);
      const rtl = getComputedStyle(this).direction === "rtl";
      const right = rtl ? "ArrowLeft" : "ArrowRight";
      const left = rtl ? "ArrowRight" : "ArrowLeft";
      const action = Viraspa.keyboard.actionFor(event, this.keymap(KEYS));
      if (action) {
        event.preventDefault();
        if (action === "add" && this.can("add") && !node.locked) this.startAdd(node);
        else if (action === "rename" && this.can("rename") && !node.locked) this.startRename(node);
        else if (action === "delete" && this.can("delete")) this.remove(node);
        else if (action === "cut" && this.can("move") && !node.locked) {
          this._cut = node;
          this.say(t("{name} cut: choose where and press Ctrl+V.").replace("{name}", node.label));
        } else if (action === "paste" && this._cut) this.move(this._cut, node);
        return;
      }
      const go = (target) => {
        if (!target) return;
        event.preventDefault();
        this.focusNode(this.node(target.dataset.id));
      };
      switch (event.key) {
        case "ArrowDown":
          return go(items[i + 1]);
        case "ArrowUp":
          return go(items[i - 1]);
        case "Home":
          return go(items[0]);
        case "End":
          return go(items[items.length - 1]);
        case right:
          event.preventDefault();
          if (this.hasKids(node) && !node.expanded) return this.toggle(node, true);
          return go(el.querySelector('[role="group"] > [role="treeitem"]'));
        case left:
          event.preventDefault();
          if (this.hasKids(node) && node.expanded) return this.toggle(node, false);
          return go(el.parentElement.closest('[role="treeitem"]'));
        case "Enter":
          event.preventDefault();
          if (this.getAttribute("selectable") === "single") this.select(node);
          return this.openNode(node);
        case " ":
          event.preventDefault();
          return this.select(node);
        case "*": {
          event.preventDefault();
          const siblings = this.parent(node) ? this.parent(node).children : this._nodes;
          siblings.forEach((s) => this.hasKids(s) && (s.expanded = true));
          this.draw();
          return this.focusNode(node);
        }
        default:
          if (event.key.length === 1 && /\S/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const order = [...items.slice(i + 1), ...items.slice(0, i + 1)];
            const found = order.find((it) => plain(this.node(it.dataset.id).label).startsWith(plain(event.key)));
            if (found) go(found);
          }
      }
    }

    // ---- editing ----------------------------------------------------------------------
    say(text) {
      this.message.textContent = text;
      this.message.hidden = !text;
      clearTimeout(this._sayTimer);
      if (text) this._sayTimer = setTimeout(() => (this.message.hidden = true), 5000);
    }

    // An inline text box for a new or renamed label; resolves with the text or null.
    askLabel(row, value = "") {
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.className = "edit";
        input.value = value;
        input.setAttribute("aria-label", t("Name"));
        const label = row.querySelector(".label");
        label.hidden = true;
        label.after(input);
        input.focus();
        input.select();
        let done = false;
        const finish = (result) => {
          if (done) return;
          done = true;
          input.remove();
          label.hidden = false;
          resolve(result);
        };
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            finish(input.value.trim() || null);
          } else if (e.key === "Escape") {
            e.preventDefault();
            finish(null);
          }
          e.stopPropagation();
        });
        input.addEventListener("blur", () => finish(input.value.trim() && input.value.trim() !== value ? input.value.trim() : null));
      });
    }

    async startAdd(parent) {
      if (!parent || parent.locked) return;
      // A placeholder child row, edited in place.
      parent.children = parent.children || [];
      const temp = { id: `__new-${Date.now()}`, label: "" };
      parent.children.push(temp);
      parent.expanded = true;
      this.index();
      this.draw();
      const row = this.item(temp.id).querySelector(".row");
      const label = await this.askLabel(row, "");
      parent.children = parent.children.filter((c) => c !== temp);
      if (!label) {
        if (!parent.children.length) delete parent.children;
        this.index();
        this.draw();
        this.focusNode(parent);
        return;
      }
      try {
        const created = typeof this.onAdd === "function" ? await this.onAdd(parent, label) : { id: `${parent.id}-${Date.now()}`, label };
        const node = { label, ...created };
        parent.children.push(node);
        this.index();
        this.draw();
        this.focusNode(node);
        this.dispatchEvent(new CustomEvent("vs-node-add", { detail: { node, parent }, bubbles: true, composed: true }));
      } catch (err) {
        if (!parent.children.length) delete parent.children;
        this.index();
        this.draw();
        this.focusNode(parent);
        this.say(err && err.message ? err.message : t("The item could not be added."));
      }
    }

    async startRename(node) {
      const row = this.item(node.id).querySelector(".row");
      const label = await this.askLabel(row, node.label);
      if (!label) return this.focusNode(node);
      try {
        if (typeof this.onRename === "function") await this.onRename(node, label);
        node.label = label;
        this.dispatchEvent(new CustomEvent("vs-node-rename", { detail: { node, label }, bubbles: true, composed: true }));
      } catch (err) {
        this.say(err && err.message ? err.message : t("The item could not be renamed."));
      }
      this.draw();
      this.focusNode(node);
    }

    async remove(node) {
      if (!node) return;
      if (node.locked) return this.say(t("{name} is locked.").replace("{name}", node.label));
      if (this.hasAttribute("delete-leaves-only") && this.hasKids(node)) return this.say(t("Only items without sub-items can be deleted."));
      if (Viraspa.popup && !(await Viraspa.popup.confirm(t("Delete {name}?").replace("{name}", node.label), { okLabel: "Delete", danger: true }))) return this.focusNode(node);
      const parent = this.parent(node);
      try {
        if (typeof this.onDelete === "function") await this.onDelete(node);
      } catch (err) {
        return this.say(err && err.message ? err.message : t("The item could not be deleted."));
      }
      const list = parent ? parent.children : this._nodes;
      const at = list.indexOf(node);
      list.splice(at, 1);
      if (parent && !parent.children.length) delete parent.children;
      this._selected.delete(String(node.id));
      this.index();
      this.draw();
      this.focusNode(list[Math.min(at, list.length - 1)] || parent);
      this.dispatchEvent(new CustomEvent("vs-node-delete", { detail: { node, parent }, bubbles: true, composed: true }));
    }

    async move(node, target) {
      this._cut = null;
      if (!node || !target || node === target || node.locked || this.isAncestor(node, target) || this.parent(node) === target) {
        if (node && target && this.isAncestor(node, target)) this.say(t("An item can't move into its own sub-items."));
        return;
      }
      try {
        if (typeof this.onMove === "function") await this.onMove(node, target);
      } catch (err) {
        return this.say(err && err.message ? err.message : t("The item could not be moved."));
      }
      const from = this.parent(node);
      const list = from ? from.children : this._nodes;
      list.splice(list.indexOf(node), 1);
      if (from && !from.children.length) delete from.children;
      target.children = target.children || [];
      target.children.push(node);
      target.expanded = true;
      this.index();
      this.draw();
      this.focusNode(node);
      this.dispatchEvent(new CustomEvent("vs-node-move", { detail: { node, from, to: target }, bubbles: true, composed: true }));
    }

    onDragStart(event) {
      const item = event.target.closest('[role="treeitem"]');
      if (!item) return;
      this._dragged = this.node(item.dataset.id);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", item.dataset.id);
    }
    onDragOver(event) {
      const item = event.target.closest('[role="treeitem"]');
      if (!item || !this._dragged) return;
      const target = this.node(item.dataset.id);
      if (target === this._dragged || this.isAncestor(this._dragged, target)) return;
      event.preventDefault();
      this.tree.querySelectorAll(".drop").forEach((el) => el.classList.remove("drop"));
      item.querySelector(":scope > .row").classList.add("drop");
    }
    onDrop(event) {
      const item = event.target.closest('[role="treeitem"]');
      if (!item || !this._dragged) return;
      event.preventDefault();
      this.move(this._dragged, this.node(item.dataset.id));
      this._dragged = null;
    }
  }

  Viraspa.core.defineComponent(VsTree);
})(window.Viraspa);
