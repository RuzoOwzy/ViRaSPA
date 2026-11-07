(function (Viraspa) {
  // Tabs: each child with a `label` is a panel.
  //
  //   <vs-tabs remember="customer-tabs">
  //     <section label="General">…</section>
  //     <section label="Addresses" icon="lucide:map-pin">…</section>
  //     <section label="History" lazy>…</section>
  //   </vs-tabs>
  //
  // - Keyboard (ARIA tabs): Left/Right (Up/Down when orientation="vertical"),
  //   Home/End; the tab is shown as focus moves, or only on Enter/Space with
  //   activation="manual".
  // - selected="2" or selected="history" (a panel id) picks the first tab;
  //   `remember` keeps the last tab in this browser under that key.
  // - lazy: the panel's content is kept inert (a <template>) until first shown.
  // - Events: "vs-tab-change" (detail: { index, panel }). Property: selectedIndex.
  // - A panel with `disabled` can't be chosen; `hidden` panels have no tab.
  class VsTabs extends Viraspa.core.Component {
    static tag = "vs-tabs";
    static folder = "components/vs-tabs";
    static isolation = "full";
    static hasModel = false;
    static observedAttributes = ["selected"];

    get panels() {
      return [...this.children].filter((el) => el.hasAttribute("label") && !el.hidden);
    }
    get selectedIndex() {
      return this._index ?? 0;
    }
    set selectedIndex(i) {
      this.select(i);
    }

    async afterLoad() {
      this.list = this.componentRoot.querySelector('[role="tablist"]');
      this.list.setAttribute("aria-orientation", this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal");
      this.listen(this.list, "click", (e) => {
        const tab = e.target.closest('[role="tab"]');
        if (tab && !tab.disabled) this.select(Number(tab.dataset.index), { focus: true });
      });
      this.listen(this.list, "keydown", (e) => this.onKey(e));
      this._observer = new MutationObserver(() => this.build());
      this._observer.observe(this, { childList: true, attributes: true, subtree: false, attributeFilter: ["label", "hidden", "disabled", "icon"] });
      this.build();
      this.select(this.initialIndex(), { silent: true });
    }

    disconnectedCallback() {
      if (this._observer) this._observer.disconnect();
      super.disconnectedCallback();
    }

    attributeChangedCallback(name) {
      if (name === "selected" && this.list) this.select(this.indexOf(this.getAttribute("selected")));
    }

    indexOf(key) {
      if (key === null || key === undefined || key === "") return -1;
      if (/^\d+$/.test(String(key))) return Number(key);
      return this.panels.findIndex((p) => p.id === key);
    }

    initialIndex() {
      const remembered = this.getAttribute("remember");
      if (remembered) {
        try {
          const saved = localStorage.getItem(`vs-tabs:${remembered}`);
          const i = this.indexOf(saved);
          if (i >= 0 && i < this.panels.length) return i;
        } catch {
          // storage not available: use the default
        }
      }
      const i = this.indexOf(this.getAttribute("selected"));
      return i >= 0 ? i : 0;
    }

    build() {
      const escape = Viraspa.utility.dom.escapeHtml;
      const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
      const panels = this.panels;
      this.list.innerHTML = panels
        .map((panel, i) => {
          const icon = panel.getAttribute("icon");
          return `<button type="button" role="tab" part="tab" data-index="${i}"${panel.hasAttribute("disabled") ? " disabled" : ""}>${icon ? `<vs-icon icon="${escape(icon)}" aria-hidden="true"></vs-icon>` : ""}<span>${escape(t(panel.getAttribute("label")))}</span></button>`;
        })
        .join("");
      Viraspa.core.components.scan(this.list);
      panels.forEach((panel, i) => {
        if (!panel.id) {
          panel.id = Viraspa.utility.dom.uid("vs-tab-panel");
          panel.setAttribute("data-tab-generated-id", "");
        }
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("tabindex", "0");
        const tab = this.list.children[i];
        tab.id = `${panel.id}-tab`;
        tab.setAttribute("aria-controls", panel.id);
        // aria-labelledby can't cross the shadow boundary: name the panel directly.
        panel.setAttribute("aria-label", panel.getAttribute("label"));
      });
      if (this._index !== undefined) this.select(Math.min(this._index, panels.length - 1), { silent: true });
    }

    select(index, { focus = false, silent = false } = {}) {
      const panels = this.panels;
      if (!panels.length || index < 0 || index >= panels.length || panels[index].hasAttribute("disabled")) return;
      const changed = this._index !== index;
      this._index = index;
      panels.forEach((panel, i) => {
        const on = i === index;
        panel.toggleAttribute("data-tab-hidden", !on);
        if (on && panel.hasAttribute("lazy")) this.wake(panel);
      });
      [...this.list.children].forEach((tab, i) => {
        tab.setAttribute("aria-selected", String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
      });
      if (focus) this.list.children[index].focus();
      const remembered = this.getAttribute("remember");
      if (remembered && changed) {
        try {
          localStorage.setItem(`vs-tabs:${remembered}`, panels[index].hasAttribute("data-tab-generated-id") ? String(index) : panels[index].id);
        } catch {
          // storage not available: nothing to remember
        }
      }
      if (changed && !silent) this.dispatchEvent(new CustomEvent("vs-tab-change", { detail: { index, panel: panels[index] }, bubbles: true, composed: true }));
    }

    // lazy: a <template> inside the panel becomes its content when first shown.
    wake(panel) {
      const template = panel.querySelector(":scope > template");
      if (template) template.replaceWith(template.content.cloneNode(true));
      panel.removeAttribute("lazy");
      Viraspa.core.components.scan(panel);
    }

    onKey(event) {
      const tabs = [...this.list.children].filter((t) => !t.disabled);
      const current = tabs.indexOf(event.target.closest('[role="tab"]'));
      if (current === -1) return;
      const vertical = this.getAttribute("orientation") === "vertical";
      const rtl = getComputedStyle(this).direction === "rtl";
      const keys = { next: vertical ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight", prev: vertical ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft" };
      let target = null;
      if (event.key === keys.next) target = tabs[(current + 1) % tabs.length];
      else if (event.key === keys.prev) target = tabs[(current - 1 + tabs.length) % tabs.length];
      else if (event.key === "Home") target = tabs[0];
      else if (event.key === "End") target = tabs[tabs.length - 1];
      else if ((event.key === "Enter" || event.key === " ") && this.getAttribute("activation") === "manual") {
        event.preventDefault();
        this.select(Number(event.target.closest('[role="tab"]').dataset.index));
        return;
      }
      if (!target) return;
      event.preventDefault();
      target.focus();
      if (this.getAttribute("activation") !== "manual") this.select(Number(target.dataset.index));
    }
  }

  Viraspa.core.defineComponent(VsTabs);
})(window.Viraspa);
