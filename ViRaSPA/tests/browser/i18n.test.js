(function () {
  const { test, assert, render } = Viraspa.testing;

  test("t() uses plural forms", () => {
    assert.equal(Viraspa.i18n.t("{count} item", { count: 1 }), "1 item");
    assert.equal(Viraspa.i18n.t("{count} item", { count: 3 }), "3 items");
  });

  test("setLocale translates t(), data-i18n and lang", async () => {
    const { element } = render('<p class="a">{{ t("Sign In") }}</p><p class="b" data-i18n>Sign Out</p>');
    Viraspa.i18n.translate(element);
    await Viraspa.i18n.setLocale("sw", { remember: false });
    assert.equal(element.querySelector(".a").textContent, "Ingia");
    assert.equal(element.querySelector(".b").textContent, "Toka");
    assert.equal(document.documentElement.lang, "sw");
  });

  test("untranslated text falls back to the key", async () => {
    await Viraspa.i18n.setLocale("sw", { remember: false });
    assert.equal(Viraspa.i18n.t("Not in any dictionary"), "Not in any dictionary");
  });

  test("named formats follow the language", async () => {
    const d = new Date(2026, 10, 7);
    assert.equal(Viraspa.format.date(d, "invoiceDate"), "07-Nov-2026");
    // Intl puts a non-breaking space between the code and the amount.
    assert.equal(Viraspa.format.currency(1250000).replace(/\s/g, " "), "TZS 1,250,000");
    await Viraspa.i18n.setLocale("sw", { remember: false });
    assert.match(Viraspa.format.date(d, "long"), /Novemba/);
  });

  test("right-to-left languages get dir=rtl", () => {
    assert.equal(Viraspa.i18n.direction("ar"), "rtl");
    assert.equal(Viraspa.i18n.direction("en"), "ltr");
  });
})();
