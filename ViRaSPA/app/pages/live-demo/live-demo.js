(function (Viraspa) {
  // Live Demo: signals and template bindings. The page only changes signals;
  // the bindings in live-demo.html update the screen by themselves.
  const { signal, computed } = Viraspa.state;
  let nextId = 4;

  class LiveDemoPage extends Viraspa.core.Page {
    // Fields on the page are visible to its template ({{ items }}, {{ total }}...).
    items = signal([
      { id: 1, name: "Rice 5 kg", price: 18000 },
      { id: 2, name: "Cooking oil 3 L", price: 21500 },
      { id: 3, name: "Sugar 2 kg", price: 7000 },
    ]);
    newName = signal("");
    newPrice = signal(5000);
    total = computed(() => this.items.value.reduce((sum, item) => sum + item.price, 0));
    canAdd = computed(() => this.newName.value.trim().length > 0 && Number(this.newPrice.value) > 0);
    today = new Date();
    lastOrder = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    addItem(event) {
      event.preventDefault();
      if (!this.canAdd.value) return;
      // A new array, so the list's signal sees the change.
      this.items.value = [...this.items.value, { id: nextId++, name: this.newName.value.trim(), price: Number(this.newPrice.value) }];
      this.newName.value = "";
    }

    removeItem(item) {
      this.items.value = this.items.value.filter((x) => x.id !== item.id);
    }
  }

  Viraspa.pages = Viraspa.pages || {};
  Viraspa.pages["live-demo"] = LiveDemoPage;
})(window.Viraspa);
