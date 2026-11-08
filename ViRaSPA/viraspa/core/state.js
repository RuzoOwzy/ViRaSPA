(function (Viraspa) {
  // Signals: values that remember who reads them, so the screen updates by
  // itself when they change - only the parts that use them, nothing else.
  //
  //   const count = Viraspa.state.signal(0);
  //   const double = Viraspa.state.computed(() => count.value * 2);
  //   const stop = Viraspa.state.effect(() => console.log(count.value, double.value));
  //   count.value++;            // logs "1 2"
  //   Viraspa.state.batch(() => { count.value = 5; count.value = 6; }); // logs once: "6 12"
  //   stop();                   // no more logging
  //
  // In templates, {{count}} on a signal stays live; on a plain value it is
  // filled once. Pages and components own their effects (this.effect(...))
  // and dispose of them when they are removed.

  let currentObserver = null; // the computed/effect running now (collects dependencies)
  let batchDepth = 0;
  const pendingEffects = new Set();

  const SIGNAL = Symbol("viraspa.signal");

  function track(source) {
    if (!currentObserver) return;
    source.observers.add(currentObserver);
    currentObserver.sources.add(source);
  }

  function notify(source) {
    for (const observer of [...source.observers]) observer.markDirty();
    if (batchDepth === 0) flush();
  }

  function flush() {
    // Effects can change signals, which queues more effects: run until quiet.
    let guard = 0;
    while (pendingEffects.size) {
      if (++guard > 1000) {
        pendingEffects.clear();
        throw new Error("Signals: effects keep triggering each other (an endless loop?).");
      }
      const effects = [...pendingEffects];
      pendingEffects.clear();
      for (const e of effects) e.run();
    }
  }

  function cleanupSources(observer) {
    for (const source of observer.sources) source.observers.delete(observer);
    observer.sources.clear();
  }

  // ---- signal ---------------------------------------------------------
  function signal(initial, { equals = Object.is } = {}) {
    const s = {
      [SIGNAL]: true,
      _value: initial,
      observers: new Set(),
      get value() {
        track(s);
        return s._value;
      },
      set value(next) {
        if (equals(s._value, next)) return;
        s._value = next;
        notify(s);
      },
      peek: () => s._value, // read without subscribing
      set: (next) => (s.value = next),
      update: (fn) => (s.value = fn(s._value)),
      // Plain callback subscription (outside templates/effects).
      subscribe(fn) {
        return effect(() => fn(s.value));
      },
      toString: () => String(s.value),
    };
    return s;
  }

  // ---- computed -------------------------------------------------------
  // Recalculated lazily, only when read after a dependency changed.
  function computed(fn) {
    const c = {
      [SIGNAL]: true,
      observers: new Set(),
      sources: new Set(),
      dirty: true,
      _value: undefined,
      markDirty() {
        if (c.dirty) return;
        c.dirty = true;
        for (const observer of [...c.observers]) observer.markDirty();
      },
      get value() {
        track(c);
        if (c.dirty) {
          cleanupSources(c);
          const previous = currentObserver;
          currentObserver = c;
          try {
            c._value = fn();
          } finally {
            currentObserver = previous;
          }
          c.dirty = false;
        }
        return c._value;
      },
      peek: () => untracked(() => c.value),
      subscribe(fn2) {
        return effect(() => fn2(c.value));
      },
      toString: () => String(c.value),
    };
    return c;
  }

  // ---- effect ---------------------------------------------------------
  // Runs fn now and again whenever what it read changes. fn may return a
  // cleanup function (run before the next run and on dispose).
  // Returns dispose().
  function effect(fn) {
    let cleanup = null;
    let disposed = false;
    const e = {
      sources: new Set(),
      markDirty() {
        if (!disposed) pendingEffects.add(e);
      },
      run() {
        if (disposed) return;
        if (typeof cleanup === "function") cleanup();
        cleanupSources(e);
        const previous = currentObserver;
        currentObserver = e;
        try {
          cleanup = fn();
        } catch (err) {
          console.error("An effect failed:", err);
        } finally {
          currentObserver = previous;
        }
      },
    };
    e.run();
    return function dispose() {
      if (disposed) return;
      disposed = true;
      pendingEffects.delete(e);
      cleanupSources(e);
      if (typeof cleanup === "function") cleanup();
    };
  }

  // Changes inside fn update the screen once, at the end.
  function batch(fn) {
    batchDepth++;
    try {
      return fn();
    } finally {
      if (--batchDepth === 0) flush();
    }
  }

  // Reads inside fn don't subscribe the current effect.
  function untracked(fn) {
    const previous = currentObserver;
    currentObserver = null;
    try {
      return fn();
    } finally {
      currentObserver = previous;
    }
  }

  // ---- selector -------------------------------------------------------
  // For "is this the chosen one?" in long lists: isSelected(key) is true for
  // the key equal to source's value. When the value changes, only the two
  // places that read the old and the new key update - not every row.
  //
  //   const isSelected = Viraspa.state.selector(selectedId);
  //   <tr class="{{ isSelected(row.id) ? 'active' : '' }}">
  //
  // It watches `source` for as long as it lives; isSelected.dispose() stops it.
  function selector(source) {
    const readers = new Map(); // key -> Set of observers
    let current = untracked(() => unwrap(source));
    const wake = (key) => {
      const set = readers.get(key);
      if (!set) return;
      if (!set.size) readers.delete(key);
      for (const observer of [...set]) observer.markDirty();
    };
    const stop = effect(() => {
      const next = unwrap(source);
      if (Object.is(next, current)) return;
      const previous = current;
      current = next;
      wake(previous);
      wake(next);
    });
    function isSelected(key) {
      if (currentObserver) {
        let set = readers.get(key);
        if (!set) readers.set(key, (set = new Set()));
        set.add(currentObserver);
        // Seen as a source by the observer, so its next run (or dispose) unsubscribes it.
        currentObserver.sources.add({ observers: set });
      }
      return Object.is(key, current);
    }
    isSelected.dispose = stop;
    return isSelected;
  }

  const isSignal = (value) => Boolean(value && value[SIGNAL]);

  // The value of a signal, or the value itself.
  const unwrap = (value) => (isSignal(value) ? value.value : value);

  // A group of effects disposed together (a page's, a component's).
  function createScope() {
    const disposers = new Set();
    let disposed = false;
    return {
      effect(fn) {
        if (disposed) return () => {};
        const dispose = effect(fn);
        disposers.add(dispose);
        return () => {
          disposers.delete(dispose);
          dispose();
        };
      },
      add(disposer) {
        if (disposed) disposer();
        else disposers.add(disposer);
      },
      dispose() {
        disposed = true;
        for (const d of disposers) d();
        disposers.clear();
      },
      get size() {
        return disposers.size;
      },
    };
  }

  Viraspa.state = { signal, computed, effect, batch, untracked, selector, isSignal, unwrap, createScope };
})(typeof window !== "undefined" ? window.Viraspa : globalThis.Viraspa);
