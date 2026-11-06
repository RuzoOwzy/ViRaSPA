(function (Viraspa) {
  // The sample's session adapter. A real project calls its own backend in
  // login() and returns what it answers; this DEMO checks two built-in
  // users instead, so the private pages can be tried without a server:
  //   admin@example.com  / admin   - every privilege
  //   viewer@example.com / viewer  - can view users and settings, not change them
  const DEMO_USERS = [
    {
      id: 1,
      email: "admin@example.com",
      password: "admin",
      name: "Amina Juma",
      roles: ["admin"],
      privileges: ["users.view", "users.create", "users.edit", "settings.view", "settings.edit"],
    },
    {
      id: 2,
      email: "viewer@example.com",
      password: "viewer",
      name: "Baraka Mushi",
      roles: ["viewer"],
      privileges: ["users.view", "settings.view"],
    },
  ];

  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  Viraspa.session.configure({
    adapter: {
      async login({ username, password }) {
        await pause(400); // a real backend takes a moment too
        const user = DEMO_USERS.find((u) => u.email === username.toLowerCase() && u.password === password);
        if (!user) throw new Error("Wrong email or password.");
        return {
          user: { id: user.id, name: user.name, email: user.email },
          token: `demo-token-${user.id}`,
          privileges: user.privileges,
          roles: user.roles,
          expiresIn: 8 * 60 * 60, // seconds
        };
      },
      async loginWith(providerId) {
        throw new Error(`Signing in with ${providerId} is not set up in this demo.`);
      },
    },
    loginRoute: "/login",
    homeRoute: "/dashboard",
    forbiddenRoute: "/forbidden",
    // The demo API is a public third-party service: don't send it tokens.
    attachToken: false,
  });
})(window.Viraspa);
