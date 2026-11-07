(function (Viraspa) {
  // Templates. One rule: anything inside {{ }} is code (see
  // core/expressions.js); everything outside it is plain text.
  //
  //   {{x}}                     the value as text (always escaped); live if x is a signal
  //   {{{x}}}                   trusted raw HTML
  //   \{{                       a literal "{{"
  //   attribute="...{{x}}..."   any attribute; a lone boolean toggles it (disabled="{{ !ok }}")
  //   data-bind-show-if="{{expr}}"          hides the element when false (it stays in the page)
  //   <template data-bind-if="{{expr}}">    adds or removes a block
  //   <template data-bind-repeat="{{list}}" data-bind-item="user" data-bind-key="{{user.id}}"
  //             data-bind-index="i">       one block per item (keyed: reuses blocks)
  //   data-bind-two-way="{{name}}"          input <-> signal (text, number, checkbox, radio, select)
  //   data-bind-on-click="{{save}}"         calls a method on the event; also any
  //   data-bind-on-input="{{ remove(user) }}"  event name and any expression ($event available)
  //
  // Names are looked up in: the block's own names (repeat items), the model,
  // then the page or component itself (its fields, signals and methods), then
  // the helpers t() and format. Signals are read automatically and the
  // screen updates where they are used - nothing else is re-rendered.
  // URL attributes (href, src, action, formaction, poster) never accept
  // javascript:, vbscript: or non-image data: values.

  const URL_ATTRIBUTES = new Set(["href", "src", "action", "formaction", "poster", "xlink:href"]);
  const UNSAFE_URL = /^(?:javascript|vbscript|data):/i;
  const SAFE_DATA_URL = /^data:image\/(?:png|gif|jpe?g|webp|avif|bmp);/i;
  const warned = new Set();

  function safeUrl(value) {
    const compact = String(value).replace(/[\u0000- ]/g, "");
    return UNSAFE_URL.test(compact) && !SAFE_DATA_URL.test(compact) ? "about:blank" : String(value);
  }

  function toText(value) {
    return value === undefined || value === null || value === false ? "" : String(value);
  }

  // ---- evaluation context --------------------------------------------
  function helpers() {
    return {
      t: (...args) => (Viraspa.i18n ? Viraspa.i18n.t(...args) : String(args[0] ?? "")),
      format: Viraspa.format,
    };
  }

  function makeContext(scopes) {
    return {
      scopes,
      unwrap: (v) => Viraspa.state.unwrap(v),
      pipe: (name) => Viraspa.format && Viraspa.format.pipe(name),
    };
  }

  function run(expr, scopes, where) {
    try {
      return Viraspa.expressions.compile(expr)(makeContext(scopes));
    } catch (err) {
      const key = `${expr}|${err.message}`;
      if (!warned.has(key)) {
        warned.add(key);
        console.warn(`Template expression {{ ${expr} }}${where ? ` in ${where}` : ""} failed: ${err.message}`);
      }
      return undefined;
    }
  }

  // The expression inside an attribute written as "{{ expr }}".
  function attrExpr(value) {
    const parts = Viraspa.expressions.splitTemplate(value || "");
    const exprs = parts.filter((p) => p.expr !== undefined);
    return exprs.length === 1 && parts.length === 1 ? exprs[0].expr : (value || "").trim();
  }

  // ---- step 1: raw {{{ }}} with plain values, as a string ---------------
  // (Done before parsing, so raw HTML can sit anywhere - even inside a
  // <table>. A raw value that is a signal stays for step 2.)
  function substituteRaw(template, scopes) {
    const parts = Viraspa.expressions.splitTemplate(template);
    let out = "";
    for (const part of parts) {
      if (part.text !== undefined) {
        out += part.text.replace(/\{\{/g, "\\{{"); // keep literal braces literal
      } else if (part.raw) {
        let live = false;
        let value;
        try {
          value = Viraspa.expressions.compile(part.expr)({
            scopes,
            unwrap: (v) => {
              if (Viraspa.state.isSignal(v)) live = true;
              return Viraspa.state.unwrap(v);
            },
            pipe: (name) => Viraspa.format && Viraspa.format.pipe(name),
          });
        } catch (err) {
          console.warn(`Template expression {{{ ${part.expr} }}} failed: ${err.message}`);
          value = "";
        }
        out += live ? `{{{${part.expr}}}}` : toText(value);
      } else {
        out += `{{${part.expr}}}`;
      }
    }
    return out;
  }

  // ---- step 2: bind the DOM -------------------------------------------
  function bindTextNode(node, scopes, scope) {
    const parts = Viraspa.expressions.splitTemplate(node.data);
    if (!parts.some((p) => p.expr !== undefined)) {
      if (node.data.includes("\\{{")) node.data = parts.map((p) => p.text).join("");
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const part of parts) {
      if (part.text !== undefined) {
        fragment.appendChild(document.createTextNode(part.text));
      } else if (part.raw) {
        const holder = document.createElement("span");
        holder.style.display = "contents";
        holder.setAttribute("data-vs-raw", "");
        scope.effect(() => {
          holder.innerHTML = toText(run(part.expr, scopes));
        });
        fragment.appendChild(holder);
      } else {
        const text = document.createTextNode("");
        scope.effect(() => {
          text.data = toText(run(part.expr, scopes));
        });
        fragment.appendChild(text);
      }
    }
    node.replaceWith(fragment);
  }

  function bindAttribute(el, name, value, scopes, scope) {
    const parts = Viraspa.expressions.splitTemplate(value);
    const lone = parts.length === 1 && parts[0].expr !== undefined;
    scope.effect(() => {
      let result;
      if (lone) {
        result = run(parts[0].expr, scopes, `${el.localName} ${name}`);
        if (result === true || result === false || result === null || result === undefined) {
          el.toggleAttribute(name, result === true);
          if (name === "checked") el.checked = result === true;
          if (name === "disabled" || name === "hidden" || name === "readonly") el[name === "readonly" ? "readOnly" : name] = result === true;
          return;
        }
        result = String(result);
      } else {
        result = parts.map((p) => (p.text !== undefined ? p.text : toText(run(p.expr, scopes, `${el.localName} ${name}`)))).join("");
      }
      if (URL_ATTRIBUTES.has(name)) result = safeUrl(result);
      el.setAttribute(name, result);
      if (name === "value" && "value" in el) el.value = result;
    });
  }

  // The writable target of a two-way binding: a signal, or object + key.
  function twoWayTarget(expr, scopes) {
    const path = expr.trim().split(".");
    let holder;
    for (const s of scopes) {
      if (s != null && path[0] in Object(s)) {
        holder = s;
        break;
      }
    }
    if (!holder) return null;
    for (let i = 0; i < path.length - 1; i++) {
      holder = Viraspa.state.unwrap(holder[path[i]]);
      if (holder == null) return null;
    }
    const key = path[path.length - 1];
    if (Viraspa.state.isSignal(holder[key])) {
      const s = holder[key];
      return { get: () => s.value, set: (v) => (s.value = v) };
    }
    return { get: () => holder[key], set: (v) => (holder[key] = v) };
  }

  function bindTwoWay(el, expr, scopes, scope) {
    if (!Viraspa.expressions.isPath(expr)) {
      console.warn(`data-bind-two-way="{{ ${expr} }}" needs a name, e.g. {{customerName}}.`);
      return;
    }
    const target = twoWayTarget(expr, scopes);
    if (!target) {
      console.warn(`data-bind-two-way: "${expr}" was not found.`);
      return;
    }
    const type = (el.getAttribute("type") || "").toLowerCase();
    const isCheck = type === "checkbox";
    const isRadio = type === "radio";
    const isNumber = type === "number" || type === "range";
    scope.effect(() => {
      const v = target.get();
      if (isCheck) el.checked = Boolean(v);
      else if (isRadio) el.checked = String(v) === el.value;
      else if (document.activeElement !== el || String(el.value) !== toText(v)) el.value = toText(v);
    });
    const eventName = isCheck || isRadio || el.localName === "select" ? "change" : "input";
    const onEvent = () => {
      if (isCheck) target.set(el.checked);
      else if (isRadio) {
        if (el.checked) target.set(el.value);
      } else if (isNumber) target.set(el.value === "" ? null : el.valueAsNumber);
      else target.set(el.value);
    };
    el.addEventListener(eventName, onEvent);
    scope.add(() => el.removeEventListener(eventName, onEvent));
  }

  function bindEvent(el, eventName, expr, scopes, scope, owner) {
    const handler = (event) => {
      const result = run(expr, [{ $event: event }, ...scopes], `${el.localName} on-${eventName}`);
      if (typeof result === "function") result.call(owner, event);
    };
    el.addEventListener(eventName, handler);
    scope.add(() => el.removeEventListener(eventName, handler));
  }

  function bindIf(template, scopes, scope, owner) {
    const expr = attrExpr(template.getAttribute("data-bind-if"));
    const anchor = document.createComment(" vs-if ");
    template.replaceWith(anchor);
    let nodes = null;
    let child = null;
    scope.effect(() => {
      const show = Boolean(run(expr, scopes, "data-bind-if"));
      Viraspa.state.untracked(() => {
        if (show && !nodes) {
          child = Viraspa.state.createScope();
          const fragment = template.content.cloneNode(true);
          bindTree(fragment, scopes, child, owner);
          nodes = Array.from(fragment.childNodes);
          anchor.before(fragment);
          afterInsert(nodes);
        } else if (!show && nodes) {
          child.dispose();
          nodes.forEach((n) => n.remove());
          nodes = null;
        }
      });
    });
    scope.add(() => child && child.dispose());
  }

  function bindRepeat(template, scopes, scope, owner) {
    const listExpr = attrExpr(template.getAttribute("data-bind-repeat"));
    const itemName = template.getAttribute("data-bind-item") || "item";
    const indexName = template.getAttribute("data-bind-index") || "index";
    const keyExpr = template.hasAttribute("data-bind-key") ? attrExpr(template.getAttribute("data-bind-key")) : null;
    const anchor = document.createComment(" vs-repeat ");
    template.replaceWith(anchor);
    let blocks = new Map(); // key -> { nodes, scope, item, index }

    scope.effect(() => {
      const list = run(listExpr, scopes, "data-bind-repeat");
      const items = Array.isArray(list) ? list : list ? Array.from(list) : [];
      Viraspa.state.untracked(() => {
        const next = new Map();
        items.forEach((value, i) => {
          let key = keyExpr ? run(keyExpr, [{ [itemName]: value, [indexName]: i }, ...scopes], "data-bind-key") : value;
          if (next.has(key)) key = `${String(key)}#${i}`; // duplicate keys: keep both
          let block = blocks.get(key);
          if (block) {
            blocks.delete(key);
            block.item.value = value;
            block.index.value = i;
          } else {
            const item = Viraspa.state.signal(value);
            const index = Viraspa.state.signal(i);
            const child = Viraspa.state.createScope();
            const locals = {};
            Object.defineProperty(locals, itemName, { get: () => item.value, enumerable: true });
            Object.defineProperty(locals, indexName, { get: () => index.value, enumerable: true });
            const fragment = template.content.cloneNode(true);
            bindTree(fragment, [locals, ...scopes], child, owner);
            block = { nodes: Array.from(fragment.childNodes), scope: child, item, index, fresh: true, fragment };
          }
          next.set(key, block);
        });
        // Remove blocks whose items are gone.
        for (const old of blocks.values()) {
          old.scope.dispose();
          old.nodes.forEach((n) => n.remove());
        }
        // Put blocks in order before the anchor.
        const inserted = [];
        for (const block of next.values()) {
          if (block.fresh) {
            anchor.before(block.fragment);
            delete block.fragment;
            delete block.fresh;
            inserted.push(...block.nodes);
          } else {
            for (const n of block.nodes) anchor.before(n);
          }
        }
        blocks = next;
        if (inserted.length) afterInsert(inserted);
      });
    });
    scope.add(() => {
      for (const b of blocks.values()) b.scope.dispose();
    });
  }

  // New nodes may hold components, privilege attributes or data-i18n.
  function afterInsert(nodes) {
    for (const n of nodes) {
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      if (Viraspa.core.components) Viraspa.core.components.scan(n);
      if (Viraspa.session) Viraspa.session.applyPrivileges(n);
      if (Viraspa.i18n) Viraspa.i18n.translate(n);
    }
  }

  function bindElement(el, scopes, scope, owner) {
    for (const attr of Array.from(el.attributes)) {
      const { name, value } = attr;
      if (name === "data-bind-show-if") {
        const expr = attrExpr(value);
        scope.effect(() => {
          el.hidden = !run(expr, scopes, "data-bind-show-if");
        });
      } else if (name === "data-bind-two-way") {
        bindTwoWay(el, attrExpr(value), scopes, scope);
      } else if (name.startsWith("data-bind-on-")) {
        bindEvent(el, name.slice("data-bind-on-".length), attrExpr(value), scopes, scope, owner);
      } else if (value.includes("{{")) {
        bindAttribute(el, name, value, scopes, scope);
      }
    }
  }

  // Walks a tree and binds it. Doesn't enter <template> contents (other
  // than its own data-bind-if/repeat) or other components' shadow roots.
  function bindTree(root, scopes, scope, owner) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const texts = [];
    const elements = [];
    const blocks = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.data.includes("{{")) texts.push(node);
      } else if (node.localName === "template" && (node.hasAttribute("data-bind-if") || node.hasAttribute("data-bind-repeat"))) {
        blocks.push(node);
      } else if (node.localName !== "style" && node.localName !== "script") {
        elements.push(node);
      }
    }
    for (const el of elements) bindElement(el, scopes, scope, owner);
    for (const t of texts) {
      if (t.parentNode && !(t.parentNode.localName === "style" || t.parentNode.localName === "script")) bindTextNode(t, scopes, scope);
    }
    for (const tpl of blocks) {
      if (tpl.hasAttribute("data-bind-repeat")) bindRepeat(tpl, scopes, scope, owner);
      else bindIf(tpl, scopes, scope, owner);
    }
  }

  // Renders `template` into `target` (an element or shadow root), bound to
  // `model` and `owner` (the page or component). Effects go into `scope`
  // (Viraspa.state.createScope()), disposed when the owner goes away.
  function render(target, template, model, { owner = null, scope } = {}) {
    const scopes = [model || {}, owner || {}, helpers()];
    const html = substituteRaw(template, scopes);
    const holder = document.createElement("template"); // inert: no image loads, no scripts
    holder.innerHTML = html;
    bindTree(holder.content, scopes, scope, owner);
    target.replaceChildren(holder.content);
    return html;
  }

  // Binds an existing tree (e.g. HTML a page built itself) to a model.
  function bind(root, model, { owner = null, scope } = {}) {
    bindTree(root, [model || {}, owner || {}, helpers()], scope, owner);
  }

  // The 0.1/0.2-M1 string form, still used for one-off text: {{key}}
  // escaped, {{{key}}} raw, plain values only.
  function bindTemplate(template, data) {
    const escapeHtml = Viraspa.utility.dom.escapeHtml;
    const scopes = [data || {}, helpers()];
    return Viraspa.expressions
      .splitTemplate(template)
      .map((p) => (p.text !== undefined ? p.text : p.raw ? toText(run(p.expr, scopes)) : escapeHtml(toText(run(p.expr, scopes)))))
      .join("");
  }

  Viraspa.services = Viraspa.services || {};
  Viraspa.services.databinding = { render, bind, bindTemplate, safeUrl };
})(window.Viraspa);
