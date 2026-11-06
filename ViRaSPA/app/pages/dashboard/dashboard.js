(function (Viraspa) {
  // Dashboard: official <vs-stat-tile> components and a Chart.js chart.
  // Chart.js (self-hosted in lib/chartjs/4.6.1/) is loaded only when this
  // page is opened, under a busy indicator.
  const CHART_JS = "lib/chartjs/4.6.1/chart.umd.min.js";

  class DashboardPage extends Viraspa.core.Page {
    async onLoad() {
      const { template, model } = await Viraspa.core.pageLoader.fetchPage(this.basePath);
      model.userName = (Viraspa.session.user() || {}).name || "";
      this.model = model;
      this.renderTemplate(template, model);
      await this.display();
      await this.drawChart();
    }

    async drawChart() {
      const box = this.container.querySelector(".chart-box");
      try {
        await Viraspa.busy.run(() => Viraspa.utility.assetLoader.loadScript(CHART_JS), {
          target: box,
          message: "Loading chart...",
          signal: this.signal,
        });
      } catch (err) {
        box.textContent = "The chart could not be loaded (run: node node-tools/install.js restore).";
        return;
      }
      if (this.signal.aborted || !window.Chart) return;

      const css = getComputedStyle(document.documentElement);
      const primary = css.getPropertyValue("--vs-color-primary").trim() || "#1a9c6b";
      const muted = css.getPropertyValue("--vs-color-text-muted").trim() || "#58685f";
      this.chart = new window.Chart(this.container.querySelector("#sales-chart"), {
        type: "line",
        data: {
          labels: this.model.months,
          datasets: [
            { label: "Sales", data: this.model.sales, borderColor: primary, backgroundColor: `${primary}33`, fill: true, tension: 0.3 },
            { label: "Target", data: this.model.target, borderColor: muted, borderDash: [6, 4], pointRadius: 0 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
      });
      // Free the chart when the page is removed.
      this.container.addEventListener("viraspa:pageRemoved", () => this.chart && this.chart.destroy(), { once: true });
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages.dashboard = DashboardPage;
})(window.Viraspa);
