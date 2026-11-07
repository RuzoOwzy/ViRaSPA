(function (Viraspa) {
  // The data contract for components that may need the server (tables,
  // search boxes, trees...). The developer gives a function; the component
  // (through createSource) handles the rest: waiting until the user stops
  // typing, cancelling outdated requests, ignoring answers that arrive late,
  // the loading state, errors and retry.
  //
  //   table.source = async ({ page, pageSize, search, sort, filters, signal }) => {
  //     const r = await Viraspa.app.services.sales.list({ page, pageSize, search, sort, filters }, { signal });
  //     return { rows: r.items, total: r.count };
  //   };
  //
  // Request fields (each component documents the ones it sends):
  //   page (1-based), pageSize, search (text), sort ([{ column, direction: "asc" | "desc" }]),
  //   filters ({ column: value }), signal (AbortSignal: pass it to fetch/call).
  // Answer: { rows: [...], total: number } (total = all matching rows on the server).
  //
  // For data already in the browser, localSource(rows) answers the same
  // requests in memory, so a component has one code path for both.

  // A source: state as signals, plus load/reload/cancel.
  //   const source = Viraspa.data.createSource(handler, { debounce: 300 });
  //   source.load({ page: 1, search: "ab" }, { debounce: true });
  //   source.loading.value, source.error.value, source.result.value
  function createSource(handler, { debounce = 300, onError } = {}) {
    if (typeof handler !== "function") throw new Error("Viraspa.data.createSource needs a function (request) => { rows, total }.");
    const { signal: makeSignal } = Viraspa.state;
    const loading = makeSignal(false);
    const error = makeSignal(null);
    const result = makeSignal(null);
    let controller = null;
    let timer = null;
    let counter = 0;
    let lastRequest = {};

    function cancel() {
      clearTimeout(timer);
      if (controller) controller.abort();
      controller = null;
      loading.value = false;
    }

    async function run(request) {
      if (controller) controller.abort(); // the older request is outdated
      controller = new AbortController();
      const id = ++counter;
      loading.value = true;
      error.value = null;
      try {
        const answer = await handler({ ...request, signal: controller.signal });
        if (id !== counter) return result.peek(); // a newer request started meanwhile
        const normalized = Array.isArray(answer) ? { rows: answer, total: answer.length } : { rows: (answer && answer.rows) || [], total: answer && Number.isFinite(answer.total) ? answer.total : ((answer && answer.rows) || []).length };
        result.value = normalized;
        return normalized;
      } catch (err) {
        if (err && err.name === "AbortError") return result.peek();
        if (id === counter) {
          error.value = err;
          if (onError) onError(err);
          else console.warn("Loading data failed:", err);
        }
        return result.peek();
      } finally {
        if (id === counter) {
          loading.value = false;
          controller = null;
        }
      }
    }

    // `debounce: true` waits until calls stop for `debounce` ms (typing).
    function load(request = {}, { debounce: wait = false } = {}) {
      lastRequest = request;
      clearTimeout(timer);
      if (!wait || !debounce) return run(request);
      return new Promise((resolve) => {
        timer = setTimeout(() => resolve(run(request)), debounce);
      });
    }

    return {
      loading,
      error,
      result,
      load,
      reload: () => run(lastRequest), // e.g. a "Try again" button
      cancel,
      dispose: cancel,
      lastRequest: () => ({ ...lastRequest }),
    };
  }

  // ---- local data ---------------------------------------------------------
  const plain = (value) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();

  // Reads a field, also a nested one ("customer.name"), or calls a function.
  const read = (row, field) => (typeof field === "function" ? field(row) : String(field).split(".").reduce((v, k) => (v == null ? undefined : v[k]), row));

  function compare(a, b, collator) {
    if (a == null && b == null) return 0;
    if (a == null) return 1; // empty values last
    if (b == null) return -1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (a instanceof Date && b instanceof Date) return a - b;
    return collator.compare(String(a), String(b));
  }

  // A handler answering requests from rows in memory: search (accent- and
  // case-insensitive, in searchFields or every field), filters (equal, or a
  // function), sort (several columns) and paging.
  //   localSource(rows, { searchFields: ["name", "email"] })
  function localSource(rows, { searchFields = null } = {}) {
    const all = () => (typeof rows === "function" ? rows() : Viraspa.state.unwrap(rows)) || [];
    return async function ({ page = 1, pageSize = 0, search = "", sort = [], filters = {} } = {}) {
      let list = all().slice();
      const words = plain(search).split(/\s+/).filter(Boolean);
      if (words.length) {
        list = list.filter((row) => {
          const fields = searchFields || Object.keys(row);
          const text = fields.map((f) => plain(read(row, f))).join(" ");
          return words.every((w) => text.includes(w));
        });
      }
      for (const [field, wanted] of Object.entries(filters || {})) {
        if (wanted === undefined || wanted === null || wanted === "") continue;
        list = list.filter((row) => (typeof wanted === "function" ? wanted(read(row, field), row) : plain(read(row, field)) === plain(wanted)));
      }
      if (sort && sort.length) {
        const collator = new Intl.Collator(Viraspa.i18n ? Viraspa.i18n.locale.peek() : undefined, { numeric: true, sensitivity: "base" });
        list.sort((a, b) => {
          for (const { column, direction } of sort) {
            const result = compare(read(a, column), read(b, column), collator);
            if (result) return direction === "desc" ? -result : result;
          }
          return 0;
        });
      }
      const total = list.length;
      if (pageSize > 0) list = list.slice((page - 1) * pageSize, page * pageSize);
      return { rows: list, total };
    };
  }

  Viraspa.data = { createSource, localSource, read };
})(window.Viraspa);
