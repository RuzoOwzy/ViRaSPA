(function (Viraspa) {
  // The backend endpoints pages call, defined once and shared:
  //   await Viraspa.services.communication.call(Viraspa.endpoints.users.get, { params: { id: 7 }, signal: this.signal });
  Viraspa.endpoints = Viraspa.services.communication.defineEndpoints({
    baseUrl: "https://api.example.com",
    // users: {
    //   list: { method: "GET", path: "/users" },
    //   get: { method: "GET", path: "/users/{id}" },
    // },
  });
})(window.Viraspa);
