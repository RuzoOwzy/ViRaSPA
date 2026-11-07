// Node tests for the framework's logic that needs no browser:
// signals, expressions, formats, translations and manifest rules.
// Run: node node-tools/test.js   (or: node --test tests/node)
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const SITE = path.join(__dirname, "..", "..", "ViRaSPA", "viraspa", "core");

// The framework files expect window.Viraspa; give them a minimal one.
globalThis.window = globalThis;
globalThis.Viraspa = {};
require(path.join(SITE, "state.js"));
const expressions = require(path.join(SITE, "expressions.js"));
const format = require(path.join(SITE, "format.js"));
globalThis.Viraspa.format = format;
const i18n = require(path.join(SITE, "i18n.js"));
globalThis.Viraspa.i18n = i18n;
const rules = require(path.join(SITE, "manifest-rules.js"));
const { signal, computed, effect, batch, createScope } = globalThis.Viraspa.state;

const ctx = (scope) => ({ scopes: [scope], unwrap: globalThis.Viraspa.state.unwrap, pipe: format.pipe });
const run = (text, scope = {}) => expressions.compile(text)(ctx(scope));

// ---- signals --------------------------------------------------------------
test("signals: effects re-run when what they read changes", () => {
  const a = signal(1);
  const seen = [];
  const stop = effect(() => seen.push(a.value));
  a.value = 2;
  a.value = 2; // same value: no re-run
  stop();
  a.value = 3;
  assert.deepEqual(seen, [1, 2]);
});

test("signals: computed values are lazy and cached", () => {
  const a = signal(2);
  let runs = 0;
  const double = computed(() => {
    runs++;
    return a.value * 2;
  });
  assert.equal(runs, 0);
  assert.equal(double.value, 4);
  assert.equal(double.value, 4);
  assert.equal(runs, 1);
  a.value = 5;
  assert.equal(double.value, 10);
  assert.equal(runs, 2);
});

test("signals: batch updates once", () => {
  const a = signal(0);
  const b = signal(0);
  let runs = 0;
  effect(() => {
    a.value + b.value;
    runs++;
  });
  batch(() => {
    a.value = 1;
    b.value = 2;
  });
  assert.equal(runs, 2);
});

test("signals: a scope disposes all its effects", () => {
  const a = signal(0);
  const scope = createScope();
  let runs = 0;
  scope.effect(() => {
    a.value;
    runs++;
  });
  scope.dispose();
  a.value = 1;
  assert.equal(runs, 1);
});

test("signals: effect cleanup runs before the next run", () => {
  const a = signal(0);
  const log = [];
  effect(() => {
    const v = a.value;
    log.push(`run ${v}`);
    return () => log.push(`clean ${v}`);
  });
  a.value = 1;
  assert.deepEqual(log, ["run 0", "clean 0", "run 1"]);
});

// ---- expressions ----------------------------------------------------------
test("expressions: values, operators and members", () => {
  assert.equal(run("1 + 2 * 3"), 7);
  assert.equal(run("a > 1 && b === 'x'", { a: 2, b: "x" }), true);
  assert.equal(run("user.name", { user: { name: "Amina" } }), "Amina");
  assert.equal(run("items[1]", { items: ["a", "b"] }), "b");
  assert.equal(run("x ?? 'none'", { x: null }), "none");
  assert.equal(run("ok ? 'yes' : 'no'", { ok: false }), "no");
  assert.deepEqual(run("{ n: count, list: [1, 2] }", { count: 3 }), { n: 3, list: [1, 2] });
});

test("expressions: signals are read automatically", () => {
  assert.equal(run("count > 0", { count: signal(2) }), true);
});

test("expressions: calls keep `this`", () => {
  const owner = { factor: 3, times(n) { return n * this.factor; } };
  assert.equal(run("times(2)", owner), 6);
});

test("expressions: pipes", () => {
  format.configure({ locale: "en-US" });
  assert.equal(run("1234.5 | number"), "1,234.5");
  assert.equal(run("name | upper", { name: "abc" }), "ABC");
  format.configure({ locale: null });
});

test("expressions: prototypes and constructors are blocked", () => {
  assert.throws(() => run("a.constructor", { a: {} }), /can't be used/);
  assert.throws(() => run("a.__proto__", { a: {} }), /can't be used/);
  assert.equal(run("window"), undefined); // only the given scopes are visible
});

test("expressions: splitTemplate handles braces, strings and escapes", () => {
  const parts = expressions.splitTemplate('a {{ t("x", { n: 1 }) }} \\{{ b {{{ raw }}}');
  assert.deepEqual(parts, [
    { text: "a " },
    { expr: 't("x", { n: 1 })', raw: false },
    { text: " {{ b " },
    { expr: "raw", raw: true },
  ]);
});

// ---- formats --------------------------------------------------------------
test("formats: patterns, presets and currencies", () => {
  format.configure({
    locale: "en-US",
    dateFormats: [{ name: "invoiceDate", pattern: "dd-MMM-yyyy" }],
    currencies: [{ code: "TZS", decimalPlaces: 0, display: "code" }],
    defaults: { currency: "TZS" },
  });
  const d = new Date(2026, 10, 7, 14, 5);
  assert.equal(format.date(d, "invoiceDate"), "07-Nov-2026");
  assert.equal(format.date(d, "yyyy/MM/dd HH:mm"), "2026/11/07 14:05");
  assert.equal(format.date("2026-11-07", "dd/MM/yyyy"), "07/11/2026"); // date-only strings are local
  assert.equal(format.currency(1250000).replace(/\s/g, " "), "TZS 1,250,000");
  assert.equal(format.number(3.14159, { maxDecimalPlaces: 2 }), "3.14");
  assert.equal(format.percent(0.257, 1), "25.7%");
  assert.equal(format.relative(Date.now() - 3 * 86400000), "3 days ago");
  format.configure({ locale: null });
});

test("formats: the user's preference beats the app default, a call beats both", () => {
  format.configure({ locale: "en-US", currencies: [{ code: "USD", decimalPlaces: 2 }], defaults: { currency: "TZS" } });
  format.setPreferences({ currency: "USD" });
  assert.match(format.currency(5), /\$5\.00/);
  assert.match(format.currency(5, "TZS"), /TZS/);
  format.setPreferences(null);
  format.configure({ locale: null });
});

// ---- translations ---------------------------------------------------------
test("i18n: natural keys, interpolation and plurals", () => {
  i18n.addTranslations("en", { "{count} file": { one: "{count} file", other: "{count} files" } });
  assert.equal(i18n.t("Hello {name}", { name: "Amina" }), "Hello Amina");
  assert.equal(i18n.t("{count} file", { count: 1 }), "1 file");
  assert.equal(i18n.t("{count} file", { count: 4 }), "4 files");
  assert.equal(i18n.direction("ar"), "rtl");
  assert.equal(i18n.direction("sw"), "ltr");
});

// ---- manifest rules -------------------------------------------------------
test("manifest rules: framework version precedence", () => {
  assert.equal(rules.checkFrameworkVersion({ min: "0.2.0" }, "0.3.1").ok, true);
  assert.equal(rules.checkFrameworkVersion({ max: "0.1.9" }, "0.2.0").ok, false);
  assert.equal(rules.checkFrameworkVersion({ min: "0.1.0", excluded: ["0.2.0"] }, "0.2.0").ok, false);
  assert.equal(rules.checkFrameworkVersion({ supported: ["0.2.0"] }, "0.2.1").ok, false);
  assert.equal(rules.checkFrameworkVersion({ max: "0.1.0", supported: ["0.2.0"] }, "0.2.0").ok, true);
  assert.ok(rules.checkFrameworkVersion(undefined, "0.2.0").warning);
});

test("manifest rules: reserved prefixes and --vs- definitions", () => {
  const base = { name: "x", version: "1.0.0", releaseDate: "2026-11-07", components: [] };
  assert.match(rules.validateManifest("extension", { ...base, tagPrefix: "vs" }).errors.join(), /reserved/);
  assert.equal(rules.validateManifest("extension", { ...base, tagPrefix: "owzy" }).errors.length, 0);
  assert.equal(rules.definesReservedCssVariable(":host{--vs-color-primary:red}"), true);
  assert.equal(rules.definesReservedCssVariable("a{color:var(--vs-color-primary)}"), false);
  assert.match(rules.reservedCssProblem(".vs-page{display:none}"), /class names/);
  assert.equal(rules.reservedCssProblem(".owzy-box .title{color:red} a.myvs-x{}"), "");
});

test("manifest rules: isolation values", () => {
  const base = { name: "x", version: "1.0.0", releaseDate: "2026-11-07", tagPrefix: "owzy" };
  const ok = rules.validateManifest("extension", { ...base, components: [{ tag: "owzy-a", script: "a.js", isolation: "scoped", allowedIsolation: ["full", "scoped"] }] });
  assert.equal(ok.errors.length, 0);
  const bad = rules.validateManifest("extension", { ...base, components: [{ tag: "owzy-a", script: "a.js", allowedIsolation: ["shadow"] }] });
  assert.match(bad.errors.join(), /allowedIsolation/);
});
