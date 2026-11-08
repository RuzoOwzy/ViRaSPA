(function (Viraspa) {
  // A viewer for images, SVG, PDF, video and other documents, full screen
  // over the page, with zoom, pan, rotation and a gallery.
  //
  //   <vs-media-viewer id="viewer"></vs-media-viewer>
  //   viewer.open([{ src: "a.jpg", title: "Receipt", caption: "Paid 8 Nov" }, { src: "b.pdf" }], 0);
  //
  //   <vs-media-viewer gallery>             a gallery: clicking an image or link inside opens it
  //     <img src="thumbs/1.jpg" data-full="photos/1.jpg" alt="Shop front">
  //     <a href="invoice.pdf">Invoice</a>
  //   </vs-media-viewer>
  //
  // - Images and SVG: zoom with the wheel, a pinch, the + / − buttons or keys;
  //   drag to pan when zoomed; double-click (or 0) fits again; rotate;
  //   swipe sideways (at normal size) for the next / previous item.
  // - PDF: the browser's own viewer. Video: the browser's player.
  // - Other documents (Word, Excel…): a download/open link. The Google Docs
  //   viewer is only used with allow-external-viewer, because it sends the
  //   file's address to Google.
  // - Keyboard: Left/Right (or Page Up/Down) previous/next, Home/End first/
  //   last, + / − zoom, 0 fit, R rotate, arrows pan when zoomed, Escape
  //   closes (keys = { next, previous, zoomIn, zoomOut, fit, rotate }).
  // - Attributes: gallery, download (a download button), allow-external-viewer.
  // Events: "vs-open", "vs-close", "vs-change" (detail: { index, item }).
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const esc = (s) => Viraspa.utility.dom.escapeHtml(s);
  const KEYS = { next: ["arrowright", "pagedown"], previous: ["arrowleft", "pageup"], zoomIn: ["+", "="], zoomOut: ["-", "_"], fit: "0", rotate: "r", first: "home", last: "end" };

  function kindOf(item) {
    if (item.type) return item.type;
    const src = String(item.src || "").split(/[?#]/)[0].toLowerCase();
    if (/\.(png|jpe?g|gif|webp|avif|bmp|ico)$/.test(src) || src.startsWith("data:image/") || src.startsWith("blob:")) return "image";
    if (/\.svg$/.test(src)) return "image";
    if (/\.pdf$/.test(src)) return "pdf";
    if (/\.(mp4|webm|ogv|mov)$/.test(src)) return "video";
    return "document";
  }

  class VsMediaViewer extends Viraspa.core.Component {
    static tag = "vs-media-viewer";
    static folder = "components/vs-media-viewer";
    static isolation = "full";
    static hasModel = false;

    constructor() {
      super();
      this.items = [];
      this.index = 0;
      this.view = { scale: 1, x: 0, y: 0, rotate: 0 };
    }

    async afterLoad() {
      const root = this.componentRoot;
      this.dialog = root.querySelector("dialog");
      this.stage = root.querySelector(".stage");
      this.titleEl = root.querySelector(".title");
      this.caption = root.querySelector(".caption");
      this.counter = root.querySelector(".counter");
      for (const [cls, label] of [["prev", "Previous"], ["next", "Next"], ["zoom-in", "Zoom in"], ["zoom-out", "Zoom out"], ["fit", "Fit to screen"], ["rotate", "Rotate"], ["download", "Download"], ["close", "Close"]]) {
        const b = root.querySelector(`.${cls}`);
        b.setAttribute("aria-label", t(label));
        b.title = t(label);
      }
      this.dialog.setAttribute("aria-label", t("Viewer"));
      this.listen(root.querySelector(".bar"), "click", (e) => this.onButton(e));
      this.listen(this.dialog, "keydown", (e) => this.onKey(e));
      this.listen(this.dialog, "cancel", (e) => {
        e.preventDefault();
        this.close();
      });
      this.listen(this.stage, "wheel", (e) => this.onWheel(e), { passive: false });
      this.listen(this.stage, "pointerdown", (e) => this.onPointerDown(e));
      this.listen(this.stage, "dblclick", () => (this.view.scale === 1 ? this.zoomTo(2) : this.fit()));
      if (this.hasAttribute("gallery")) {
        this.listen(this, "click", (e) => {
          const el = e.target.closest("img, a[href]");
          if (!el || !this.contains(el)) return;
          e.preventDefault();
          const list = this.galleryItems();
          this.open(list.map((x) => x.item), list.findIndex((x) => x.el === el));
        });
      }
    }

    galleryItems() {
      return [...this.querySelectorAll("img, a[href]")].map((el) => ({
        el,
        item: el.localName === "img" ? { src: el.dataset.full || el.currentSrc || el.src, title: el.alt || el.title, caption: el.dataset.caption || "" } : { src: el.href, title: el.textContent.trim() || el.title, caption: el.dataset.caption || "" },
      }));
    }

    // Opens the viewer with these items (or the gallery's), at `index`.
    async open(items, index = 0) {
      await this.ready;
      this.items = (items || this.galleryItems().map((x) => x.item)).map((i) => (typeof i === "string" ? { src: i } : i));
      if (!this.items.length) return;
      this._returnFocus = document.activeElement;
      if (!this.dialog.open) this.dialog.showModal();
      this.show(Math.max(0, Math.min(this.items.length - 1, index)));
      this.componentRoot.querySelector(".close").focus();
      this.dispatchEvent(new CustomEvent("vs-open", { bubbles: true, composed: true }));
    }

    close() {
      if (!this.dialog.open) return;
      this.dialog.close();
      this.stage.innerHTML = "";
      const back = this._returnFocus;
      if (back && back.isConnected && back.focus) back.focus();
      this.dispatchEvent(new CustomEvent("vs-close", { bubbles: true, composed: true }));
    }

    show(index) {
      this.index = index;
      const item = this.items[index];
      const kind = kindOf(item);
      const safe = Viraspa.services && Viraspa.services.databinding ? Viraspa.services.databinding.safeUrl(item.src) : item.src;
      this.view = { scale: 1, x: 0, y: 0, rotate: 0 };
      this.dialog.dataset.kind = kind;
      this.titleEl.textContent = item.title || "";
      this.caption.textContent = item.caption || "";
      this.caption.hidden = !item.caption;
      this.counter.textContent = this.items.length > 1 ? `${index + 1} / ${this.items.length}` : "";
      const root = this.componentRoot;
      root.querySelector(".prev").disabled = index === 0;
      root.querySelector(".next").disabled = index === this.items.length - 1;
      root.querySelector(".prev").hidden = root.querySelector(".next").hidden = this.items.length < 2;
      const download = root.querySelector(".download");
      download.hidden = !this.hasAttribute("download");
      download.href = safe;
      download.setAttribute("download", item.title || "");
      if (kind === "image") {
        this.stage.innerHTML = `<img class="media" src="${esc(safe)}" alt="${esc(item.title || item.alt || "")}" draggable="false">`;
      } else if (kind === "pdf") {
        this.stage.innerHTML = `<iframe class="frame" src="${esc(safe)}" title="${esc(item.title || t("Document"))}"></iframe>`;
      } else if (kind === "video") {
        this.stage.innerHTML = `<video class="media-video" src="${esc(safe)}" controls></video>`;
      } else if (this.hasAttribute("allow-external-viewer") && /^https?:/i.test(safe)) {
        this.stage.innerHTML = `<iframe class="frame" src="https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(safe)}" title="${esc(item.title || t("Document"))}"></iframe>`;
      } else {
        this.stage.innerHTML = `<div class="doc"><p>${esc(t("This file can't be shown here."))}</p><a class="open-doc" href="${esc(safe)}" target="_blank" rel="noopener">${esc(t("Open or download it"))}</a></div>`;
      }
      root.querySelector(".tools").hidden = kind !== "image";
      this.apply();
      this.dispatchEvent(new CustomEvent("vs-change", { detail: { index, item }, bubbles: true, composed: true }));
    }

    // ---- zoom, pan, rotate ---------------------------------------------------------
    apply() {
      const img = this.stage.querySelector(".media");
      if (!img) return;
      const { scale, x, y, rotate } = this.view;
      img.style.transform = `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg)`;
      this.stage.classList.toggle("zoomed", scale > 1);
      this.componentRoot.querySelector(".zoom-level").textContent = `${Math.round(scale * 100)}%`;
    }
    zoomTo(scale, cx, cy) {
      const next = Math.max(1, Math.min(8, scale));
      // Keep the point under the pointer still while zooming.
      if (cx !== undefined) {
        const r = this.stage.getBoundingClientRect();
        const px = cx - r.left - r.width / 2;
        const py = cy - r.top - r.height / 2;
        const k = next / this.view.scale;
        this.view.x = px - (px - this.view.x) * k;
        this.view.y = py - (py - this.view.y) * k;
      }
      this.view.scale = next;
      if (next === 1) this.view.x = this.view.y = 0;
      this.apply();
    }
    fit() {
      this.view.scale = 1;
      this.view.x = this.view.y = 0;
      this.apply();
    }
    rotate() {
      this.view.rotate = (this.view.rotate + 90) % 360;
      this.apply();
    }
    pan(dx, dy) {
      if (this.view.scale === 1) return;
      this.view.x += dx;
      this.view.y += dy;
      this.apply();
    }

    onWheel(event) {
      if (kindOf(this.items[this.index] || {}) !== "image") return;
      event.preventDefault();
      this.zoomTo(this.view.scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15), event.clientX, event.clientY);
    }

    // One pointer drags (pans); two pointers pinch (zoom); a sideways swipe
    // at normal size goes to the next or previous item.
    onPointerDown(event) {
      if (kindOf(this.items[this.index] || {}) !== "image") return;
      this.pointers = this.pointers || new Map();
      if (!this.pointers.size) this._swipe = { x: event.clientX, y: event.clientY, fitted: this.view.scale === 1, time: Date.now() };
      if (this.pointers.size) this._swipe = null;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try {
        this.stage.setPointerCapture(event.pointerId);
      } catch {
        // not an active pointer (e.g. a synthetic event): drag without capture
      }
      const move = (e) => {
        if (!this.pointers.has(e.pointerId)) return;
        const before = this.pointers.get(e.pointerId);
        if (this.pointers.size === 2) {
          const [a, b] = [...this.pointers.values()];
          const d1 = Math.hypot(a.x - b.x, a.y - b.y);
          this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const [c, d] = [...this.pointers.values()];
          const d2 = Math.hypot(c.x - d.x, c.y - d.y);
          if (d1) this.zoomTo(this.view.scale * (d2 / d1), (c.x + d.x) / 2, (c.y + d.y) / 2);
        } else {
          this.pan(e.clientX - before.x, e.clientY - before.y);
          this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
      };
      const up = (e) => {
        this.pointers.delete(e.pointerId);
        const s = this._swipe;
        if (!this.pointers.size && s && s.fitted && e.type === "pointerup" && this.items.length > 1) {
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx) / 2 && Date.now() - s.time < 800) {
            const next = this.index + (dx < 0 ? 1 : -1);
            if (next >= 0 && next < this.items.length) this.show(next);
          }
        }
        if (!this.pointers.size) {
          this._swipe = null;
          this.stage.removeEventListener("pointermove", move);
          this.stage.removeEventListener("pointerup", up);
          this.stage.removeEventListener("pointercancel", up);
        }
      };
      this.stage.addEventListener("pointermove", move);
      this.stage.addEventListener("pointerup", up);
      this.stage.addEventListener("pointercancel", up);
    }

    onButton(event) {
      const b = event.target.closest("button, a");
      if (!b) return;
      if (b.classList.contains("close")) this.close();
      else if (b.classList.contains("prev")) this.show(Math.max(0, this.index - 1));
      else if (b.classList.contains("next")) this.show(Math.min(this.items.length - 1, this.index + 1));
      else if (b.classList.contains("zoom-in")) this.zoomTo(this.view.scale * 1.25);
      else if (b.classList.contains("zoom-out")) this.zoomTo(this.view.scale / 1.25);
      else if (b.classList.contains("fit")) this.fit();
      else if (b.classList.contains("rotate")) this.rotate();
    }

    onKey(event) {
      if (event.target.closest && event.target.closest("iframe, video")) return;
      const action = Viraspa.keyboard.actionFor(event, this.keymap(KEYS));
      const zoomed = this.view.scale > 1;
      // Zoomed in: the arrows pan the image instead of changing it.
      if (zoomed && /^Arrow/.test(event.key)) {
        event.preventDefault();
        const step = 40;
        this.pan({ ArrowLeft: step, ArrowRight: -step }[event.key] || 0, { ArrowUp: step, ArrowDown: -step }[event.key] || 0);
        return;
      }
      if (!action) return;
      const image = kindOf(this.items[this.index] || {}) === "image";
      event.preventDefault();
      if (action === "next") this.show(Math.min(this.items.length - 1, this.index + 1));
      else if (action === "previous") this.show(Math.max(0, this.index - 1));
      else if (action === "first") this.show(0);
      else if (action === "last") this.show(this.items.length - 1);
      else if (image && action === "zoomIn") this.zoomTo(this.view.scale * 1.25);
      else if (image && action === "zoomOut") this.zoomTo(this.view.scale / 1.25);
      else if (image && action === "fit") this.fit();
      else if (image && action === "rotate") this.rotate();
    }
  }

  Viraspa.core.defineComponent(VsMediaViewer);
})(window.Viraspa);
