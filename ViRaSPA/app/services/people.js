(function (Viraspa) {
  // An app service: the server calls for "people", shared by every page that
  // needs them (README "Your own code"). Pages call it and stay thin.
  const { call } = Viraspa.services.communication;
  Viraspa.app.services.people = {
    list: ({ limit = 5 } = {}, { signal } = {}) => call(Viraspa.endpoints.users.list, { query: { _limit: limit }, signal }),
    get: (id, { signal } = {}) => call(Viraspa.endpoints.users.get, { params: { id }, signal }),
  };
})(window.Viraspa);