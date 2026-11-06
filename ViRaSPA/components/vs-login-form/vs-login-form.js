(function (Viraspa) {
  // A configurable sign-in form. "scoped" isolation (no Shadow DOM), so
  // browsers' password managers and autofill work reliably.
  //
  //   <vs-login-form remember-me forgot-password-href="/forgot-password"
  //                  message-position="top"></vs-login-form>
  //   form.providers = [{ id: "google", label: "Google", icon: "fontawesome:google:brands" }];
  //   form.loginHandler = async ({ username, password, rememberMe }) => { ... throw new Error("Wrong password.") };
  //
  // On submit it calls, in this order of preference:
  //   1. element.loginHandler(credentials)
  //   2. Viraspa.session.login(credentials)   (when the app has a session)
  //   3. otherwise it only dispatches the "vs-login" event.
  // A thrown Error's message is shown as the error message.
  // See README.md for every option, event, slot and part.
  let counter = 0;

  class VsLoginForm extends Viraspa.core.Component {
    static tag = "vs-login-form";
    static folder = "components/vs-login-form";
    static isolation = "scoped";

    constructor() {
      super();
      this.uid = `vs-login-${++counter}`;
      this.providers = this.providers || [];
    }

    prepareModel(model) {
      const escapeHtml = Viraspa.utility.dom.escapeHtml;
      const on = (name) => model[name] !== undefined && model[name] !== false && model[name] !== "false";
      model.uid = this.uid;
      model.usernameType = model.usernameType === "text" ? "text" : "email";
      model.usernameInputMode = model.usernameType === "email" ? "email" : "text";
      model.messagePosition = ["top", "bottom", "toast"].includes(model.messagePosition) ? model.messagePosition : "top";
      model.rememberMeHtml = on("rememberMe")
        ? `<label class="remember"><input type="checkbox" name="rememberMe"> ${escapeHtml(model.rememberMeLabel)}</label>`
        : "";
      model.forgotHtml = model.forgotPasswordHref
        ? `<a class="forgot" href="${escapeHtml(model.forgotPasswordHref)}" part="forgot">${escapeHtml(model.forgotPasswordLabel)}</a>`
        : "";
      model.providersHtml = this.providers.length
        ? `<div class="providers" part="providers"><p class="providers-label">${escapeHtml(model.providersLabel)}</p>` +
          this.providers
            .map((p, index) => {
              const icon = p.icon ? (typeof p.icon === "object" ? JSON.stringify(p.icon) : p.icon) : "";
              return `<button type="button" class="provider" data-index="${index}" part="provider">${
                icon ? `<vs-icon icon="${escapeHtml(icon)}"></vs-icon>` : ""
              }<span>${escapeHtml(p.label)}</span></button>`;
            })
            .join("") +
          "</div>"
        : "";
      return model;
    }

    async afterLoad() {
      this.form = this.querySelector("form");
      this.form.addEventListener("submit", (event) => this.onSubmit(event));
      this.addEventListener("click", (event) => {
        const button = event.target.closest(".provider");
        if (button) this.onProvider(this.providers[Number(button.dataset.index)]);
      });
    }

    // Shows a message in the configured place. type: "error" | "success" | "info"
    showMessage(text, type = "error") {
      const position = this.form.dataset.messagePosition;
      if (position === "toast") {
        Viraspa.toast.show(text, { type });
        return;
      }
      const box = this.querySelector(`.message-${position}`);
      box.textContent = text;
      box.className = `message message-${position} ${type}`;
      box.hidden = !text;
    }

    clearMessage() {
      for (const box of this.querySelectorAll(".message")) {
        box.textContent = "";
        box.hidden = true;
      }
    }

    setBusy(busy) {
      const button = this.querySelector(".submit");
      button.disabled = busy;
      button.textContent = busy ? this.form.dataset.busyLabel : this.form.dataset.submitLabel;
      this.form.setAttribute("aria-busy", String(busy));
    }

    async onSubmit(event) {
      event.preventDefault();
      this.clearMessage();
      const data = new FormData(this.form);
      const credentials = {
        username: String(data.get("username") || "").trim(),
        password: String(data.get("password") || ""),
        rememberMe: data.get("rememberMe") === "on",
      };
      if (!credentials.username || !credentials.password) {
        this.showMessage(this.form.dataset.requiredMessage, "error");
        (credentials.username ? this.form.elements.password : this.form.elements.username).focus();
        return;
      }

      const proceed = this.dispatchEvent(new CustomEvent("vs-login", { detail: { credentials }, bubbles: true, cancelable: true }));
      if (!proceed) return; // a listener took over

      const handler =
        (typeof this.loginHandler === "function" && this.loginHandler) ||
        (Viraspa.session && typeof Viraspa.session.login === "function" && ((c) => Viraspa.session.login(c)));
      if (!handler) {
        console.warn("<vs-login-form>: no loginHandler and no Viraspa.session.login - listen for the vs-login event instead.");
        return;
      }

      this.setBusy(true);
      try {
        const result = await handler(credentials);
        this.form.elements.password.value = "";
        this.dispatchEvent(new CustomEvent("vs-login-success", { detail: { result }, bubbles: true }));
      } catch (err) {
        this.showMessage((err && err.message) || this.form.dataset.failedMessage, "error");
        this.form.elements.password.select();
      } finally {
        this.setBusy(false);
      }
    }

    async onProvider(provider) {
      if (!provider) return;
      this.clearMessage();
      const proceed = this.dispatchEvent(new CustomEvent("vs-login-provider", { detail: { provider }, bubbles: true, cancelable: true }));
      if (!proceed) return;
      const handler =
        (typeof this.providerHandler === "function" && this.providerHandler) ||
        (Viraspa.session && typeof Viraspa.session.loginWith === "function" && ((p) => Viraspa.session.loginWith(p.id)));
      if (!handler) return;
      try {
        await handler(provider);
      } catch (err) {
        this.showMessage((err && err.message) || this.form.dataset.failedMessage, "error");
      }
    }
  }

  Viraspa.core.defineComponent(VsLoginForm);
})(window.Viraspa);
