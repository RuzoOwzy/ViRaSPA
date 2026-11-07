// Formatting numbers, money, dates and times for the current language,
// built on the browser's Intl. The app names its formats once:
//
//   Viraspa.format.configure({
//     dateFormats: [
//       { name: "short", pattern: "dd/MM/yyyy" },
//       { name: "invoiceDate", pattern: "dd-MMM-yyyy" },   // 07-Nov-2026
//       { name: "long", preset: "long" },                  // 7 November 2026 (language-aware)
//     ],
//     numberFormats: [{ name: "default", minDecimalPlaces: 0, maxDecimalPlaces: 2 }],
//     currencies: [{ code: "TZS", decimalPlaces: 0, display: "symbol" }],
//     defaults: { currency: "TZS", dateFormat: "medium" },
//   });
//
//   format.date(invoice.date, "invoiceDate")    format.currency(1250000)          -> TSh 1,250,000
//   format.number(3.14159)                      format.relative(lastSeen)         -> 3 days ago
// In templates as pipes: {{ invoice.date | date:"invoiceDate" }}  {{ total | currency:"TZS" }}
//
// Who wins: a value given in the call > the user's preference
// (setPreferences) > the app's configure() > the built-in defaults.
// `intlOptions` on any entry is passed to Intl as it is, for rare cases.
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Viraspa.format = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  const PRESETS = ["short", "medium", "long", "full"];
  const PREFERENCES_KEY = "viraspa:formatPreferences";

  const config = {
    dateFormats: [],
    timeFormats: [],
    numberFormats: [{ name: "default", minDecimalPlaces: 0, maxDecimalPlaces: 2 }],
    currencies: [],
    defaults: { currency: "USD", dateFormat: "medium", timeFormat: "short", numberFormat: "default" },
    locale: null, // null: follow Viraspa.i18n
  };
  let preferences = {};
  try {
    preferences = JSON.parse((root.localStorage && root.localStorage.getItem(PREFERENCES_KEY)) || "{}");
  } catch {
    preferences = {};
  }

  // Merges lists by name (or code), so the app adds to or replaces entries.
  function mergeList(current, additions, key = "name") {
    const out = [...current];
    for (const item of additions || []) {
      const i = out.findIndex((x) => x[key] === item[key]);
      if (i >= 0) out[i] = { ...out[i], ...item };
      else out.push({ ...item });
    }
    return out;
  }

  function configure(changes = {}) {
    if (changes.dateFormats) config.dateFormats = mergeList(config.dateFormats, changes.dateFormats);
    if (changes.timeFormats) config.timeFormats = mergeList(config.timeFormats, changes.timeFormats);
    if (changes.numberFormats) config.numberFormats = mergeList(config.numberFormats, changes.numberFormats);
    if (changes.currencies) config.currencies = mergeList(config.currencies, changes.currencies, "code");
    if (changes.defaults) config.defaults = { ...config.defaults, ...changes.defaults };
    if (changes.locale !== undefined) config.locale = changes.locale;
  }

  // The user's own choices (e.g. from a settings page), kept in this browser.
  // { dateFormat, timeFormat, numberFormat, currency }; null clears them.
  function setPreferences(changes) {
    preferences = changes === null ? {} : { ...preferences, ...changes };
    try {
      root.localStorage && root.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // storage blocked
    }
  }

  const getPreferences = () => ({ ...preferences });

  // The language to format for. Reading Viraspa.i18n.locale (a signal) makes
  // template bindings update when the language changes.
  function currentLocale(explicit) {
    if (explicit) return explicit;
    if (config.locale) return config.locale;
    const i18n = root.Viraspa && root.Viraspa.i18n;
    if (i18n && i18n.locale) return i18n.locale.value;
    return (root.navigator && root.navigator.language) || "en";
  }

  const setting = (key, given) => given ?? preferences[key] ?? config.defaults[key];

  // ---- dates ----------------------------------------------------------
  // Accepts a Date, a timestamp or an ISO string. "2026-11-07" (date only)
  // is that day in local time, not UTC midnight.
  function toDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === "number") return new Date(value);
    if (typeof value === "string") {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return new Date(value);
    }
    return new Date(NaN);
  }

  const pad = (n, size = 2) => String(n).padStart(size, "0");

  // dd-MMM-yyyy style patterns. Month and day names come from Intl, so
  // MMM is "Nov" in English and "Nov" or "Novemba" in Swahili.
  // Tokens: yyyy yy MMMM MMM MM M dd d EEEE EEE HH H hh h mm ss a 'text'
  function formatPattern(date, pattern, locale) {
    const name = (options) => new Intl.DateTimeFormat(locale, options).format(date);
    const hours12 = date.getHours() % 12 || 12;
    const tokens = {
      yyyy: () => String(date.getFullYear()),
      yy: () => pad(date.getFullYear() % 100),
      MMMM: () => name({ month: "long" }),
      MMM: () => name({ month: "short" }),
      MM: () => pad(date.getMonth() + 1),
      M: () => String(date.getMonth() + 1),
      dd: () => pad(date.getDate()),
      d: () => String(date.getDate()),
      EEEE: () => name({ weekday: "long" }),
      EEE: () => name({ weekday: "short" }),
      HH: () => pad(date.getHours()),
      H: () => String(date.getHours()),
      hh: () => pad(hours12),
      h: () => String(hours12),
      mm: () => pad(date.getMinutes()),
      ss: () => pad(date.getSeconds()),
      a: () => {
        const part = new Intl.DateTimeFormat(locale, { hour: "numeric", hour12: true }).formatToParts(date).find((p) => p.type === "dayPeriod");
        return part ? part.value : date.getHours() < 12 ? "AM" : "PM";
      },
    };
    const order = Object.keys(tokens).sort((a, b) => b.length - a.length);
    let out = "";
    let i = 0;
    while (i < pattern.length) {
      if (pattern[i] === "'") {
        const end = pattern.indexOf("'", i + 1);
        out += end < 0 ? pattern.slice(i + 1) : pattern.slice(i + 1, end) || "'";
        i = end < 0 ? pattern.length : end + 1;
        continue;
      }
      const token = order.find((t) => pattern.startsWith(t, i));
      if (token) {
        out += tokens[token]();
        i += token.length;
      } else out += pattern[i++];
    }
    return out;
  }

  // nameOrPattern: a named format, a preset (short | medium | long | full)
  // or a pattern ("dd/MM/yyyy").
  function resolveDateFormat(nameOrPattern, list) {
    const named = list.find((f) => f.name === nameOrPattern);
    if (named) return named;
    if (PRESETS.includes(nameOrPattern)) return { preset: nameOrPattern };
    return { pattern: nameOrPattern };
  }

  function date(value, nameOrPattern, { locale } = {}) {
    const d = toDate(value);
    if (isNaN(d)) return "";
    const loc = currentLocale(locale);
    const f = resolveDateFormat(setting("dateFormat", nameOrPattern), config.dateFormats);
    if (f.pattern) return formatPattern(d, f.pattern, loc);
    return new Intl.DateTimeFormat(loc, { dateStyle: f.preset || "medium", ...(f.intlOptions || {}) }).format(d);
  }

  function time(value, nameOrPattern, { locale } = {}) {
    const d = toDate(value);
    if (isNaN(d)) return "";
    const loc = currentLocale(locale);
    const f = resolveDateFormat(setting("timeFormat", nameOrPattern), config.timeFormats);
    if (f.pattern) return formatPattern(d, f.pattern, loc);
    return new Intl.DateTimeFormat(loc, { timeStyle: f.preset || "short", ...(f.intlOptions || {}) }).format(d);
  }

  function dateTime(value, dateName, timeName, options = {}) {
    const d = toDate(value);
    if (isNaN(d)) return "";
    return `${date(d, dateName, options)} ${time(d, timeName, options)}`;
  }

  // "3 days ago", "in 2 hours", "yesterday" - in the current language.
  function relative(value, { now = Date.now(), locale } = {}) {
    const d = toDate(value);
    if (isNaN(d)) return "";
    const seconds = Math.round((d.getTime() - now) / 1000);
    const units = [
      ["year", 31536000],
      ["month", 2592000],
      ["week", 604800],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
      ["second", 1],
    ];
    const [unit, size] = units.find(([, s]) => Math.abs(seconds) >= s) || ["second", 1];
    return new Intl.RelativeTimeFormat(currentLocale(locale), { numeric: "auto" }).format(Math.round(seconds / size), unit);
  }

  // ---- numbers --------------------------------------------------------
  function numberOptions(entry) {
    const o = {};
    if (entry.minDecimalPlaces !== undefined) o.minimumFractionDigits = entry.minDecimalPlaces;
    if (entry.maxDecimalPlaces !== undefined) o.maximumFractionDigits = entry.maxDecimalPlaces;
    if (entry.decimalPlaces !== undefined) o.minimumFractionDigits = o.maximumFractionDigits = entry.decimalPlaces;
    if (entry.useGrouping !== undefined) o.useGrouping = entry.useGrouping;
    if (o.minimumFractionDigits > (o.maximumFractionDigits ?? 20)) o.maximumFractionDigits = o.minimumFractionDigits;
    return { ...o, ...(entry.intlOptions || {}) };
  }

  // nameOrOptions: a named format, or { minDecimalPlaces, maxDecimalPlaces, decimalPlaces }.
  function number(value, nameOrOptions, { locale } = {}) {
    const n = Number(value);
    if (value === null || value === undefined || value === "" || isNaN(n)) return "";
    const entry =
      typeof nameOrOptions === "object" && nameOrOptions
        ? nameOrOptions
        : config.numberFormats.find((f) => f.name === setting("numberFormat", nameOrOptions)) || {};
    return new Intl.NumberFormat(currentLocale(locale), numberOptions(entry)).format(n);
  }

  function percent(value, decimalPlaces = 0, { locale } = {}) {
    const n = Number(value);
    if (isNaN(n)) return "";
    return new Intl.NumberFormat(currentLocale(locale), {
      style: "percent",
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(n);
  }

  // currency(1250000) uses the default currency; currency(9.5, "USD").
  // display: "symbol" (TSh) | "narrowSymbol" | "code" (TZS) | "name" (Tanzanian shillings)
  function currency(value, code, { locale, display, decimalPlaces } = {}) {
    const n = Number(value);
    if (value === null || value === undefined || value === "" || isNaN(n)) return "";
    const currencyCode = setting("currency", code);
    const entry = config.currencies.find((c) => c.code === currencyCode) || {};
    const options = {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: display || entry.display || "symbol",
      ...numberOptions({ ...entry, ...(decimalPlaces !== undefined ? { decimalPlaces } : {}) }),
    };
    return new Intl.NumberFormat(currentLocale(locale), options).format(n);
  }

  // ---- pipes (for templates) ------------------------------------------
  const pipes = {
    number: (v, name) => number(v, name),
    currency: (v, code, display) => currency(v, code, { display }),
    percent: (v, places) => percent(v, places),
    date: (v, name) => date(v, name),
    time: (v, name) => time(v, name),
    datetime: (v, d, t) => dateTime(v, d, t),
    relative: (v) => relative(v),
    upper: (v) => (v == null ? "" : String(v).toLocaleUpperCase(currentLocale())),
    lower: (v) => (v == null ? "" : String(v).toLocaleLowerCase(currentLocale())),
    capitalize: (v) => (v == null ? "" : String(v).charAt(0).toLocaleUpperCase(currentLocale()) + String(v).slice(1)),
    default: (v, fallback) => (v === null || v === undefined || v === "" ? fallback : v),
    join: (v, separator = ", ") => (Array.isArray(v) ? v.join(separator) : v),
    t: (v, params) => (root.Viraspa && root.Viraspa.i18n ? root.Viraspa.i18n.t(v, params) : v),
  };

  function pipe(name) {
    return pipes[name];
  }

  // Viraspa.format.addPipe("initials", (name) => ...) -> {{ user.name | initials }}
  function addPipe(name, fn) {
    if (pipes[name]) throw new Error(`The pipe "${name}" already exists.`);
    if (typeof fn !== "function") throw new Error("A pipe needs a function.");
    pipes[name] = fn;
  }

  const settings = () => JSON.parse(JSON.stringify(config));

  return {
    configure,
    setPreferences,
    getPreferences,
    settings,
    number,
    percent,
    currency,
    date,
    time,
    dateTime,
    relative,
    formatPattern,
    toDate,
    pipe,
    addPipe,
  };
});
