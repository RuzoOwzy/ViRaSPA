(function (Viraspa) {
  // A countdown to a moment, or for a number of seconds.
  //
  //   <vs-countdown to="2026-12-31T23:59:59"></vs-countdown>          "54d 03:12:09"
  //   <vs-countdown seconds="90" format="{mm}:{ss}" finished-text="Time is up"></vs-countdown>
  //
  // format placeholders: {d} days, {h} {hh} hours (total hours without {d}),
  // {m} {mm} minutes, {s} {ss} seconds; the default shows days only when
  // there are some. Events: "vs-tick" (detail: { days, hours, minutes,
  // seconds, totalSeconds }) every second, "vs-finished" once.
  // Methods: start(), stop(), reset(). Screen readers hear it only when it
  // finishes (a timer that announces every second would be noise).
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);

  class VsCountdown extends Viraspa.core.Component {
    static tag = "vs-countdown";
    static folder = "components/vs-countdown";
    static isolation = "full";
    static hasModel = false;
    static observedAttributes = ["to", "seconds", "format"];

    async afterLoad() {
      this.text = this.componentRoot.querySelector(".time");
      this.reset();
    }

    attributeChangedCallback() {
      if (this.text) this.reset();
    }

    disconnectedCallback() {
      this.stop();
      super.disconnectedCallback();
    }

    // When it ends (ms since 1970).
    target() {
      if (this.hasAttribute("to")) {
        const at = new Date(this.getAttribute("to")).getTime();
        return Number.isFinite(at) ? at : Date.now();
      }
      return this._startedAt + (Number(this.getAttribute("seconds")) || 0) * 1000;
    }

    reset() {
      this.stop();
      this._startedAt = Date.now();
      this._finished = false;
      this.start();
    }

    start() {
      this.stop();
      this.tick();
      // Aligned to the next whole second, then every second.
      const next = () => {
        this._timer = setTimeout(() => {
          this.tick();
          if (!this._finished) next();
        }, 1000 - (Date.now() % 1000) + 5);
      };
      if (!this._finished) next();
    }

    stop() {
      clearTimeout(this._timer);
    }

    tick() {
      const left = Math.max(0, Math.round((this.target() - Date.now()) / 1000));
      const parts = { days: Math.floor(left / 86400), hours: Math.floor((left % 86400) / 3600), minutes: Math.floor((left % 3600) / 60), seconds: left % 60, totalSeconds: left };
      if (left === 0 && this.hasAttribute("finished-text")) this.text.textContent = t(this.getAttribute("finished-text"));
      else this.text.textContent = this.format(parts);
      this.dispatchEvent(new CustomEvent("vs-tick", { detail: parts, bubbles: true, composed: true }));
      if (left === 0 && !this._finished) {
        this._finished = true;
        this.componentRoot.querySelector(".done").textContent = this.getAttribute("finished-text") ? t(this.getAttribute("finished-text")) : t("Time is up");
        this.dispatchEvent(new CustomEvent("vs-finished", { bubbles: true, composed: true }));
      }
    }

    format({ days, hours, minutes, seconds, totalSeconds }) {
      const pad = (n) => String(n).padStart(2, "0");
      const pattern = this.getAttribute("format") || (days ? "{d}d {hh}:{mm}:{ss}" : totalSeconds >= 3600 ? "{hh}:{mm}:{ss}" : "{mm}:{ss}");
      const usesDays = pattern.includes("{d}");
      const h = usesDays ? hours : hours + days * 24;
      const usesHours = /\{hh?\}/.test(pattern);
      const m = usesHours ? minutes : minutes + h * 60;
      return pattern
        .replace("{d}", days)
        .replace("{hh}", pad(h))
        .replace("{h}", h)
        .replace("{mm}", pad(m))
        .replace("{m}", m)
        .replace("{ss}", pad(seconds))
        .replace("{s}", seconds);
    }
  }

  Viraspa.core.defineComponent(VsCountdown);
})(window.Viraspa);
