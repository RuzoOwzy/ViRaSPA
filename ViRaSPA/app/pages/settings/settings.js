(function (Viraspa) {
  // Settings: a form that is read-only without the settings.edit privilege
  // (data-privilege-denied="readonly" in the HTML). Values are kept in this
  // browser only - it's a sample.
  const STORAGE_KEY = "viraspa-sample:settings";
  const DEFAULTS = { company: "Viramol Solutions", currency: "TZS", notifications: true };

  function load() {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {
      return { ...DEFAULTS };
    }
  }

  class SettingsPage extends Viraspa.core.Page {
    async onLoad() {
      await super.onLoad();
      const form = this.container.querySelector(".settings-form");
      const values = load();
      form.elements.company.value = values.company;
      form.elements.currency.value = values.currency;
      form.elements.notifications.checked = values.notifications;
      this.container.querySelector(".readonly-note").hidden = Viraspa.session.hasPrivilege("settings.edit");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = {
          company: form.elements.company.value.trim(),
          currency: form.elements.currency.value,
          notifications: form.elements.notifications.checked,
        };
        await Viraspa.busy.run(() => new Promise((resolve) => setTimeout(resolve, 600)), { target: form, message: "Saving..." });
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch {
          // storage blocked
        }
        Viraspa.toast.show("Settings saved.", { type: "success" });
      });
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages.settings = SettingsPage;
})(window.Viraspa);
