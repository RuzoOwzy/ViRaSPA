(function (Viraspa) {
  // Project setting: the backend endpoints pages call, defined once and
  // shared. A page calls one by name, e.g.
  //   Viraspa.services.communication.call(Viraspa.endpoints.users.get, { params: { id: 7 } });
  // `baseUrl` is the development default. An installation pointing at a
  // different backend can replace it at startup from config/init.js with
  // Viraspa.endpoints.setBaseUrl(...).
  Viraspa.endpoints = Viraspa.services.communication.defineEndpoints({
    baseUrl: "https://jsonplaceholder.typicode.com",

    users: {
      list: { method: "GET", path: "/users" },
      get: { method: "GET", path: "/users/{id}" },
    },
    posts: {
      create: { method: "POST", path: "/posts" },
    },
  });
})(window.Viraspa);
