(function (Viraspa) {
  // A rich text editor - our own code, no third-party library.
  //
  //   <vs-rich-text-editor name="body" placeholder="Write your message…" toolbar="standard" maxlength="5000" show-count></vs-rich-text-editor>
  //   <vs-rich-text-editor toolbar="bold italic | lists | link -image"></vs-rich-text-editor>
  //   editor.value = "<p>Hello <strong>Amina</strong></p>";   // clean HTML in and out
  //   editor.uploadImage = async (file) => (await api.upload(file)).url;
  //
  // Version 1 has only what works reliably in every browser: paragraphs and
  // headings, bold, italic, underline, strikethrough, lists with indent,
  // quote, alignment, links (safe addresses only), images, a horizontal
  // line, undo/redo, clear formatting, cleaned or plain-text paste, counts,
  // a length limit, read-only and height settings.
  //
  // Engine: the browser's editing commands, kept behind one small adapter
  // (exec / state) so they can be replaced piece by piece later, and every
  // value goes through our own sanitizer - so differences between browsers
  // never show in the output.
  //
  // "scoped" isolation (no Shadow DOM): editing and selection inside a shadow
  // root are not reliable in every browser yet.
  // See README.md for every option, key, event and the allowed HTML.
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const esc = (s) => Viraspa.utility.dom.escapeHtml(s);

  // ---- buttons -------------------------------------------------------------
  const BUTTONS = {
    block: { label: "Paragraph style", type: "select" },
    bold: { label: "Bold", command: "bold", keys: "mod+b", icon: "<b>B</b>" },
    italic: { label: "Italic", command: "italic", keys: "mod+i", icon: "<i>I</i>" },
    underline: { label: "Underline", command: "underline", keys: "mod+u", icon: "<u>U</u>" },
    strike: { label: "Strikethrough", command: "strikeThrough", keys: "mod+shift+x", icon: "<s>S</s>" },
    bullets: { label: "Bulleted list", command: "insertUnorderedList", keys: "mod+shift+8", icon: "&#8226;&#8801;" },
    numbers: { label: "Numbered list", command: "insertOrderedList", keys: "mod+shift+7", icon: "1&#8801;" },
    indent: { label: "Indent", command: "indent", keys: "mod+]", icon: "&#8677;" },
    outdent: { label: "Outdent", command: "outdent", keys: "mod+[", icon: "&#8676;" },
    quote: { label: "Quote", keys: "mod+shift+9", icon: "&#8220;" },
    left: { label: "Align left", command: "justifyLeft", keys: "mod+shift+l", icon: "&#8676;&#8801;" },
    center: { label: "Align centre", command: "justifyCenter", keys: "mod+shift+e", icon: "&#8801;" },
    right: { label: "Align right", command: "justifyRight", keys: "mod+shift+r", icon: "&#8801;&#8677;" },
    link: { label: "Link", keys: "mod+k", icon: "&#128279;" },
    image: { label: "Image", icon: "&#128444;" },
    hr: { label: "Horizontal line", command: "insertHorizontalRule", icon: "&#8213;" },
    undo: { label: "Undo", command: "undo", icon: "&#8630;" },
    redo: { label: "Redo", command: "redo", icon: "&#8631;" },
    clear: { label: "Clear formatting", keys: "mod+\\", icon: "T&#824;" },
  };
  const GROUPS = { lists: ["bullets", "numbers"], indents: ["indent", "outdent"], align: ["left", "center", "right"], history: ["undo", "redo"], text: ["bold", "italic", "underline", "strike"] };
  const PRESETS = {
    minimal: "bold italic | bullets numbers | link",
    standard: "block | bold italic underline | lists | link | undo redo",
    full: "block | bold italic underline strike | lists indents | quote | align | link image hr | clear | undo redo",
  };

  // ---- the sanitizer ---------------------------------------------------------
  // Tags kept (others are unwrapped: their text stays) and attributes kept.
  const ALLOWED = {
    p: [], br: [], h1: [], h2: [], h3: [], strong: [], em: [], u: [], s: [], ul: [], ol: [], li: [], blockquote: [], hr: [],
    a: ["href", "title", "target"],
    img: ["src", "alt", "title", "width", "height"],
  };
  const RENAME = { b: "strong", i: "em", strike: "s", del: "s", div: "p", h4: "h3", h5: "h3", h6: "h3" };
  const DROP = new Set(["script", "style", "template", "iframe", "object", "embed", "noscript", "head", "title", "meta", "link", "svg", "math", "form", "input", "button", "select", "textarea"]);
  const BLOCKS = new Set(["p", "h1", "h2", "h3", "blockquote", "li"]);

  function safeHref(href) {
    const v = String(href || "").trim();
    if (/^(https?:|mailto:|tel:)/i.test(v) || /^[/#.]/.test(v) || (!/^[a-z][a-z0-9+.-]*:/i.test(v) && v)) return v;
    return "";
  }
  function safeSrc(src) {
    const v = String(src || "").trim();
    if (/^https?:/i.test(v) || /^\//.test(v) || /^data:image\/(png|gif|jpe?g|webp|avif);/i.test(v) || /^blob:/i.test(v)) return v;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && v) return v; // relative
    return "";
  }

  // HTML in (any) -> clean HTML out, keeping only `allowed` tags.
  function sanitize(html, allowed = ALLOWED) {
    const doc = new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html");
    const out = document.createElement("div");
    const walk = (node, parent) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          parent.appendChild(document.createTextNode(child.data));
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        let tag = child.localName;
        if (DROP.has(tag)) continue;
        // Word and Google Docs mark bold/italic with styles on spans.
        const style = child.getAttribute("style") || "";
        if (tag === "span" || tag === "font") {
          let target = parent;
          if (/font-weight:\s*(bold|[6-9]00)/i.test(style) && allowed.strong) target = target.appendChild(document.createElement("strong"));
          if (/font-style:\s*italic/i.test(style) && allowed.em) target = target.appendChild(document.createElement("em"));
          if (/text-decoration[^;]*underline/i.test(style) && allowed.u) target = target.appendChild(document.createElement("u"));
          walk(child, target);
          continue;
        }
        tag = RENAME[tag] || tag;
        if (!allowed[tag]) {
          walk(child, parent); // unwrap: keep the text
          continue;
        }
        const el = document.createElement(tag);
        for (const name of allowed[tag]) {
          const value = child.getAttribute(name);
          if (value === null) continue;
          if (name === "href") {
            const href = safeHref(value);
            if (href) el.setAttribute("href", href);
          } else if (name === "src") {
            const src = safeSrc(value);
            if (src) el.setAttribute("src", src);
          } else if (name === "target") {
            if (value === "_blank") {
              el.setAttribute("target", "_blank");
              el.setAttribute("rel", "noopener noreferrer");
            }
          } else el.setAttribute(name, value);
        }
        // Alignment on blocks is the one style kept.
        const align = /text-align:\s*(left|center|right|justify)/i.exec(style) || (child.getAttribute("align") && [null, child.getAttribute("align")]);
        if (align && BLOCKS.has(tag) && /^(left|center|right|justify)$/i.test(align[1]) && align[1].toLowerCase() !== "left") el.style.textAlign = align[1].toLowerCase();
        if (tag === "img" && !el.getAttribute("src")) continue;
        parent.appendChild(el);
        walk(child, el);
      }
    };
    walk(doc.body, out);
    // A list directly inside a list (what "indent" makes in some browsers)
    // moves into the item before it, as valid HTML wants.
    for (const list of [...out.querySelectorAll("ul > ul, ul > ol, ol > ul, ol > ol")]) {
      let item = list.previousElementSibling;
      if (!item || item.localName !== "li") {
        item = document.createElement("li");
        list.before(item);
      }
      item.appendChild(list);
    }
    // Paragraphs with nothing at all in them are dropped (an empty line the
    // user typed is kept: it holds a <br>).
    for (const p of [...out.querySelectorAll("p")]) if (!p.childNodes.length) p.remove();
    // Top-level text and inline elements go into paragraphs.
    const fixed = document.createElement("div");
    let paragraph = null;
    for (const node of [...out.childNodes]) {
      const block = node.nodeType === Node.ELEMENT_NODE && /^(p|h1|h2|h3|ul|ol|blockquote|hr)$/.test(node.localName);
      if (block) {
        paragraph = null;
        fixed.appendChild(node);
      } else {
        if (node.nodeType === Node.TEXT_NODE && !node.data.trim() && !paragraph) continue;
        if (!paragraph) paragraph = fixed.appendChild(document.createElement("p"));
        paragraph.appendChild(node);
      }
    }
    // Empty paragraphs (only <br> or nothing) at the very end are dropped.
    while (fixed.lastChild && fixed.lastChild.localName === "p" && !fixed.lastChild.textContent.trim() && !fixed.lastChild.querySelector("img")) fixed.lastChild.remove();
    return fixed.innerHTML;
  }

  class VsRichTextEditor extends Viraspa.core.Component {
    static tag = "vs-rich-text-editor";
    static folder = "components/vs-rich-text-editor";
    static isolation = "scoped";
    static hasModel = false;
    static formAssociated = true;
    static observedAttributes = ["readonly", "disabled", "placeholder", "toolbar", "maxlength", "required"];

    constructor() {
      super();
      this._pending = null;
      this.allowed = ALLOWED;
      this.uploadImage = null;
    }

    // ---- value ----------------------------------------------------------------
    get value() {
      return this.area ? sanitize(this.area.innerHTML, this.allowed) : this._pending ?? "";
    }
    set value(html) {
      if (!this.area) {
        this._pending = html ?? "";
        return;
      }
      this.area.innerHTML = sanitize(html ?? "", this.allowed) || "<p><br></p>";
      this.refresh();
    }
    // The text without formatting.
    get text() {
      return this.area ? this.area.innerText.replace(/\n{3,}/g, "\n\n").trim() : "";
    }
    sanitize(html) {
      return sanitize(html, this.allowed);
    }

    // ---- set-up ---------------------------------------------------------------
    async afterLoad() {
      this.bar = this.querySelector(".vs-rte-toolbar");
      this.area = this.querySelector(".vs-rte-area");
      this.status = this.querySelector(".vs-rte-status");
      this.linkBox = this.querySelector(".vs-rte-link");
      this.area.setAttribute("aria-label", this.getAttribute("aria-label") || this.labelText() || t("Text"));
      this.bar.setAttribute("aria-label", t("Formatting"));
      const initial = this._pending ?? this.getAttribute("value") ?? "";
      this.area.innerHTML = sanitize(initial, this.allowed) || "<p><br></p>";
      this._initial = this.value;
      this._lastCommitted = this._initial;
      this.buildToolbar();
      this.exec("defaultParagraphSeparator", "p");
      this.exec("styleWithCSS", false);

      this.listen(this.bar, "click", (e) => this.onToolbar(e));
      this.listen(this.bar, "change", (e) => e.target.matches(".vs-rte-block") && this.setBlock(e.target.value));
      this.listen(this.bar, "keydown", (e) => this.onToolbarKey(e));
      this.listen(this.area, "keydown", (e) => this.onKey(e));
      this.listen(this.area, "beforeinput", (e) => this.onBeforeInput(e));
      this.listen(this.area, "input", () => this.refresh());
      this.listen(this.area, "paste", (e) => this.onPaste(e));
      this.listen(this.area, "drop", (e) => this.onDrop(e));
      this.listen(this.area, "blur", () => this.commit());
      this.listen(document, "selectionchange", () => this.updateState());
      this.listen(this.linkBox, "submit", (e) => this.onLinkSubmit(e));
      this.listen(this.linkBox, "click", (e) => {
        if (e.target.closest("[data-link-cancel]")) this.closeLink();
        if (e.target.closest("[data-link-remove]")) this.removeLink();
      });
      this.listen(this.linkBox, "keydown", (e) => e.key === "Escape" && (e.preventDefault(), this.closeLink()));
      this.sync();
    }

    attributeChangedCallback(name) {
      if (!this.area) return;
      if (name === "toolbar") this.buildToolbar();
      this.sync();
    }

    get readOnly() {
      return this.hasAttribute("readonly") || this.hasAttribute("disabled") || this.hasAttribute("data-form-disabled");
    }

    sync() {
      this.area.contentEditable = this.readOnly ? "false" : "true";
      this.area.setAttribute("aria-readonly", String(this.readOnly));
      this.area.setAttribute("aria-placeholder", this.getAttribute("placeholder") || "");
      this.area.dataset.placeholder = this.getAttribute("placeholder") || "";
      this.bar.hidden = this.readOnly || this.getAttribute("toolbar") === "none";
      for (const el of this.bar.querySelectorAll("button, select")) el.disabled = this.readOnly;
      this.refresh();
    }

    // The buttons from a preset or a list: "bold italic | lists | link -image".
    buttonList() {
      const spec = this.getAttribute("toolbar") || "standard";
      if (spec === "none") return [];
      const words = spec.split(/\s+/).filter(Boolean);
      const base = PRESETS[words[0]] ? PRESETS[words[0]].split(/\s+/) : [];
      const rest = PRESETS[words[0]] ? words.slice(1) : words;
      let list = [...base];
      for (const w of rest) {
        if (w.startsWith("-")) {
          const name = w.slice(1);
          const remove = GROUPS[name] || [name];
          list = list.filter((x) => !remove.includes(x) && x !== name);
        } else list.push(w);
      }
      return list.flatMap((x) => (x === "|" ? ["|"] : GROUPS[x] || [x])).filter((x, i, all) => x === "|" ? i > 0 && all[i - 1] !== "|" : BUTTONS[x]).filter((x, i, all) => !(x === "|" && i === all.length - 1));
    }

    buildToolbar() {
      const html = this.buttonList()
        .map((name) => {
          if (name === "|") return '<span class="vs-rte-sep" role="separator"></span>';
          const b = BUTTONS[name];
          const keys = b.keys ? ` (${Viraspa.keyboard.label(b.keys)})` : "";
          if (b.type === "select") {
            return `<select class="vs-rte-block" tabindex="-1" aria-label="${esc(t(b.label))}"><option value="p">${esc(t("Paragraph"))}</option><option value="h1">${esc(t("Heading 1"))}</option><option value="h2">${esc(t("Heading 2"))}</option><option value="h3">${esc(t("Heading 3"))}</option></select>`;
          }
          return `<button type="button" class="vs-rte-button" data-button="${name}" tabindex="-1" aria-label="${esc(t(b.label) + keys)}" title="${esc(t(b.label) + keys)}"${b.command && !["undo", "redo", "indent", "outdent", "insertHorizontalRule"].includes(b.command) ? ' aria-pressed="false"' : ""}>${b.icon}</button>`;
        })
        .join("");
      this.bar.innerHTML = html;
      const first = this.bar.querySelector("button, select");
      if (first) first.tabIndex = 0;
      this.shortcuts = this.buttonList().filter((n) => n !== "|" && BUTTONS[n].keys).map((n) => [n, BUTTONS[n].keys]);
    }

    // ---- the engine adapter --------------------------------------------------------
    exec(command, value = null) {
      try {
        return document.execCommand(command, false, value);
      } catch {
        return false;
      }
    }
    state(command) {
      try {
        return document.queryCommandState(command);
      } catch {
        return false;
      }
    }
    selectionInside() {
      const sel = document.getSelection();
      return Boolean(sel && sel.rangeCount && this.area.contains(sel.getRangeAt(0).commonAncestorContainer));
    }
    // The block element around the cursor.
    currentBlock() {
      const sel = document.getSelection();
      if (!sel || !sel.rangeCount) return null;
      let node = sel.getRangeAt(0).startContainer;
      while (node && node !== this.area) {
        if (node.nodeType === 1 && /^(P|H1|H2|H3|BLOCKQUOTE|LI)$/.test(node.nodeName)) return node;
        node = node.parentNode;
      }
      return null;
    }

    // ---- commands ---------------------------------------------------------------------
    run(name) {
      if (this.readOnly) return;
      this.area.focus();
      const b = BUTTONS[name];
      if (name === "link") return this.openLink();
      if (name === "image") return this.insertImage();
      if (name === "quote") {
        const block = this.currentBlock();
        this.exec("formatBlock", block && block.closest("blockquote") ? "<p>" : "<blockquote>");
      } else if (name === "clear") {
        this.exec("removeFormat");
        this.exec("unlink");
        this.exec("formatBlock", "<p>");
      } else if (b && b.command) this.exec(b.command);
      this.refresh();
    }

    setBlock(tag) {
      if (this.readOnly) return;
      this.area.focus();
      this.exec("formatBlock", `<${tag}>`);
      this.refresh();
    }

    onToolbar(event) {
      const button = event.target.closest("[data-button]");
      if (button && !button.disabled) this.run(button.dataset.button);
    }

    // The toolbar is one Tab stop: arrows move between its controls.
    onToolbarKey(event) {
      const items = [...this.bar.querySelectorAll("button, select")];
      const i = items.indexOf(event.target);
      if (i === -1) return;
      let next = null;
      if (event.key === "ArrowRight") next = items[(i + 1) % items.length];
      else if (event.key === "ArrowLeft") next = items[(i - 1 + items.length) % items.length];
      else if (event.key === "Home") next = items[0];
      else if (event.key === "End") next = items[items.length - 1];
      else if (event.key === "Escape") {
        event.preventDefault();
        this.area.focus();
        return;
      }
      if (next && event.target.localName !== "select") {
        event.preventDefault();
        items.forEach((el) => (el.tabIndex = -1));
        next.tabIndex = 0;
        next.focus();
      }
    }

    onKey(event) {
      if (this.readOnly) return;
      // Shortcuts (the developer may change them: keys = { bold: "mod+b", link: false … }).
      const map = this.keymap(Object.fromEntries(this.shortcuts || []));
      const action = Viraspa.keyboard.actionFor(event, map);
      if (action) {
        event.preventDefault();
        this.run(action);
        return;
      }
      // Alt+F10 goes to the toolbar (as in most editors); Tab inside a list indents.
      if (event.key === "F10" && event.altKey) {
        event.preventDefault();
        const first = this.bar.querySelector('[tabindex="0"]') || this.bar.querySelector("button, select");
        if (first) first.focus();
      } else if (event.key === "Tab" && this.currentBlock() && this.currentBlock().localName === "li") {
        event.preventDefault();
        this.exec(event.shiftKey ? "outdent" : "indent");
        this.refresh();
      }
    }

    // ---- the length limit ---------------------------------------------------------------
    maxLength() {
      return Number(this.getAttribute("maxlength")) || 0;
    }
    onBeforeInput(event) {
      const max = this.maxLength();
      if (!max || !event.inputType.startsWith("insert") || event.inputType === "insertParagraph") return;
      const sel = document.getSelection();
      const selected = sel && sel.rangeCount ? sel.toString().length : 0;
      const adding = (event.data || "").length || 1;
      if (this.area.innerText.replace(/\n/g, "").length - selected + adding > max) event.preventDefault();
    }

    // ---- paste and drop --------------------------------------------------------------------
    onPaste(event) {
      if (this.readOnly) return;
      const data = event.clipboardData;
      if (!data) return;
      const image = [...(data.files || [])].find((f) => f.type.startsWith("image/"));
      if (image && this.hasAttribute("image-paste")) {
        event.preventDefault();
        this.uploadAndInsert(image);
        return;
      }
      event.preventDefault();
      const max = this.maxLength();
      const room = max ? Math.max(0, max - this.area.innerText.replace(/\n/g, "").length) : Infinity;
      if (this.getAttribute("paste") === "plain" || !data.types.includes("text/html")) {
        const text = data.getData("text/plain").slice(0, room);
        const html = text
          .split(/\r?\n\r?\n/)
          .map((p) => `<p>${esc(p).replace(/\r?\n/g, "<br>")}</p>`)
          .join("");
        this.exec("insertHTML", text.includes("\n") ? html : esc(text));
      } else {
        let clean = sanitize(data.getData("text/html"), this.allowed);
        if (max && this.textOf(clean).length > room) clean = esc(this.textOf(clean).slice(0, room));
        this.exec("insertHTML", clean);
      }
      this.refresh();
    }
    textOf(html) {
      const div = document.createElement("div");
      div.innerHTML = html;
      return div.textContent;
    }
    onDrop(event) {
      const image = [...((event.dataTransfer && event.dataTransfer.files) || [])].find((f) => f.type.startsWith("image/"));
      if (image && this.hasAttribute("image-paste") && !this.readOnly) {
        event.preventDefault();
        this.uploadAndInsert(image);
      } else if (event.dataTransfer && event.dataTransfer.types.includes("text/html")) {
        event.preventDefault(); // dropped HTML is cleaned like a paste
        this.exec("insertHTML", sanitize(event.dataTransfer.getData("text/html"), this.allowed));
        this.refresh();
      }
    }

    // ---- links ------------------------------------------------------------------------------
    // A small form under the toolbar: address and "open in a new tab".
    openLink() {
      const sel = document.getSelection();
      this._range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      const start = this._range ? this._range.startContainer : null;
      const element = start && (start.nodeType === 1 ? start : start.parentElement);
      const anchor = element ? element.closest("a") : null;
      this._editing = anchor && this.area.contains(anchor) ? anchor : null;
      const box = this.linkBox;
      box.hidden = false;
      box.querySelector('[name="href"]').value = this._editing ? this._editing.getAttribute("href") : "";
      box.querySelector('[name="blank"]').checked = this._editing ? this._editing.target === "_blank" : this.getAttribute("link-target") === "_blank";
      box.querySelector("[data-link-remove]").hidden = !this._editing;
      box.querySelector('[name="href"]').focus();
    }
    closeLink() {
      this.linkBox.hidden = true;
      this.restoreRange();
    }
    restoreRange() {
      this.area.focus();
      if (this._range) {
        const sel = document.getSelection();
        sel.removeAllRanges();
        sel.addRange(this._range);
      }
    }
    onLinkSubmit(event) {
      event.preventDefault();
      const href = safeHref(this.linkBox.querySelector('[name="href"]').value);
      const blank = this.linkBox.querySelector('[name="blank"]').checked;
      const input = this.linkBox.querySelector('[name="href"]');
      if (!href) {
        input.setCustomValidity(t("Enter a web address, e.g. https://example.com"));
        input.reportValidity();
        input.setCustomValidity("");
        return;
      }
      this.linkBox.hidden = true;
      this.restoreRange();
      if (this._editing) {
        this._editing.setAttribute("href", href);
      } else if (this._range && !this._range.collapsed) {
        this.exec("createLink", href);
      } else {
        this.exec("insertHTML", `<a href="${esc(href)}">${esc(href)}</a>`);
      }
      for (const a of this.area.querySelectorAll(`a[href="${CSS.escape(href)}"]`)) {
        if (blank) {
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        } else {
          a.removeAttribute("target");
          a.removeAttribute("rel");
        }
      }
      this.refresh();
    }
    removeLink() {
      this.linkBox.hidden = true;
      this.restoreRange();
      if (this._editing) {
        const range = document.createRange();
        range.selectNodeContents(this._editing);
        const sel = document.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      this.exec("unlink");
      this.refresh();
    }

    // ---- images --------------------------------------------------------------------------
    async insertImage() {
      const sel = document.getSelection();
      this._range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      if (typeof this.uploadImage === "function") {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.addEventListener("change", () => input.files[0] && this.uploadAndInsert(input.files[0]));
        input.click();
        return;
      }
      const ask = Viraspa.popup ? (q, o) => Viraspa.popup.prompt(q, o) : async (q) => window.prompt(q);
      const src = safeSrc(await ask(t("Image address"), { value: "https://" }));
      if (!src || src === "https://") return this.restoreRange();
      const alt = (await ask(t("Describe the image (for people who can't see it)"), { value: "" })) || "";
      this.restoreRange();
      this.exec("insertHTML", `<img src="${esc(src)}" alt="${esc(alt)}">`);
      this.refresh();
    }
    async uploadAndInsert(file) {
      if (typeof this.uploadImage !== "function") return;
      try {
        const url = safeSrc(await this.uploadImage(file));
        if (!url) return;
        this.restoreRange();
        this.exec("insertHTML", `<img src="${esc(url)}" alt="${esc(file.name.replace(/\.\w+$/, ""))}">`);
        this.refresh();
      } catch (err) {
        if (Viraspa.toast) Viraspa.toast.show(err && err.message ? err.message : t("The image could not be uploaded."), { type: "error" });
      }
    }

    // ---- state, counts, form ---------------------------------------------------------
    updateState() {
      if (!this.area || !this.selectionInside()) return;
      for (const button of this.bar.querySelectorAll("[aria-pressed]")) {
        const b = BUTTONS[button.dataset.button];
        button.setAttribute("aria-pressed", String(Boolean(b.command && this.state(b.command))));
      }
      const quote = this.bar.querySelector('[data-button="quote"]');
      const block = this.currentBlock();
      if (quote) quote.setAttribute("aria-pressed", String(Boolean(block && block.closest("blockquote"))));
      const select = this.bar.querySelector(".vs-rte-block");
      if (select) select.value = block && /^h[123]$/.test(block.localName) ? block.localName : "p";
    }

    refresh() {
      if (!this.area) return;
      const text = this.area.innerText.replace(/​/g, "");
      const empty = !text.trim() && !this.area.querySelector("img, hr");
      this.area.toggleAttribute("data-empty", empty);
      const chars = text.replace(/\n/g, "").length;
      const words = (text.match(/\S+/g) || []).length;
      const max = this.maxLength();
      this.status.hidden = !this.hasAttribute("show-count");
      this.status.textContent = max ? t("{chars} / {max} characters · {words} words").replace("{chars}", chars).replace("{max}", max).replace("{words}", words) : t("{chars} characters · {words} words").replace("{chars}", chars).replace("{words}", words);
      const value = empty ? "" : this.value;
      this.setFormValue(this.getAttribute("format") === "text" ? this.text : value);
      if (this.hasAttribute("required") && empty) this.setValidity({ valueMissing: true }, t("Please fill in this field."), this.area);
      else if (max && chars > max) this.setValidity({ tooLong: true }, t("The text is too long."), this.area);
      else this.setValidity({});
      this.updateState();
    }

    commit() {
      const value = this.value;
      if (value !== this._lastCommitted) {
        this._lastCommitted = value;
        this.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    onFormReset() {
      this.value = this._initial;
    }
    onFormDisabled() {
      this.sync();
    }
    focus(options) {
      if (this.area) this.area.focus(options);
      else super.focus(options);
    }
  }

  VsRichTextEditor.sanitize = sanitize;
  VsRichTextEditor.BUTTONS = Object.keys(BUTTONS);
  VsRichTextEditor.PRESETS = PRESETS;
  Viraspa.core.defineComponent(VsRichTextEditor);
})(window.Viraspa);
