# app/state

Shared state (signals) that several pages or components read, e.g. the shopping cart:

```js
// app/state/cart.js
(function (Viraspa) {
  const { signal, computed } = Viraspa.state;
  const items = signal([]);
  Viraspa.app.state.cart = {
    items,
    total: computed(() => items.value.reduce((sum, item) => sum + item.price, 0)),
    add: (item) => (items.value = [...items.value, item]),
  };
})(window.Viraspa);
```

Templates that read `cart.total` update by themselves. List each file in `app/config/startup.js`.