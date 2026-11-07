(function () {
  const { test, assert, mockEndpoint, fakeClock } = Viraspa.testing;

  test("login stores the session and privileges", async () => {
    await Viraspa.session.login({ username: "viewer@example.com", password: "viewer" });
    assert.ok(Viraspa.session.isSignedIn());
    assert.ok(Viraspa.session.hasPrivilege("users.view"));
    assert.equal(Viraspa.session.hasPrivilege("users.create"), false);
    assert.ok(localStorage.getItem("viraspa:session"));
  });

  test("a wrong password is refused", async () => {
    await assert.throws(() => Viraspa.session.login({ username: "viewer@example.com", password: "nope" }), /Wrong/);
    assert.equal(Viraspa.session.isSignedIn(), false);
  });

  test("canAccess follows access and requires", async () => {
    const users = Viraspa.routes.find((r) => r.name === "users");
    assert.equal(Viraspa.session.canAccess(users), false);
    await Viraspa.session.login({ username: "viewer@example.com", password: "viewer" });
    assert.ok(Viraspa.session.canAccess(users));
  });

  test("privilege attributes hide and disable", async () => {
    const area = document.getElementById("vs-test-area");
    area.innerHTML = '<button class="a" data-privilege-required="users.create">a</button><button class="b" data-privilege-required="users.edit" data-privilege-denied="disable">b</button>';
    await Viraspa.session.login({ username: "viewer@example.com", password: "viewer" });
    Viraspa.session.applyPrivileges(area);
    assert.equal(area.querySelector(".a").hidden, true);
    assert.equal(area.querySelector(".b").disabled, true);
  });

  test("the session expires at its time (fake clock)", async () => {
    const clock = fakeClock();
    // The demo adapter waits 400 ms (a fake timer now): move time on.
    const signingIn = Viraspa.session.login({ username: "viewer@example.com", password: "viewer" });
    clock.tick(500);
    await signingIn;
    assert.ok(Viraspa.session.isSignedIn());
    // The demo adapter gives 8 hours.
    clock.tick(8 * 60 * 60 * 1000 + 1000);
    assert.equal(Viraspa.session.isSignedIn(), false);
  });

  test("mockEndpoint answers instead of the network", async () => {
    const mock = mockEndpoint(Viraspa.endpoints.users.get, (request) => ({ id: 7, url: request.url }));
    const user = await Viraspa.services.communication.call(Viraspa.endpoints.users.get, { params: { id: 7 } });
    assert.equal(user.id, 7);
    assert.equal(mock.calls.length, 1);
  });
})();
