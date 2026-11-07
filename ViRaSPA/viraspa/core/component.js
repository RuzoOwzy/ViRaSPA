(function (Viraspa) {
  const ISOLATION_MODES = ["full", "scoped", "none"];
  const RESERVED_PREFIXES = ["vs-", "viraspa-"];

  // Base class for framework components. A component is a custom element:
  //
  //   class Card extends Viraspa.core.Component {
  //     static tag = "app-card";              // hyphenated, prefixed
  //     static folder = "app/components/card"; // card.html/.css/.model.json
  //     static isolation = "full";            // "full" | "scoped" | "none"
  //   }
  //   Viraspa.core.defineComponent(Card);
  //
  // Then <app-card title="Hi"></app-card> anywhere, or mountComponent().
  // The default onLoad renders the folder's .html with its .model.json,
  // overridden by attributes and `props`. Components written with plain
  // customElements.define(...) need none of this; the framework leaves them
  // alone.
  class Component extends HTMLElement {
    static tag = "";
    static folder = "";
    static isolation = "full";
    // Shared stylesheets adopted into "full" shadow roots (see
    // Viraspa.core.styleIsolation.registerSharedStyle).
    static sharedStyles = ["base"];
    // Other modes a page may choose with <tag isolation="scoped">, e.g.
    // ["full", "scoped"]. Without it, only `isolation` is used.
    static allowedIsolation = null;
    // Set to false when the folder has no .model.json / no .css file.
    static hasModel = true;
    static hasStyles = true;
    // "full" mode: focusing the element (or clicking its <label>) focuses
    // the first focusable thing inside - for form fields.
    static delegatesFocus = false;

    constructor() {
      super();
      this.props = this.props || {};
      this.html = "";
      // The author's mode, or one the page asks for with isolation="..." -
      // only if the author lists it in static allowedIsolation.
      const Class = this.constructor;
      const own = ISOLATION_MODES.includes(Class.isolation) ? Class.isolation : "full";
      const requested = this.getAttribute("isolation");
      const allowed = (Class.allowedIsolation || [own]).filter((m) => ISOLATION_MODES.includes(m));
      if (requested && !allowed.includes(requested)) {
        console.warn(`<${Class.tag}> doesn't allow isolation="${requested}" (allowed: ${allowed.join(", ")}); using "${own}".`);
      }
      this.isolation = requested && allowed.includes(requested) ? requested : own;
      // Where the component's own content lives, in every mode: the shadow
      // root for "full", the element itself for "scoped" and "none".
      this.componentRoot = this.isolation === "full" ? this.attachShadow({ mode: "open", delegatesFocus: Boolean(Class.delegatesFocus) }) : this;
      // The shadow root, only in "full" mode (null otherwise).
      this.documentShadow = this.isolation === "full" ? this.shadowRoot : null;
      // Resolves once the component has loaded (or failed to).
      this.ready = new Promise((resolve) => (this._resolveReady = resolve));
      this._started = false;
      // Effects, listeners and bindings, disposed when the component leaves
      // the page (and set up again if it comes back).
      this._scope = Viraspa.state.createScope();
      this._bindingScope = null;
      // Form fields: a component with `static formAssociated = true` takes
      // part in <form> like a native input (name, value on submit, required,
      // reset, disabled fieldsets) through this.internals.
      this.internals = this.constructor.formAssociated && this.attachInternals ? this.attachInternals() : null;
    }

    // ---- form fields (static formAssociated = true) ---------------------
    get form() {
      return this.internals ? this.internals.form : null;
    }
    get name() {
      return this.getAttribute("name") || "";
    }
    get validity() {
      return this.internals ? this.internals.validity : null;
    }
    get validationMessage() {
      return this.internals ? this.internals.validationMessage : "";
    }
    checkValidity() {
      return this.internals ? this.internals.checkValidity() : true;
    }
    reportValidity() {
      return this.internals ? this.internals.reportValidity() : true;
    }
    // The value sent with the form (a string, File, FormData or null).
    setFormValue(value, state) {
      if (this.internals) this.internals.setFormValue(value, state);
    }
    // setValidity({ valueMissing: true }, "Please fill in this field.", inputElement); setValidity({}) clears it.
    setValidity(flags = {}, message = "", anchor) {
      if (!this.internals) return;
      if (Object.values(flags).some(Boolean)) this.internals.setValidity(flags, message || " ", anchor);
      else this.internals.setValidity({});
    }
    // The text of this field's <label>s (or its aria-label), for the input
    // inside its shadow root - a label outside can't name it directly.
    labelText() {
      if (this.hasAttribute("aria-label")) return this.getAttribute("aria-label");
      const labels = this.internals && this.internals.labels ? [...this.internals.labels] : [];
      return labels
        .map((label) => {
          const copy = label.cloneNode(true);
          for (const hidden of copy.querySelectorAll("[aria-hidden='true']")) hidden.remove();
          return copy.textContent.trim();
        })
        .filter(Boolean)
        .join(" ");
    }
    formDisabledCallback(disabled) {
      this.toggleAttribute("data-form-disabled", disabled);
      if (typeof this.onFormDisabled === "function") this.onFormDisabled(disabled);
    }
    formResetCallback() {
      if (typeof this.onFormReset === "function") this.onFormReset();
    }

    // ---- keyboard ----------------------------------------------------------
    // A shortcut active while focus is inside this component, removed with it.
    shortcut(keys, handler, options = {}) {
      const off = Viraspa.keyboard.shortcut(keys, handler, { within: this, ...options });
      this._scope.add(off);
      return off;
    }

    // This component's keys: its defaults, then the app's settings for its
    // tag (Viraspa.keyboard.configure({ components })), then the element's own
    // `keys` property or attribute. An action set to false is off.
    keymap(defaults) {
      return Viraspa.keyboard.keymap(this.constructor.tag, defaults, this);
    }

    // A property set on the element before its component was loaded (e.g.
    // el.source = fn, or el.value = 3, before the tag was defined) is a plain
    // property that would hide the component's own setter. It is applied
    // through that setter now.
    _upgradeProperties() {
      for (const key of Object.keys(this)) {
        let proto = Object.getPrototypeOf(this);
        let descriptor = null;
        while (proto && proto !== HTMLElement.prototype && !descriptor) {
          descriptor = Object.getOwnPropertyDescriptor(proto, key);
          proto = Object.getPrototypeOf(proto);
        }
        if (descriptor && descriptor.set) {
          const value = this[key];
          delete this[key];
          this[key] = value;
        }
      }
    }

    connectedCallback() {
      if (this._started) return;
      if (!this._propertiesUpgraded) {
        this._propertiesUpgraded = true;
        this._upgradeProperties();
      }
      this._started = true;
      this.setAttribute("data-vs-component", this.isolation);
      // Light-DOM children given by the user of the component, captured
      // (once) before rendering so "scoped"/"none" can place them into <slot>s.
      if (!this._lightChildren) this._lightChildren = this.isolation === "full" ? [] : Array.from(this.childNodes);
      this._load();
    }

    // Leaving the page disposes effects and listeners. Moving an element
    // (removed and added back at once) doesn't: that is checked a moment later.
    disconnectedCallback() {
      queueMicrotask(() => {
        if (this.isConnected || !this._started) return;
        this.dispose();
        this._started = false; // loads again if it is added back later
      });
    }

    dispose() {
      if (this._bindingScope) this._bindingScope.dispose();
      this._bindingScope = null;
      this._scope.dispose();
      this._scope = Viraspa.state.createScope();
    }

    // Runs fn now and whenever the signals it reads change, while the
    // component is on the page. fn may return a cleanup function.
    effect(fn) {
      return this._scope.effect(fn);
    }

    // addEventListener that is removed when the component leaves the page.
    listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      this._scope.add(() => target.removeEventListener(type, handler, options));
    }

    async _load() {
      const { emit, runHook } = Viraspa.core;
      if (this._loadedOnce) this.ready = new Promise((resolve) => (this._resolveReady = resolve));
      this._loadedOnce = true;
      try {
        emit("componentBeforeLoad", { component: this }, this);
        await runHook(this, "beforeLoad");
        emit("componentOnLoad", { component: this }, this);
        await runHook(this, "onLoad");
        emit("componentAfterLoad", { component: this }, this);
        await runHook(this, "afterLoad");
        await this._childrenLoaded;
      } catch (err) {
        console.error(`<${this.localName}> failed to load:`, err);
      }
      this._resolveReady(this);
    }

    // Attributes as props: <app-card sub-title="x"> -> { subTitle: "x" }.
    attributeProps() {
      const props = {};
      for (const { name, value } of Array.from(this.attributes)) {
        if (name === "data-vs-component" || name === "isolation") continue;
        props[name.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = value;
      }
      return props;
    }

    async beforeLoad() {}

    // Default: apply the folder's CSS, then render its .html with the
    // .model.json defaults, attribute values and props (in that order),
    // after prepareModel() has had its say.
    async onLoad() {
      await Viraspa.core.styleIsolation.apply(this);
      await this.render();
    }

    // (Re-)renders the component's template - call it again after changing
    // props or attributes that the template shows.
    async render() {
      const Class = this.constructor;
      if (!Class.folder) return;
      const { template, model } = await Viraspa.core.pageLoader.fetchComponent(Viraspa.core.pageLoader.basePath(Class.folder), {
        withModel: Class.hasModel !== false,
      });
      const merged = { ...model, ...this.attributeProps(), ...this.props };
      this.renderTemplate(template, (await this.prepareModel(merged)) || merged);
    }

    // Override to add derived values before rendering, e.g. HTML built from
    // a list. Return the model (or change it in place).
    async prepareModel(model) {
      return model;
    }

    async afterLoad() {}

    renderTemplate(template, model) {
      const { emit } = Viraspa.core;
      emit("componentBeforeDataBinding", { component: this }, this);
      if (this._bindingScope) this._bindingScope.dispose();
      this._bindingScope = Viraspa.state.createScope();
      // Names in {{ }}: the model first, then the component itself (its
      // signals, computed values and methods).
      this.html = Viraspa.services.databinding.render(this.componentRoot, template, model, { owner: this, scope: this._bindingScope });
      emit("componentOnDataBinding", { component: this, model }, this);
      if (this.isolation !== "full") this._fillSlots();
      // Autoload components used inside (vs-icon...); `ready` waits for them.
      this._childrenLoaded = Viraspa.core.components.scan(this.componentRoot);
      Viraspa.session.applyPrivileges(this.componentRoot);
      Viraspa.i18n.translate(this.componentRoot);
      emit("componentAfterDataBinding", { component: this }, this);
      return this.html;
    }

    // <slot name="x"> works in every mode: in "full" the browser projects the
    // children; in "scoped"/"none" the framework moves them into the slot
    // (or keeps the slot's fallback content if none were given).
    _fillSlots() {
      const children = this._lightChildren || [];
      for (const slot of Array.from(this.querySelectorAll("slot"))) {
        const name = slot.getAttribute("name") || "";
        const assigned = children.filter((node) =>
          node.nodeType === Node.ELEMENT_NODE
            ? (node.getAttribute("slot") || "") === name
            : !name && node.nodeType === Node.TEXT_NODE && node.textContent.trim()
        );
        if (assigned.length) slot.replaceWith(...assigned);
        else slot.replaceWith(...Array.from(slot.childNodes));
      }
    }
  }

  // Registers a component class as a custom element. Checks the tag name, so
  // a mistake shows up as a clear message instead of a browser error.
  function defineComponent(ComponentClass) {
    const tag = ComponentClass.tag;
    if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(tag || "")) {
      throw new Error(`${ComponentClass.name}.tag "${tag}" must be lowercase and contain a hyphen, e.g. "app-card".`);
    }
    if (RESERVED_PREFIXES.some((prefix) => tag.startsWith(prefix)) && !Viraspa.core.components.mayUseReservedPrefix(tag)) {
      throw new Error(`<${tag}>: the "vs-" and "viraspa-" prefixes are reserved for official ViRaSPA components.`);
    }
    if (!customElements.get(tag)) customElements.define(tag, ComponentClass);
    Viraspa.components = Viraspa.components || {};
    Viraspa.components[ComponentClass.name] = ComponentClass;
    return ComponentClass;
  }

  // Creates a component element, gives it `props`, puts it in `target` (a
  // selector or element; replaces its content unless props.append) and
  // resolves with the element once it has loaded.
  async function mountComponent(ComponentClass, target, props = {}) {
    const host = typeof target === "string" ? Viraspa.utility.dom.qs(target) : target;
    const element = document.createElement(ComponentClass.tag);
    const { append, ...ownProps } = props;
    element.props = ownProps;
    if (append) host.appendChild(element);
    else host.replaceChildren(element);
    return element.ready;
  }

  Viraspa.core = Viraspa.core || {};
  Viraspa.core.Component = Component;
  Viraspa.core.defineComponent = defineComponent;
  Viraspa.core.mountComponent = mountComponent;
})(window.Viraspa);
