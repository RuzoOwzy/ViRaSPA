# app/services

The app's business logic and server calls, shared by pages and components. Pages stay thin: they call a service and show the result.

```js
// app/services/customers.js
(function (Viraspa) {
  const { call } = Viraspa.services.communication;
  Viraspa.app.services.customers = {
    list: (query, { signal } = {}) => call(Viraspa.endpoints.customers.list, { query, signal }),
    get: (id, { signal } = {}) => call(Viraspa.endpoints.customers.get, { params: { id }, signal }),
  };
})(window.Viraspa);
```

In a page: `const customer = await Viraspa.app.services.customers.get(this.params.id, { signal: this.signal });`

List each file in `app/config/startup.js`.