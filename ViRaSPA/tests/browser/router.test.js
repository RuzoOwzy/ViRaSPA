(function () {
  const { test, assert } = Viraspa.testing;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  test("navigate shows a page and updates head information", async () => {
    Viraspa.core.navigate("/about");
    await wait(1200);
    assert.equal(location.pathname, "/about");
    assert.match(document.title, /About/);
    assert.ok(document.querySelector('meta[property="og:title"]'));
  });

  test("private routes redirect to the login page when signed out", async () => {
    Viraspa.core.navigate("/dashboard");
    await wait(1200);
    assert.equal(location.pathname, "/login");
    assert.match(location.search, /returnTo=%2Fdashboard/);
  });

  test("unknown paths show the not-found page", async () => {
    Viraspa.core.navigate("/no-such-page-at-all");
    await wait(1000);
    assert.match(document.title, /Not Found/);
  });

  test("Viraspa.core is frozen", () => {
    assert.ok(Object.isFrozen(Viraspa.core));
  });
})();
