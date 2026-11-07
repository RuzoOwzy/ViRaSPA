(function (Viraspa) {
  // A popup (modal dialog) built on the browser's own <dialog>: it sits above
  // everything, keeps keyboard focus inside and returns it when closed.
  //
  //   <vs-popup id="edit" heading="Edit customer" size="medium">
  //     …content…
  //     <div slot="footer"><button data-close>Cancel</button> <button data-close="save">Save</button></div>
  //   </vs-popup>
  //   const result = await document.querySelector("#edit").open();   // "save", or null when cancelled
  //
  // Attributes: heading, size (small | medium | large | full), closable
  // (default true: the × button, Escape and a click outside close it;
  // closable="false" for a popup that needs an answer), modal (default true).
  // Any element with data-close inside closes it; its value is the result.
  // Events: "vs-open", "vs-close" (detail: { value }), "vs-cancel"
  // (cancelable: e.g. ask before losing unsaved changes).
  //
  // Quick popups from code (load the component at startup with
  // startup.js components: ["vs-popup"]):
  //   await Viraspa.popup.alert("Saved.");
  //   if (await Viraspa.popup.confirm("Delete this invoice?", { okLabel: "Delete", danger: true })) …
  //   const name = await Viraspa.popup.prompt("New name", { value: "Amina" });   // null when cancelled
  //   Viraspa.popup.flash("Copied", { seconds: 2 });   // closes by itself
  //   Viraspa.popup.drop("Connection lost", { seconds: 5 });   // slides from the top
  //   const el = await Viraspa.popup.open({ heading: "Report", url: "/reports/1.pdf", size: "full" });
  // alert/confirm/prompt wait for each other (a queue), so they never overlap.
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);

  class VsPopup extends Viraspa.core.Component {
    static tag = "vs-popup";
    static folder = "components/vs-popup";
    static isolation = "full";
    static hasModel = false;
    static observedAttributes = ["heading", "size", "closable"];

    get closable() {
      return this.getAttribute("closable") !== "false";
    }
    get isOpen() {
      return Boolean(this.dialog && this.dialog.open);
    }

    async afterLoad() {
      const root = this.componentRoot;
      this.dialog = root.querySelector("dialog");
      this.headingEl = root.querySelector(".heading");
      this.x = root.querySelector(".x");
      this.x.setAttribute("aria-label", t("Close"));
      this.dialog.setAttribute("aria-labelledby", "vs-popup-heading");
      this.update();
      // Escape: the dialog's own "cancel" event.
      this.listen(this.dialog, "cancel", (e) => {
        e.preventDefault();
        if (this.closable) this.cancel();
      });
      // A click on the backdrop (outside the box).
      this.listen(this.dialog, "click", (e) => {
        if (e.target === this.dialog && this.closable && this.getAttribute("close-on-outside") !== "false") this.cancel();
      });
      this.listen(this.x, "click", () => this.cancel());
      // data-close inside (in the slots too).
      this.listen(this, "click", (e) => {
        const closer = e.composedPath().find((n) => n instanceof Element && n.hasAttribute("data-close"));
        if (closer) this.close(closer.getAttribute("data-close") || null);
      });
      // The footer shows only when something is placed in it.
      const footerSlot = root.querySelector('slot[name="footer"]');
      const foot = root.querySelector(".foot");
      const toggleFooter = () => (foot.hidden = footerSlot.assignedNodes().length === 0);
      this.listen(footerSlot, "slotchange", toggleFooter);
      toggleFooter();
      if (this.hasAttribute("open")) this.open();
    }

    attributeChangedCallback() {
      if (this.dialog) this.update();
    }

    update() {
      const size = ["small", "medium", "large", "full"].includes(this.getAttribute("size")) ? this.getAttribute("size") : "medium";
      this.dialog.dataset.size = size;
      this.headingEl.textContent = this.getAttribute("heading") ? t(this.getAttribute("heading")) : "";
      this.headingEl.hidden = !this.getAttribute("heading");
      this.x.hidden = !this.closable;
    }

    // Opens it; resolves with the result when it closes.
    async open() {
      await this.ready;
      if (this.isOpen) return this._result;
      this._result = new Promise((resolve) => (this._resolve = resolve));
      this._returnFocus = document.activeElement;
      if (this.getAttribute("modal") === "false") this.dialog.show();
      else this.dialog.showModal();
      this.setAttribute("opened", "");
      const first = this.querySelector("[autofocus]") || Viraspa.keyboard.tabbables(this).find((el) => !el.hasAttribute("data-close")) || this.x;
      if (first && first.focus) first.focus();
      this.dispatchEvent(new CustomEvent("vs-open", { bubbles: true, composed: true }));
      return this._result;
    }

    close(value = null) {
      if (!this.isOpen) return;
      this.dialog.close();
      this.removeAttribute("opened");
      const back = this._returnFocus;
      if (back && back.isConnected && back.focus) back.focus();
      this.dispatchEvent(new CustomEvent("vs-close", { detail: { value }, bubbles: true, composed: true }));
      if (this._resolve) this._resolve(value);
      this._resolve = null;
    }

    // Escape, ×, a click outside: "vs-cancel" may stop it.
    cancel() {
      const event = new CustomEvent("vs-cancel", { bubbles: true, composed: true, cancelable: true });
      if (this.dispatchEvent(event)) this.close(null);
    }
  }

  Viraspa.core.defineComponent(VsPopup);

  // ---- Viraspa.popup --------------------------------------------------------
  const escape = (s) => Viraspa.utility.dom.escapeHtml(s);
  let queue = Promise.resolve();
  // alert/confirm/prompt run one after another.
  const queued = (fn) => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  };

  async function show({ heading = "", body = "", footer = "", size = "small", closable = true, setup } = {}) {
    const popup = document.createElement("vs-popup");
    popup.setAttribute("size", size);
    if (heading) popup.setAttribute("heading", heading);
    if (!closable) popup.setAttribute("closable", "false");
    popup.innerHTML = `${body}${footer ? `<div slot="footer" class="vs-popup-actions">${footer}</div>` : ""}`;
    document.body.appendChild(popup);
    await popup.ready;
    if (setup) setup(popup);
    const result = await popup.open();
    popup.remove();
    return result;
  }

  const text = (message) => `<p class="vs-popup-message">${escape(t(message))}</p>`;

  function alert(message, { heading = "", okLabel = "OK" } = {}) {
    return queued(() => show({ heading: heading && t(heading), body: text(message), footer: `<button type="button" data-close="ok" autofocus>${escape(t(okLabel))}</button>` }).then(() => undefined));
  }

  function confirm(message, { heading = "", okLabel = "OK", cancelLabel = "Cancel", danger = false, focusOk = true } = {}) {
    return queued(() =>
      show({
        heading: heading && t(heading),
        body: text(message),
        footer: `<button type="button" data-close>${escape(t(cancelLabel))}</button><button type="button" data-close="ok" class="${danger ? "danger" : "primary"}"${focusOk ? " autofocus" : ""}>${escape(t(okLabel))}</button>`,
      }).then((r) => r === "ok")
    );
  }

  function prompt(message, { heading = "", value = "", okLabel = "OK", cancelLabel = "Cancel", type = "text", required = false } = {}) {
    return queued(() => {
      let input;
      return show({
        heading: heading && t(heading),
        body: `<label class="vs-popup-prompt">${escape(t(message))}<input type="${escape(type)}" value="${escape(value)}"${required ? " required" : ""} autofocus></label>`,
        footer: `<button type="button" data-close>${escape(t(cancelLabel))}</button><button type="button" data-close="ok" class="primary">${escape(t(okLabel))}</button>`,
        setup(popup) {
          input = popup.querySelector("input");
          // Enter in the field = OK.
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (input.checkValidity()) popup.close("ok");
              else input.reportValidity();
            }
          });
          // OK with an invalid value: explain instead of closing.
          popup.querySelector('[data-close="ok"]').addEventListener("click", (e) => {
            if (!input.checkValidity()) {
              e.stopPropagation();
              input.reportValidity();
            }
          });
        },
      }).then((r) => (r === "ok" ? input.value : null));
    });
  }

  // A message that closes by itself (centre, or "drop": from the top).
  function flash(message, { seconds = 2, drop: fromTop = false } = {}) {
    const box = document.createElement("div");
    box.className = `vs-popup-flash${fromTop ? " vs-popup-drop" : ""}`;
    box.setAttribute("role", "status");
    box.textContent = t(message);
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add("is-shown"));
    return new Promise((resolve) =>
      setTimeout(() => {
        box.classList.remove("is-shown");
        setTimeout(() => {
          box.remove();
          resolve();
        }, 300);
      }, seconds * 1000)
    );
  }

  // Any content, or a page/document by URL (in a frame), in a popup.
  async function open({ heading = "", content = "", url = "", size = "large", closable = true } = {}) {
    const body = url
      ? `<div class="vs-popup-frame"><p class="vs-popup-loading">${escape(t("Loading…"))}</p><iframe src="${escape(Viraspa.services && Viraspa.services.databinding ? Viraspa.services.databinding.safeUrl(url) : url)}" title="${escape(heading || t("Content"))}"></iframe></div>`
      : typeof content === "string"
      ? content
      : "";
    return show({
      heading,
      body,
      size,
      closable,
      setup(popup) {
        if (content instanceof Node) popup.appendChild(content);
        const frame = popup.querySelector("iframe");
        if (frame) frame.addEventListener("load", () => popup.querySelector(".vs-popup-loading").remove(), { once: true });
      },
    });
  }

  Viraspa.popup = Object.freeze({ alert, confirm, prompt, flash, drop: (message, options = {}) => flash(message, { seconds: 4, ...options, drop: true }), open });

  // Page-level styles for the quick popups (their content is in the page).
  if (!document.getElementById("vs-popup-page-styles")) {
    const style = document.createElement("style");
    style.id = "vs-popup-page-styles";
    style.textContent = `
      vs-popup .vs-popup-message { margin: 0; white-space: pre-line; }
      vs-popup .vs-popup-actions { display: flex; justify-content: flex-end; gap: .5rem; }
      vs-popup .vs-popup-actions button { padding: .45rem 1rem; border: 1px solid var(--vs-color-border); border-radius: var(--vs-radius); background: var(--vs-color-surface, #fff); color: inherit; font: inherit; cursor: pointer; }
      vs-popup .vs-popup-actions button.primary { border-color: var(--vs-color-primary); background: var(--vs-color-primary); color: #fff; }
      vs-popup .vs-popup-actions button.danger { border-color: var(--vs-color-danger, #c0392b); background: var(--vs-color-danger, #c0392b); color: #fff; }
      vs-popup .vs-popup-prompt { display: grid; gap: .4rem; }
      vs-popup .vs-popup-prompt input { padding: .45rem .6rem; border: 1px solid var(--vs-color-border); border-radius: var(--vs-radius); font: inherit; }
      vs-popup .vs-popup-frame { position: relative; height: 100%; min-height: 60vh; }
      vs-popup .vs-popup-frame iframe { width: 100%; height: 100%; min-height: 60vh; border: 0; }
      vs-popup .vs-popup-loading { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; color: var(--vs-color-text-muted); }
      .vs-popup-flash { position: fixed; left: 50%; top: 50%; z-index: 2147482500; padding: .75rem 1.25rem; border-radius: var(--vs-radius, 8px); background: rgba(20, 30, 27, .92); color: #fff; transform: translate(-50%, -50%) scale(.96); opacity: 0; transition: opacity .2s, transform .2s; pointer-events: none; }
      .vs-popup-flash.vs-popup-drop { top: 1rem; transform: translate(-50%, -150%); }
      .vs-popup-flash.is-shown { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      .vs-popup-flash.vs-popup-drop.is-shown { transform: translate(-50%, 0); }
    `;
    document.head.appendChild(style);
  }
})(window.Viraspa);
