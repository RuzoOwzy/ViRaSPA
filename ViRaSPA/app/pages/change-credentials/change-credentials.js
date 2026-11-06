(function (Viraspa) {
  // Change Credentials: a password-change form with checks. The demo has no
  // server, so nothing is saved; a real project calls its endpoint here.
  class ChangeCredentialsPage extends Viraspa.core.Page {
    async onLoad() {
      const { template, model } = await Viraspa.core.pageLoader.fetchPage(this.basePath);
      model.email = (Viraspa.session.user() || {}).email || "";
      this.renderTemplate(template, model);
      await this.display();
      this.container.querySelector("form").addEventListener("submit", (event) => this.onSubmit(event));
    }

    check({ current, next, confirm }) {
      if (!current || !next || !confirm) return "Fill in all three fields.";
      if (next.length < 8) return "The new password needs at least 8 characters.";
      if (next === current) return "The new password must differ from the current one.";
      if (next !== confirm) return "The new passwords don't match.";
      return "";
    }

    async onSubmit(event) {
      event.preventDefault();
      const form = event.target;
      const message = form.querySelector(".form-message");
      const values = { current: form.elements.current.value, next: form.elements.next.value, confirm: form.elements.confirm.value };
      const problem = this.check(values);
      message.textContent = problem;
      message.hidden = !problem;
      if (problem) return;
      await Viraspa.busy.run(() => new Promise((resolve) => setTimeout(resolve, 700)), { target: form, message: "Saving..." });
      form.reset();
      Viraspa.toast.show("Demo: the password would be changed now (no server in this sample).", { type: "success" });
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages["change-credentials"] = ChangeCredentialsPage;
})(window.Viraspa);
