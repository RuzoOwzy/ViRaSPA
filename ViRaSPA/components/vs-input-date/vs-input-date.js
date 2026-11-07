(function (Viraspa) {
  // A date field: type the date in the user's own format, or pick it from a
  // calendar.
  //
  //   <vs-input-date name="due" min="2026-01-01" required></vs-input-date>
  //   <vs-input-date name="month" type="month"></vs-input-date>
  //   <vs-input-date name="meeting" type="datetime"></vs-input-date>
  //   el.isDateDisabled = (iso) => new Date(iso).getDay() === 0;   // no Sundays
  //
  // - value: an ISO string - "2026-11-08", "2026-11" (month) or
  //   "2026-11-08T14:30" (datetime); "" when empty. The field shows it in the
  //   language's order (08/11/2026, 11/8/2026, 2026-11-08) and accepts any
  //   separator; two-digit years mean 20xx.
  // - Calendar: the button, or Alt+Down. Arrows move by day (Up/Down by week),
  //   Page Up/Down by month (with Shift: by year), Home/End to the week's
  //   start/end, Enter chooses, Escape closes. The title switches to the month
  //   and year views. "Today" and "Clear" buttons. The week starts on the
  //   language's first day.
  // - min, max, isDateDisabled; works in forms (name, required, disabled,
  //   readonly, reset). Events: input, change. Keys overridable: keys = { open }.
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromIso = (s) => {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s || "");
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3] || 1)) : null;
  };
  const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  class VsInputDate extends Viraspa.core.Component {
    static tag = "vs-input-date";
    static folder = "components/vs-input-date";
    static isolation = "full";
    static hasModel = false;
    static formAssociated = true;
    static delegatesFocus = true;
    static observedAttributes = ["value", "type", "min", "max", "disabled", "readonly", "required", "placeholder"];

    constructor() {
      super();
      this._value = "";
    }

    get type() {
      return ["date", "month", "datetime"].includes(this.getAttribute("type")) ? this.getAttribute("type") : "date";
    }
    locale() {
      return Viraspa.i18n ? Viraspa.i18n.locale.peek() : undefined;
    }

    // The order of day, month and year in this language: e.g. ["day","month","year"].
    order() {
      const parts = new Intl.DateTimeFormat(this.locale(), { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(2026, 10, 8));
      return parts.filter((p) => ["day", "month", "year"].includes(p.type)).map((p) => p.type);
    }
    weekStart() {
      try {
        const info = new Intl.Locale(this.locale() || navigator.language).getWeekInfo?.() || new Intl.Locale(this.locale() || navigator.language).weekInfo;
        if (info && info.firstDay) return info.firstDay % 7; // 7 = Sunday
      } catch {
        // older browsers: guess below
      }
      return /^en-US|^en$/i.test(this.locale() || navigator.language) ? 0 : 1;
    }

    get value() {
      return this._value;
    }
    set value(v) {
      this._value = this.normalize(v);
      this.update();
    }
    get valueAsDate() {
      return fromIso(this._value);
    }

    normalize(v) {
      if (!v) return "";
      const s = String(v);
      if (this.type === "month") return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : "";
      if (this.type === "datetime") return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? s.slice(0, 16) : /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00` : "";
      return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
    }

    // "08/11/2026" (the language's order) for the date part.
    format(v) {
      const d = fromIso(v);
      if (!d) return "";
      if (this.type === "month") {
        const o = this.order().filter((x) => x !== "day");
        return o.map((x) => (x === "year" ? d.getFullYear() : pad(d.getMonth() + 1))).join("/");
      }
      const sep = (new Intl.DateTimeFormat(this.locale()).formatToParts(new Date(2026, 10, 8)).find((p) => p.type === "literal") || { value: "/" }).value.trim() || "/";
      return this.order().map((x) => (x === "year" ? d.getFullYear() : x === "month" ? pad(d.getMonth() + 1) : pad(d.getDate()))).join(sep);
    }

    // Typed text -> ISO date ("" if empty, null if invalid).
    parse(text) {
      const nums = String(text).trim().split(/\D+/).filter(Boolean).map(Number);
      if (!nums.length) return "";
      let order = this.order();
      if (this.type === "month") order = order.filter((x) => x !== "day");
      // A first number with 4 digits means year first (ISO), whatever the language.
      if (String(text).trim().match(/^\d{4}/)) order = this.type === "month" ? ["year", "month"] : ["year", "month", "day"];
      if (nums.length < order.length) return null;
      const p = {};
      order.forEach((name, i) => (p[name] = nums[i]));
      if (p.year < 100) p.year += 2000;
      const day = this.type === "month" ? 1 : p.day;
      const d = new Date(p.year, p.month - 1, day);
      if (d.getFullYear() !== p.year || d.getMonth() !== p.month - 1 || d.getDate() !== day) return null;
      return this.type === "month" ? iso(d).slice(0, 7) : iso(d);
    }

    async afterLoad() {
      const root = this.componentRoot;
      this.input = root.querySelector(".date");
      this.time = root.querySelector(".time");
      this.button = root.querySelector(".open");
      this.panel = root.querySelector(".panel");
      this.panel.setAttribute("popover", "auto");
      this.button.setAttribute("aria-label", t("Choose a date"));
      this.panel.setAttribute("aria-label", t("Calendar"));
      this.time.setAttribute("aria-label", t("Time"));
      if (this.hasAttribute("value")) this._value = this.normalize(this.getAttribute("value"));
      this._initial = this._value;

      this.listen(this.input, "input", () => this.fromTyping(false));
      this.listen(this.input, "change", () => this.fromTyping(true));
      this.listen(this.input, "blur", () => this.fromTyping(true));
      this.listen(this.input, "keydown", (e) => this.onFieldKey(e));
      this.listen(this.time, "change", () => this.setDate(this._value ? this._value.slice(0, 10) : iso(new Date()), true));
      this.listen(this.button, "click", () => (this.isOpen ? this.close() : this.open()));
      this.listen(this.panel, "keydown", (e) => this.onCalendarKey(e));
      this.listen(this.panel, "click", (e) => this.onCalendarClick(e));
      this.listen(this.panel, "toggle", (e) => {
        if (e.newState === "closed") {
          this.button.setAttribute("aria-expanded", "false");
          if (this._stop) this._stop();
        }
      });
      this.update();
    }

    attributeChangedCallback(name) {
      if (!this.input) return;
      if (name === "value") this._value = this.normalize(this.getAttribute("value"));
      this.update();
    }

    get disabled() {
      return this.hasAttribute("disabled") || this.hasAttribute("data-form-disabled");
    }
    get isOpen() {
      return Boolean(this.panel && this.panel.matches(":popover-open"));
    }

    update() {
      const i = this.input;
      if (this.componentRoot.activeElement !== i) i.value = this.format(this._value);
      this.time.hidden = this.type !== "datetime";
      if (this.type === "datetime") this.time.value = this._value ? this._value.slice(11, 16) : "";
      i.placeholder = this.getAttribute("placeholder") || this.order().filter((x) => this.type !== "month" || x !== "day").map((x) => t({ day: "dd", month: "mm", year: "yyyy" }[x])).join("/");
      i.disabled = this.time.disabled = this.button.disabled = this.disabled;
      i.readOnly = this.hasAttribute("readonly");
      this.button.disabled = this.disabled || this.hasAttribute("readonly");
      const label = this.labelText();
      if (label) i.setAttribute("aria-label", label);
      this.setFormValue(this._value);
      this.validate();
    }

    validate() {
      const typed = this.input.value.trim();
      const parsed = typed ? this.parse(typed) : "";
      const day = this._value.slice(0, this.type === "month" ? 7 : 10);
      if (typed && parsed === null) return this.setValidity({ badInput: true }, t("Enter a valid date."), this.input);
      if (!this._value && this.hasAttribute("required")) return this.setValidity({ valueMissing: true }, t("Please fill in this field."), this.input);
      const min = this.getAttribute("min");
      const max = this.getAttribute("max");
      if (day && min && day < min.slice(0, day.length)) return this.setValidity({ rangeUnderflow: true }, t("The date must be on or after {min}.").replace("{min}", this.format(min)), this.input);
      if (day && max && day > max.slice(0, day.length)) return this.setValidity({ rangeOverflow: true }, t("The date must be on or before {max}.").replace("{max}", this.format(max)), this.input);
      if (day && this.type !== "month" && typeof this.isDateDisabled === "function" && this.isDateDisabled(day)) return this.setValidity({ customError: true }, t("This date can't be chosen."), this.input);
      this.setValidity({});
    }

    fromTyping(commit) {
      const parsed = this.parse(this.input.value);
      if (parsed === null) {
        this.validate();
        return;
      }
      this.setDate(parsed, commit, { keepText: !commit });
    }

    // Sets the date part (keeping the time for datetime).
    setDate(day, commit, { keepText = false } = {}) {
      const before = this._value;
      if (!day) this._value = "";
      else if (this.type === "datetime") this._value = `${day.slice(0, 10)}T${this.time.value || "00:00"}`;
      else this._value = this.normalize(day);
      if (!keepText) this.input.value = this.format(this._value);
      this.setFormValue(this._value);
      this.validate();
      if (before !== this._value) {
        this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        if (commit) this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      }
    }

    onFieldKey(event) {
      const action = Viraspa.keyboard.actionFor(event, this.keymap({ open: "alt+arrowdown" }));
      if (action === "open") {
        event.preventDefault();
        this.open();
      } else if (event.key === "Enter") this.fromTyping(true);
    }

    // ---- calendar -------------------------------------------------------------
    open() {
      if (this.disabled || this.hasAttribute("readonly")) return;
      this.fromTyping(true);
      this._view = this.type === "month" ? "months" : "days";
      this._focus = fromIso(this._value) || new Date();
      this.panel.showPopover();
      this.button.setAttribute("aria-expanded", "true");
      this.renderCalendar();
      this._stop = Viraspa.utility.dom.follow(this.panel, this.input.parentElement, { placement: "bottom-start" });
      this.focusCell();
    }

    close() {
      if (this.isOpen) this.panel.hidePopover();
      this.input.focus();
    }

    allowed(day) {
      const min = this.getAttribute("min");
      const max = this.getAttribute("max");
      const key = iso(day);
      if (min && key < min.slice(0, 10)) return false;
      if (max && key > max.slice(0, 10)) return false;
      return !(typeof this.isDateDisabled === "function" && this.isDateDisabled(key));
    }

    renderCalendar() {
      const f = this._focus;
      const loc = this.locale();
      const chosen = fromIso(this._value);
      const today = new Date();
      let title;
      let body;
      if (this._view === "days") {
        title = new Intl.DateTimeFormat(loc, { month: "long", year: "numeric" }).format(f);
        const first = new Date(f.getFullYear(), f.getMonth(), 1);
        const start = this.weekStart();
        const offset = (first.getDay() - start + 7) % 7;
        const names = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(loc, { weekday: "short" }).format(new Date(2026, 10, 1 + ((start + i) % 7))));
        let rows = "";
        for (let w = 0; w < 6; w++) {
          let cells = "";
          for (let d = 0; d < 7; d++) {
            const day = new Date(f.getFullYear(), f.getMonth(), 1 - offset + w * 7 + d);
            const out = day.getMonth() !== f.getMonth();
            const ok = this.allowed(day);
            const label = new Intl.DateTimeFormat(loc, { dateStyle: "full" }).format(day);
            cells += `<td role="gridcell"><button type="button" class="day${out ? " out" : ""}${sameDay(day, today) ? " today" : ""}" data-date="${iso(day)}" tabindex="-1" aria-label="${label}"${sameDay(day, chosen) ? ' aria-selected="true"' : ""}${ok ? "" : " disabled"}>${day.getDate()}</button></td>`;
          }
          rows += `<tr>${cells}</tr>`;
        }
        body = `<table role="grid" class="days"><thead><tr>${names.map((n) => `<th scope="col" abbr="${n}">${n}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
      } else if (this._view === "months") {
        title = String(f.getFullYear());
        body = `<div class="grid3" role="grid">${[...Array(12)]
          .map((_, m) => {
            const sel = chosen && chosen.getFullYear() === f.getFullYear() && chosen.getMonth() === m;
            return `<button type="button" class="cell" data-month="${m}" tabindex="-1"${sel ? ' aria-selected="true"' : ""}>${new Intl.DateTimeFormat(loc, { month: "short" }).format(new Date(2026, m, 1))}</button>`;
          })
          .join("")}</div>`;
      } else {
        const base = f.getFullYear() - (f.getFullYear() % 12);
        title = `${base} – ${base + 11}`;
        body = `<div class="grid3" role="grid">${[...Array(12)]
          .map((_, i) => `<button type="button" class="cell" data-year="${base + i}" tabindex="-1"${chosen && chosen.getFullYear() === base + i ? ' aria-selected="true"' : ""}>${base + i}</button>`)
          .join("")}</div>`;
      }
      this.panel.innerHTML = `
        <div class="head">
          <button type="button" class="nav" data-nav="-1" aria-label="${t("Previous")}">&#8249;</button>
          <button type="button" class="title" data-view aria-live="polite">${title}</button>
          <button type="button" class="nav" data-nav="1" aria-label="${t("Next")}">&#8250;</button>
        </div>
        ${body}
        <div class="foot"><button type="button" data-today>${t("Today")}</button><button type="button" data-clear>${t("Clear")}</button></div>`;
    }

    focusCell() {
      const f = this._focus;
      let target = null;
      if (this._view === "days") target = this.panel.querySelector(`[data-date="${iso(f)}"]`);
      else if (this._view === "months") target = this.panel.querySelector(`[data-month="${f.getMonth()}"]`);
      else target = this.panel.querySelector(`[data-year="${f.getFullYear()}"]`);
      if (target) {
        target.tabIndex = 0;
        target.focus();
      }
    }

    moveFocus(change) {
      const f = new Date(this._focus);
      if (change.days) f.setDate(f.getDate() + change.days);
      if (change.months) {
        const day = f.getDate();
        f.setDate(1);
        f.setMonth(f.getMonth() + change.months);
        f.setDate(Math.min(day, new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate()));
      }
      if (change.years) f.setFullYear(f.getFullYear() + change.years);
      const redraw = f.getMonth() !== this._focus.getMonth() || f.getFullYear() !== this._focus.getFullYear() || this._view !== "days";
      this._focus = f;
      if (redraw) this.renderCalendar();
      this.focusCell();
    }

    pick(day) {
      this.setDate(day, true);
      this.close();
    }

    onCalendarClick(event) {
      const el = event.target.closest("button");
      if (!el || el.disabled) return;
      if (el.dataset.date) this.pick(el.dataset.date);
      else if (el.dataset.month !== undefined) {
        this._focus = new Date(this._focus.getFullYear(), Number(el.dataset.month), 1);
        if (this.type === "month") this.pick(iso(this._focus).slice(0, 7));
        else {
          this._view = "days";
          this.renderCalendar();
          this.focusCell();
        }
      } else if (el.dataset.year !== undefined) {
        this._focus = new Date(Number(el.dataset.year), this._focus.getMonth(), 1);
        this._view = "months";
        this.renderCalendar();
        this.focusCell();
      } else if (el.hasAttribute("data-nav")) {
        const dir = Number(el.dataset.nav);
        if (this._view === "days") this.moveFocus({ months: dir });
        else if (this._view === "months") this.moveFocus({ years: dir });
        else this.moveFocus({ years: dir * 12 });
      } else if (el.hasAttribute("data-view")) {
        this._view = this._view === "days" ? "months" : "years";
        this.renderCalendar();
        this.focusCell();
      } else if (el.hasAttribute("data-today")) {
        const today = new Date();
        this.pick(this.type === "month" ? iso(today).slice(0, 7) : iso(today));
      } else if (el.hasAttribute("data-clear")) this.pick("");
    }

    onCalendarKey(event) {
      const inGrid = event.target.closest && event.target.closest(".day, .cell");
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
        return;
      }
      if (!inGrid) return;
      const day = this._view === "days";
      const steps = day
        ? { ArrowLeft: { days: -1 }, ArrowRight: { days: 1 }, ArrowUp: { days: -7 }, ArrowDown: { days: 7 } }
        : this._view === "months"
        ? { ArrowLeft: { months: -1 }, ArrowRight: { months: 1 }, ArrowUp: { months: -3 }, ArrowDown: { months: 3 } }
        : { ArrowLeft: { years: -1 }, ArrowRight: { years: 1 }, ArrowUp: { years: -3 }, ArrowDown: { years: 3 } };
      if (getComputedStyle(this).direction === "rtl") [steps.ArrowLeft, steps.ArrowRight] = [steps.ArrowRight, steps.ArrowLeft];
      let change = steps[event.key];
      if (event.key === "PageUp") change = event.shiftKey ? { years: -1 } : day ? { months: -1 } : { years: -1 };
      if (event.key === "PageDown") change = event.shiftKey ? { years: 1 } : day ? { months: 1 } : { years: 1 };
      if (day && event.key === "Home") change = { days: -((this._focus.getDay() - this.weekStart() + 7) % 7) };
      if (day && event.key === "End") change = { days: 6 - ((this._focus.getDay() - this.weekStart() + 7) % 7) };
      if (change) {
        event.preventDefault();
        this.moveFocus(change);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        inGrid.click();
      }
    }

    onFormReset() {
      this._value = this._initial;
      this.update();
    }
    onFormDisabled() {
      this.update();
    }
    focus(options) {
      if (this.input) this.input.focus(options);
      else super.focus(options);
    }
  }

  Viraspa.core.defineComponent(VsInputDate);
})(window.Viraspa);
