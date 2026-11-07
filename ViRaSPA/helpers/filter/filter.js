(function (Viraspa) {
  // Viraspa.filter - type to filter a list, a table or a select.
  //
  //   <input type="search" data-filter-for="#customers" placeholder="Filter...">
  //   <table id="customers">...</table>
  //
  // or in code:
  //   const filter = Viraspa.filter.bind(input, table, { columns: [0, 2], maxItems: 50 });
  //   filter.apply("dar"); filter.dispose();
  //
  // Matching ignores letter case and accents ("elodie" finds "Élodie"); every
  // word must appear. Items are hidden with `hidden`, so nothing is removed.
  // Targets: a table (its body rows), ul/ol (li), select (options), or any
  // container (its children, or `items: ".card"`).
  // Options: columns (table cell indexes), exact (whole text equals), maxItems
  // (show at most this many), highlight (marks the matches where the browser
  // supports the CSS Highlight API - nothing in the page is rewritten),
  // empty (text shown when nothing matches). Each change fires "vs-filter"
  // on the target with { shown, total, text }.

  const plain = (v) =>
    String(v ?? "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();

  function itemsOf(target, selector) {
    if (selector) return [...target.querySelectorAll(selector)];
    if (target.localName === "table") return [...(target.tBodies.length ? [...target.tBodies].flatMap((b) => [...b.rows]) : [...target.rows].slice(1))];
    if (target.localName === "select") return [...target.options];
    if (/^(ul|ol)$/.test(target.localName)) return [...target.children].filter((c) => c.localName === "li");
    return [...target.children];
  }

  function textOf(item, columns) {
    if (columns && item.cells) return columns.map((i) => (item.cells[i] ? item.cells[i].textContent : "")).join(" ");
    return item.textContent;
  }

  const highlights = typeof CSS !== "undefined" && CSS.highlights && typeof Highlight === "function";
  // One highlight ("vs-filter", styled in filter.css) for all filters on the page.
  const rangesByFilter = new Map();
  function paint(id, ranges) {
    if (!highlights) return;
    if (ranges && ranges.length) rangesByFilter.set(id, ranges);
    else rangesByFilter.delete(id);
    const all = [...rangesByFilter.values()].flat();
    if (all.length) CSS.highlights.set("vs-filter", new Highlight(...all));
    else CSS.highlights.delete("vs-filter");
  }

  function bind(input, target, options = {}) {
    const field = typeof input === "string" ? document.querySelector(input) : input;
    const list = typeof target === "string" ? document.querySelector(target) : target;
    if (!field || !list) throw new Error("Viraspa.filter.bind needs an input and a target element.");
    const { columns = null, exact = false, maxItems = 0, highlight = true, empty = "", items = null } = options;
    let emptyRow = null;
    const id = Symbol("filter");

    function apply(text = field.value) {
      const words = plain(text).split(/\s+/).filter(Boolean);
      const all = itemsOf(list, items);
      let shown = 0;
      const ranges = [];
      for (const item of all) {
        if (item.hasAttribute("data-filter-keep")) continue;
        const hay = plain(textOf(item, columns));
        let match = !words.length || (exact ? hay.trim() === words.join(" ") : words.every((w) => hay.includes(w)));
        if (match && maxItems > 0 && shown >= maxItems) match = false;
        item.hidden = !match;
        if (match) {
          shown++;
          if (highlight && highlights && words.length) ranges.push(...rangesIn(item, words));
        }
      }
      paint(id, ranges);
      if (empty) showEmpty(shown === 0 && all.length > 0);
      list.dispatchEvent(new CustomEvent("vs-filter", { detail: { shown, total: all.length, text } }));
      return shown;
    }

    // Ranges of the matched words in an item's text nodes (for highlighting).
    function rangesIn(item, words) {
      const out = [];
      const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const original = node.data;
        // plain() can change length only for combining marks; map back per character.
        const map = [];
        let flat = "";
        for (let i = 0; i < original.length; i++) {
          const piece = plain(original[i]);
          for (let k = 0; k < piece.length; k++) map.push(i);
          flat += piece;
        }
        for (const word of words) {
          let at = flat.indexOf(word);
          while (at !== -1) {
            const range = new Range();
            range.setStart(node, map[at]);
            range.setEnd(node, map[at + word.length - 1] + 1);
            out.push(range);
            at = flat.indexOf(word, at + word.length);
          }
        }
      }
      return out;
    }

    function showEmpty(on) {
      if (!on) {
        if (emptyRow) emptyRow.hidden = true;
        return;
      }
      if (!emptyRow) {
        if (list.localName === "table") {
          emptyRow = (list.tBodies[0] || list).insertRow();
          const cell = emptyRow.insertCell();
          cell.colSpan = list.rows[0] ? list.rows[0].cells.length : 1;
          cell.textContent = empty;
        } else {
          emptyRow = document.createElement(/^(ul|ol)$/.test(list.localName) ? "li" : "div");
          emptyRow.textContent = empty;
          list.appendChild(emptyRow);
        }
        emptyRow.className = "vs-filter-empty";
        emptyRow.setAttribute("data-filter-keep", "");
      }
      emptyRow.hidden = false;
    }

    const onInput = () => apply();
    field.addEventListener("input", onInput);
    if (field.value) apply();
    return {
      apply,
      dispose() {
        field.removeEventListener("input", onInput);
        paint(id, null);
        for (const item of itemsOf(list, items)) item.hidden = false;
        if (emptyRow) emptyRow.remove();
      },
    };
  }

  // <input data-filter-for="#list" data-filter-columns="0,2" data-filter-max="20" data-filter-empty="No match">
  function scan(root = document) {
    for (const input of root.querySelectorAll("[data-filter-for]:not([data-filter-bound])")) {
      const target = (input.getRootNode() || document).querySelector(input.getAttribute("data-filter-for"));
      if (!target) continue;
      input.setAttribute("data-filter-bound", "");
      const columns = input.getAttribute("data-filter-columns");
      bind(input, target, {
        columns: columns ? columns.split(",").map(Number) : null,
        maxItems: Number(input.getAttribute("data-filter-max") || 0),
        empty: input.getAttribute("data-filter-empty") || "",
        exact: input.hasAttribute("data-filter-exact"),
      });
    }
  }

  document.addEventListener("viraspa:pageShown", (event) => scan(event.target));

  Viraspa.filter = { bind, scan, plain };
})(window.Viraspa);
