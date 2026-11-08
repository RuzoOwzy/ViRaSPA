(function (Viraspa) {
  // Crop an image: a profile photo, a product picture, a scanned receipt.
  //
  //   <vs-image-cropper name="photo" aspect="1" output-width="400" output-type="image/jpeg"></vs-image-cropper>
  //   const blob = await cropper.toBlob();            // or cropper.toDataURL()
  //   cropper.upload = async (blob) => (await api.uploadPhoto(blob)).url;   // used by cropper.save()
  //
  // - The image: `src`, a file chosen with the "Choose image" button
  //   (cropper.chooseFile()), or a file dropped onto it.
  // - The crop box: drag it to move, drag a handle to resize; aspect="1"
  //   (or "16/9", "4/3"; empty = free); min-size in output pixels.
  // - Zoom (the slider, the wheel) and rotate 90°.
  // - Keyboard on the box: arrows move (Shift: 10×), Alt+arrows resize, + / −
  //   zoom, R rotate (keys = { zoomIn, zoomOut, rotate }).
  // - Output: output-width / output-height (else the crop's own size),
  //   output-type (image/png default, image/jpeg, image/webp), quality (0–1).
  //   In a form, the cropped image is sent as a file under `name`.
  // Events: "vs-crop" (detail: { x, y, width, height } in image pixels) while
  // the box changes, "vs-image-load", "vs-upload" (detail: { url }).
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const KEYS = { zoomIn: ["+", "="], zoomOut: ["-", "_"], rotate: "r" };

  class VsImageCropper extends Viraspa.core.Component {
    static tag = "vs-image-cropper";
    static folder = "components/vs-image-cropper";
    static isolation = "full";
    static hasModel = false;
    static formAssociated = true;
    static observedAttributes = ["src", "aspect"];

    constructor() {
      super();
      this.box = { x: 0, y: 0, w: 0, h: 0 }; // in displayed-image pixels
      this.zoom = 1;
    }

    get aspect() {
      const a = this.getAttribute("aspect");
      if (!a) return null;
      const [w, h] = a.split(/[/:]/).map(Number);
      return h ? w / h : Number(a) || null;
    }

    async afterLoad() {
      const root = this.componentRoot;
      this.stage = root.querySelector(".stage");
      this.img = root.querySelector("img");
      this.frame = root.querySelector(".crop");
      this.zoomInput = root.querySelector(".zoom");
      this.file = root.querySelector('input[type="file"]');
      root.querySelector(".choose").textContent = t("Choose image");
      root.querySelector(".rotate").setAttribute("aria-label", t("Rotate"));
      root.querySelector(".empty").textContent = t("Choose an image, or drop one here.");
      this.zoomInput.setAttribute("aria-label", t("Zoom"));
      this.frame.setAttribute("aria-label", t("Crop area: arrows move it, Alt+arrows resize it"));
      this.listen(root.querySelector(".choose"), "click", () => this.chooseFile());
      this.listen(root.querySelector(".rotate"), "click", () => this.rotate());
      this.listen(this.file, "change", () => this.file.files[0] && this.loadFile(this.file.files[0]));
      this.listen(this.zoomInput, "input", () => this.setZoom(Number(this.zoomInput.value)));
      this.listen(this.stage, "wheel", (e) => {
        if (!this.loaded) return;
        e.preventDefault();
        this.setZoom(this.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
      }, { passive: false });
      this.listen(this.stage, "dragover", (e) => e.preventDefault());
      this.listen(this.stage, "drop", (e) => {
        e.preventDefault();
        const f = [...(e.dataTransfer.files || [])].find((x) => x.type.startsWith("image/"));
        if (f) this.loadFile(f);
      });
      this.listen(this.frame, "pointerdown", (e) => this.onDrag(e));
      this.listen(this.frame, "keydown", (e) => this.onKey(e));
      this.listen(this.img, "load", () => this.onImage());
      if (this.getAttribute("src")) this.setSource(this.getAttribute("src"));
    }

    attributeChangedCallback(name) {
      if (!this.img) return;
      if (name === "src") this.setSource(this.getAttribute("src"));
      else this.resetBox();
    }

    chooseFile() {
      this.file.click();
    }

    loadFile(file) {
      if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
      this._objectUrl = URL.createObjectURL(file);
      this._fileName = file.name.replace(/\.\w+$/, "");
      this.setSource(this._objectUrl);
    }

    setSource(src) {
      this.loaded = false;
      this.rotation = 0;
      this._original = src;
      this.img.crossOrigin = /^https?:/i.test(src) && new URL(src, location.href).origin !== location.origin ? "anonymous" : null;
      this.img.src = src;
    }

    onImage() {
      this.loaded = true;
      this.stage.classList.add("has-image");
      this.zoom = 1;
      this.zoomInput.value = "1";
      this.layout();
      this.resetBox();
      this.dispatchEvent(new CustomEvent("vs-image-load", { detail: { width: this.img.naturalWidth, height: this.img.naturalHeight }, bubbles: true, composed: true }));
    }

    // The displayed image size (fitted in the stage, times the zoom).
    layout() {
      const stage = this.stage.getBoundingClientRect();
      const nw = this.img.naturalWidth;
      const nh = this.img.naturalHeight;
      const fit = Math.min((stage.width || 400) / nw, (stage.height || 300) / nh, 1);
      this.base = fit;
      const w = nw * fit * this.zoom;
      const h = nh * fit * this.zoom;
      this.img.style.width = `${w}px`;
      this.img.style.height = `${h}px`;
      this.display = { w, h };
    }

    resetBox() {
      if (!this.loaded) return;
      const { w, h } = this.display;
      let bw = w * 0.8;
      let bh = h * 0.8;
      const a = this.aspect;
      if (a) {
        if (bw / bh > a) bw = bh * a;
        else bh = bw / a;
      }
      this.box = { x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh };
      this.place();
    }

    setZoom(z) {
      if (!this.loaded) return;
      const before = this.display;
      this.zoom = Math.max(1, Math.min(5, z));
      this.zoomInput.value = String(this.zoom);
      this.layout();
      const k = this.display.w / before.w;
      this.box = { x: this.box.x * k, y: this.box.y * k, w: this.box.w * k, h: this.box.h * k };
      this.place();
    }

    // Rotates the picture itself (a new image), so cropping stays simple.
    async rotate() {
      if (!this.loaded) return;
      const canvas = document.createElement("canvas");
      canvas.width = this.img.naturalHeight;
      canvas.height = this.img.naturalWidth;
      const ctx = canvas.getContext("2d");
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(this.img, -this.img.naturalWidth / 2, -this.img.naturalHeight / 2);
      const blob = await new Promise((r) => canvas.toBlob(r));
      if (!blob) return;
      if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
      this._objectUrl = URL.createObjectURL(blob);
      this.img.src = this._objectUrl;
    }

    // Keeps the box inside the image and draws it.
    place() {
      const { w, h } = this.display;
      const min = Math.max(16, (Number(this.getAttribute("min-size")) || 0) * this.base * this.zoom * (this.img.naturalWidth ? 1 : 0));
      const b = this.box;
      b.w = Math.max(min, Math.min(b.w, w));
      b.h = Math.max(min, Math.min(b.h, h));
      const a = this.aspect;
      if (a) {
        if (b.w / b.h > a) b.w = b.h * a;
        else b.h = b.w / a;
      }
      b.x = Math.max(0, Math.min(b.x, w - b.w));
      b.y = Math.max(0, Math.min(b.y, h - b.h));
      Object.assign(this.frame.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
      this.frame.hidden = false;
      this.updateValue();
    }

    // The crop in the image's own pixels.
    get crop() {
      const k = 1 / (this.base * this.zoom || 1);
      return { x: Math.round(this.box.x * k), y: Math.round(this.box.y * k), width: Math.round(this.box.w * k), height: Math.round(this.box.h * k) };
    }

    onDrag(event) {
      if (!this.loaded) return;
      event.preventDefault();
      this.frame.focus();
      const handle = event.target.dataset.handle || "move";
      const start = { x: event.clientX, y: event.clientY, box: { ...this.box } };
      const a = this.aspect;
      const move = (e) => {
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        const b = { ...start.box };
        if (handle === "move") {
          b.x += dx;
          b.y += dy;
        } else {
          if (handle.includes("e")) b.w += dx;
          if (handle.includes("s")) b.h += dy;
          if (handle.includes("w")) {
            b.x += dx;
            b.w -= dx;
          }
          if (handle.includes("n")) {
            b.y += dy;
            b.h -= dy;
          }
          if (a) {
            if (handle === "n" || handle === "s") b.w = b.h * a;
            else b.h = b.w / a;
          }
        }
        this.box = b;
        this.place();
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }

    onKey(event) {
      if (!this.loaded) return;
      const action = Viraspa.keyboard.actionFor(event, this.keymap(KEYS));
      if (action) {
        event.preventDefault();
        if (action === "zoomIn") this.setZoom(this.zoom * 1.1);
        else if (action === "zoomOut") this.setZoom(this.zoom / 1.1);
        else this.rotate();
        return;
      }
      const step = event.shiftKey ? 10 : 2;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
      if (!d) return;
      event.preventDefault();
      if (event.altKey) {
        this.box.w += d[0];
        this.box.h += this.aspect ? d[0] / this.aspect : d[1];
      } else {
        this.box.x += d[0];
        this.box.y += d[1];
      }
      this.place();
    }

    // ---- output -----------------------------------------------------------------
    canvas() {
      const c = this.crop;
      const ow = Number(this.getAttribute("output-width")) || 0;
      const oh = Number(this.getAttribute("output-height")) || 0;
      const width = ow || (oh ? Math.round((oh * c.width) / c.height) : c.width);
      const height = oh || (ow ? Math.round((ow * c.height) / c.width) : c.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(this.img, c.x, c.y, c.width, c.height, 0, 0, canvas.width, canvas.height);
      return canvas;
    }
    type() {
      return ["image/png", "image/jpeg", "image/webp"].includes(this.getAttribute("output-type")) ? this.getAttribute("output-type") : "image/png";
    }
    quality() {
      return Number(this.getAttribute("quality")) || 0.92;
    }
    toBlob() {
      if (!this.loaded) return Promise.resolve(null);
      return new Promise((resolve) => this.canvas().toBlob(resolve, this.type(), this.quality()));
    }
    toDataURL() {
      return this.loaded ? this.canvas().toDataURL(this.type(), this.quality()) : "";
    }

    // Crops and uploads with your handler; resolves with its result (e.g. a URL).
    async save() {
      if (typeof this.upload !== "function") throw new Error("vs-image-cropper: give it an upload handler (cropper.upload = async (blob) => url).");
      const blob = await this.toBlob();
      const url = await this.upload(blob);
      this.dispatchEvent(new CustomEvent("vs-upload", { detail: { url }, bubbles: true, composed: true }));
      return url;
    }

    updateValue() {
      clearTimeout(this._valueTimer);
      this.dispatchEvent(new CustomEvent("vs-crop", { detail: this.crop, bubbles: true, composed: true }));
      if (!this.internals) return;
      // The form gets the cropped file (shortly after the box stops moving).
      this._valueTimer = setTimeout(async () => {
        const blob = await this.toBlob().catch(() => null);
        if (!blob) return;
        const ext = this.type().split("/")[1].replace("jpeg", "jpg");
        this.setFormValue(new File([blob], `${this._fileName || "image"}.${ext}`, { type: this.type() }));
      }, 200);
      if (this.hasAttribute("required")) this.setValidity(this.loaded ? {} : { valueMissing: true }, t("Please choose an image."));
    }
  }

  Viraspa.core.defineComponent(VsImageCropper);
})(window.Viraspa);
