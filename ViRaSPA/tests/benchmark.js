(function () {
  // The js-framework-benchmark operations (keyed), each run with vanilla JS
  // and with ViRaSPA bindings. Times: script + style + layout (a forced
  // layout ends each operation), median of several runs after a warm-up.
  // ?runs=10 changes the number of runs; ?auto runs at once (the command line).
  const params = new URLSearchParams(location.search);
  const RUNS = Number(params.get("runs")) || 10;
  const WARMUP = 3;

  const A = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"];
  const C = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"];
  const N = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"];
  let nextId = 1;
  let seed = 1;
  const random = (max) => {
    seed = (seed * 16807) % 2147483647;
    return seed % max;
  };
  const buildData = (count) => Array.from({ length: count }, () => ({ id: nextId++, label: `${A[random(A.length)]} ${C[random(C.length)]} ${N[random(N.length)]}` }));

  // ---- vanilla: direct DOM work, like the benchmark's vanillajs-keyed ------------
  function vanilla(area) {
    area.innerHTML = '<table><tbody></tbody></table>';
    const tbody = area.querySelector("tbody");
    const template = document.createElement("template");
    template.innerHTML = "<tr><td class='id'></td><td><a class='lbl'></a></td><td><a class='remove'>×</a></td></tr>";
    let rows = [];
    let data = [];
    let selected = null;
    const createRow = (item) => {
      const tr = template.content.firstChild.cloneNode(true);
      tr.firstChild.textContent = item.id;
      tr.childNodes[1].firstChild.textContent = item.label;
      return tr;
    };
    const append = (items) => {
      const fragment = document.createDocumentFragment();
      for (const item of items) {
        const tr = createRow(item);
        rows.push(tr);
        fragment.appendChild(tr);
      }
      tbody.appendChild(fragment);
      data = data.concat(items);
    };
    return {
      create(items) {
        this.clear();
        append(items);
      },
      append,
      update() {
        for (let i = 0; i < data.length; i += 10) {
          data[i] = { ...data[i], label: data[i].label + " !!!" };
          rows[i].childNodes[1].firstChild.textContent = data[i].label;
        }
      },
      select(index) {
        if (selected) selected.className = "";
        selected = rows[index];
        selected.className = "danger";
      },
      swap() {
        if (rows.length < 999) return;
        const a = rows[1];
        const b = rows[998];
        const afterB = b.nextSibling;
        tbody.insertBefore(b, a);
        tbody.insertBefore(a, afterB);
        [rows[1], rows[998]] = [b, a];
        [data[1], data[998]] = [data[998], data[1]];
      },
      remove(index) {
        rows[index].remove();
        rows.splice(index, 1);
        data.splice(index, 1);
      },
      clear() {
        tbody.textContent = "";
        rows = [];
        data = [];
        selected = null;
      },
      dispose() {
        area.innerHTML = "";
      },
    };
  }

  // ---- ViRaSPA: a signal list and a keyed repeat, as an app would write it --------
  function viraspa(area) {
    const { signal } = Viraspa.state;
    const rows = signal([]);
    const selected = signal(0);
    const isSelected = Viraspa.state.selector(selected);
    const scope = Viraspa.state.createScope();
    scope.add(isSelected.dispose);
    const host = document.createElement("div");
    area.appendChild(host);
    Viraspa.services.databinding.render(
      host,
      '<table><tbody><template data-bind-repeat="{{ rows }}" data-bind-item="row" data-bind-key="{{ row.id }}">' +
        '<tr class="{{ isSelected(row.id) ? \'danger\' : \'\' }}"><td class="id">{{ row.id }}</td><td><a class="lbl">{{ row.label }}</a></td><td><a class="remove">×</a></td></tr>' +
        "</template></tbody></table>",
      { rows, isSelected },
      { scope }
    );
    return {
      create(items) {
        rows.value = items;
      },
      append(items) {
        rows.value = rows.value.concat(items);
      },
      update() {
        rows.value = rows.value.map((row, i) => (i % 10 ? row : { ...row, label: row.label + " !!!" }));
      },
      select(index) {
        selected.value = rows.value[index].id;
      },
      swap() {
        const list = rows.value.slice();
        if (list.length < 999) return;
        [list[1], list[998]] = [list[998], list[1]];
        rows.value = list;
      },
      remove(index) {
        const list = rows.value.slice();
        list.splice(index, 1);
        rows.value = list;
      },
      clear() {
        rows.value = [];
      },
      dispose() {
        scope.dispose();
        area.innerHTML = "";
      },
    };
  }

  // ---- the operations ---------------------------------------------------------------
  // Each: prepare (not timed), then the timed step.
  const OPERATIONS = [
    { name: "Create 1,000 rows", prepare: () => {}, run: (impl) => impl.create(buildData(1000)) },
    { name: "Replace all 1,000 rows", prepare: (impl) => impl.create(buildData(1000)), run: (impl) => impl.create(buildData(1000)) },
    { name: "Update every 10th row (of 1,000)", prepare: (impl) => impl.create(buildData(1000)), run: (impl) => impl.update() },
    // Short operations run several times in a row (each with its own layout)
    // and are divided, so that browsers' coarse timers still measure them.
    { name: "Select a row", prepare: (impl) => impl.create(buildData(1000)), run: (impl, i) => impl.select(100 + i * 7), repeat: 50 },
    { name: "Swap two rows", prepare: (impl) => impl.create(buildData(1000)), run: (impl) => impl.swap(), repeat: 10 },
    { name: "Remove a row", prepare: (impl) => impl.create(buildData(1000)), run: (impl, i) => impl.remove(500 - i), repeat: 10 },
    { name: "Create 10,000 rows", prepare: () => {}, run: (impl) => impl.create(buildData(10000)), runs: 3 },
    { name: "Append 1,000 rows (to 1,000)", prepare: (impl) => impl.create(buildData(1000)), run: (impl) => impl.append(buildData(1000)) },
    { name: "Clear 1,000 rows", prepare: (impl) => impl.create(buildData(1000)), run: (impl) => impl.clear() },
  ];

  const area = () => document.getElementById("bench-area");
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const median = (values) => {
    const s = values.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  async function measure(make, op) {
    const times = [];
    const runs = op.runs || RUNS;
    for (let i = 0; i < WARMUP + runs; i++) {
      const impl = make(area());
      op.prepare(impl);
      area().offsetHeight;
      await nextFrame();
      const repeat = op.repeat || 1;
      const start = performance.now();
      for (let k = 0; k < repeat; k++) {
        op.run(impl, k);
        area().offsetHeight; // style + layout
      }
      const time = (performance.now() - start) / repeat;
      if (i >= WARMUP) times.push(time);
      impl.dispose();
      await nextFrame();
    }
    return median(times);
  }

  async function run() {
    const status = document.getElementById("status");
    const results = [];
    for (const op of OPERATIONS) {
      status.textContent = `Running: ${op.name}…`;
      const v = await measure(vanilla, op);
      const f = await measure(viraspa, op);
      results.push({ name: op.name, vanilla: v, viraspa: f, factor: f / v });
    }
    // The benchmark's summary: the geometric mean of the factors.
    const mean = Math.exp(results.reduce((s, r) => s + Math.log(r.factor), 0) / results.length);
    const rows = results.map((r) => `<tr><td>${r.name}</td><td>${r.vanilla.toFixed(2)}</td><td>${r.viraspa.toFixed(2)}</td><td>${r.factor.toFixed(2)}×</td></tr>`).join("");
    document.getElementById("results").innerHTML =
      `<table class="results"><thead><tr><th>Operation</th><th>Vanilla (ms)</th><th>ViRaSPA (ms)</th><th>Factor</th></tr></thead><tbody>${rows}` +
      `<tr><th>Geometric mean</th><td></td><td></td><th>${mean.toFixed(2)}×</th></tr></tbody></table>`;
    status.textContent = `Done (${RUNS} runs each, median; ${navigator.userAgent.match(/(Edg|Chrome|Firefox|Version)\/[\d.]+/g)?.join(" ") || ""}).`;
    window.benchmarkResults = { results, mean, runs: RUNS };
    return window.benchmarkResults;
  }

  document.addEventListener("viraspa:routeChanged", function ready() {
    document.removeEventListener("viraspa:routeChanged", ready);
    document.getElementById("status").textContent = "Ready.";
    document.getElementById("run").addEventListener("click", run);
    if (params.has("auto")) run();
  });
})();
