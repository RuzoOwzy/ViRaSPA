(function (Viraspa) {
  // Users: a table loaded under a busy indicator, with buttons that follow
  // the user's privileges (data-privilege-required in the HTML).
  class UsersPage extends Viraspa.core.Page {
    async onLoad() {
      await super.onLoad();
      this.container.querySelector(".add-user").addEventListener("click", () =>
        Viraspa.toast.show("Demo: adding users isn't implemented.", { type: "info" })
      );
      this.container.querySelector("tbody").addEventListener("click", (event) => {
        const button = event.target.closest("button[data-user]");
        if (button) Viraspa.toast.show(`Demo: editing ${button.dataset.user} isn't implemented.`, { type: "info" });
      });
      await this.loadUsers();
    }

    async loadUsers() {
      const body = this.container.querySelector("tbody");
      const escapeHtml = Viraspa.utility.dom.escapeHtml;
      try {
        const users = await Viraspa.busy.run(
          ({ signal }) => Viraspa.services.communication.call(Viraspa.endpoints.users.list, { signal }),
          { target: this.container.querySelector(".table-wrap"), message: "Loading users...", signal: this.signal }
        );
        body.innerHTML = users
          .map(
            (u) => `<tr>
              <td>${escapeHtml(u.name)}</td>
              <td>${escapeHtml(u.email)}</td>
              <td>${escapeHtml(u.company ? u.company.name : "")}</td>
              <td><button type="button" class="btn btn-secondary btn-small" data-user="${escapeHtml(u.name)}"
                    data-privilege-required="users.edit" data-privilege-denied="disable">Edit</button></td>
            </tr>`
          )
          .join("");
        // Rows were added after rendering: apply the privilege attributes to them.
        Viraspa.session.applyPrivileges(body);
      } catch (err) {
        if (err.name === "AbortError") return;
        body.innerHTML = '<tr><td colspan="4">Could not load users (check your connection).</td></tr>';
      }
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages.users = UsersPage;
})(window.Viraspa);
