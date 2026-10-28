(function (Viraspa) {
  class ContactPage extends Viraspa.core.Page {
    async onLoad() {
      await super.onLoad();

      $("#contact-form", this.container).on("submit", (event) => this.onSubmit(event));
    }

    validate(data) {
      const errors = [];
      if (!data.name) errors.push("Name is required.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) errors.push("A valid email is required.");
      if (!data.message) errors.push("Message is required.");
      return errors;
    }

    async onSubmit(event) {
      event.preventDefault();
      const $status = $("#contact-status", this.container);
      const data = {
        name: $("#contact-name", this.container).val().trim(),
        email: $("#contact-email", this.container).val().trim(),
        message: $("#contact-message", this.container).val().trim(),
      };

      Viraspa.core.emit("page:beforeValidation", { page: this, data });
      const errors = this.validate(data);
      Viraspa.core.emit("page:onValidation", { page: this, errors });

      if (errors.length) {
        $status.text(errors.join(" ")).removeClass("is-success").addClass("is-error");
        Viraspa.core.emit("page:afterValidation", { page: this, valid: false });
        return;
      }
      Viraspa.core.emit("page:afterValidation", { page: this, valid: true });

      $status.text("Sending...").removeClass("is-error is-success");

      Viraspa.core.emit("page:beforeRequest", { page: this, data });
      try {
        const result = await Viraspa.services.communication.call(Viraspa.endpoints.posts.create, { body: data });
        Viraspa.core.emit("page:onRequest", { page: this, result });
        $status.text(`Sent! The sample API echoed back id #${result.id}.`).addClass("is-success");
      } catch (err) {
        $status.text("Could not reach the sample API.").addClass("is-error");
      }
      Viraspa.core.emit("page:afterRequest", { page: this });
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages.contact = ContactPage;
})(window.Viraspa);
