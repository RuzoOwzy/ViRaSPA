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

  test("route parameters: matching, static routes first, letter case kept", () => {
    const { match, build, hasParams } = Viraspa.routePaths;
    const routes = [{ path: "/customers/:id", name: "customer" }, { path: "/customers/new", name: "new-customer" }, { path: "/a/:x/b/:y", name: "two" }];
    assert.equal(match(routes, "/customers/AbC%20d").route.name, "customer");
    assert.equal(match(routes, "/customers/AbC%20d").params.id, "AbC d");
    assert.equal(match(routes, "/Customers/New/").route.name, "new-customer");
    assert.deepEqual(match(routes, "/a/1/b/2").params, { x: "1", y: "2" });
    assert.equal(match(routes, "/customers"), null);
    assert.equal(match(routes, "/customers/1/2"), null);
    assert.equal(build("/customers/:id", { id: "a b" }), "/customers/a%20b");
    assert.ok(hasParams("/customers/:id") && !hasParams("/about"));
  });

  test("a route with a parameter gives the page this.params and fills the head", async () => {
    Viraspa.testing.mockEndpoint(Viraspa.endpoints.users.get, { id: 3, name: "Clementine Bauch", email: "c@example.com", phone: "1", company: { name: "Romaguera" } });
    Viraspa.core.navigate("/People/3/");
    await wait(1500);
    assert.equal(location.pathname, "/people/3");
    const page = document.querySelector('.vs-page[data-page="person"]:not([hidden])');
    assert.ok(page, "the person page is shown");
    assert.equal(page.querySelector("h1").textContent, "Clementine Bauch");
    assert.equal(document.title, "Clementine Bauch · ViRaSPA Sample");
  });

  test("Viraspa.core is frozen", () => {
    assert.ok(Object.isFrozen(Viraspa.core));
  });
})();
