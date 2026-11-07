(function (Viraspa) {
  // Shared logic for vs-table and vs-table-entry (installed with them as a
  // dependency): columns, reading and formatting values, sorting, filtering,
  // searching, totals and CSV. Viraspa.tableCore - mostly for those
  // components, but usable on its own.
  //
  // A column: { field, label, width, minWidth, maxWidth, align ("start" |
  // "end" | "center"), format (a pipe text such as "currency:'TZS'" or
  // "date:'short'", or a function (value, row) => text), value (row) => any
  // (a computed column), render (row) => text | Node, sortable (default
  // true), filterable, hidden, sticky ("start"), wrap, total ("sum" | "avg" |
  // "count" | "min" | "max" | function(rows)), className }.

  const plain = (v) =>
    String(v ?? "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();

  function attr(el, name) {
    const v = el.getAttribute(name);
    return v === null ? undefined : v;
  }

  // Columns from <column field="…" label="…" width="…" …> children.
  function columnsFromChildren(host) {
    return [...host.querySelectorAll(":scope > column")].map((el) => {
      const col = {
        field: attr(el, "field"),
        label: attr(el, "label") ?? attr(el, "field"),
        width: attr(el, "width"),
        minWidth: attr(el, "min-width"),
        maxWidth: attr(el, "max-width"),
        align: attr(el, "align"),
        format: attr(el, "format"),
        sortable: el.getAttribute("sortable") !== "false",
        filterable: el.hasAttribute("filterable"),
        hidden: el.hasAttribute("hidden"),
        sticky: attr(el, "sticky"),
        wrap: el.hasAttribute("wrap"),
        total: attr(el, "total"),
        editor: attr(el, "editor"),
        required: el.hasAttribute("required"),
        readonly: el.hasAttribute("readonly"),
        min: attr(el, "min"),
        max: attr(el, "max"),
        decimals: attr(el, "decimals"),
        options: attr(el, "options"),
        className: attr(el, "class"),
      };
      return col;
    });
  }

  function normalize(columns) {
    return (columns || []).map((c, i) => ({
      sortable: true,
      label: c.field || `Column ${i + 1}`,
      ...c,
      key: c.field || `col${i}`,
      align: c.align || (/^(currency|number|percent)/.test(typeof c.format === "string" ? c.format : "") ? "end" : "start"),
    }));
  }

  const read = (row, col) => (typeof col.value === "function" ? col.value(row) : col.field ? Viraspa.data.read(row, col.field) : undefined);

  // "currency:'TZS'" -> the pipe and its arguments.
  function parsePipe(text) {
    const [name, ...rest] = String(text).split(":");
    const args = rest.length
      ? rest
          .join(":")
          .split(",")
          .map((a) => a.trim().replace(/^['"]|['"]$/g, ""))
      : [];
    return { name: name.trim(), args };
  }

  function format(value, col, row) {
    if (typeof col.format === "function") return col.format(value, row);
    if (col.format) {
      const { name, args } = parsePipe(col.format);
      const pipe = (Viraspa.templates && Viraspa.templates.get(name)) || (Viraspa.format && Viraspa.format.pipe(name));
      if (pipe) {
        try {
          return pipe(value, ...args);
        } catch {
          return value ?? "";
        }
      }
    }
    return value ?? "";
  }

  function compare(a, b, collator) {
    if (a == null && b == null) return 0;
    if (a == null || a === "") return 1;
    if (b == null || b === "") return -1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (a instanceof Date && b instanceof Date) return a - b;
    return collator.compare(String(a), String(b));
  }

  function sortRows(rows, sort, columns) {
    if (!sort || !sort.length) return rows;
    const collator = new Intl.Collator(Viraspa.i18n ? Viraspa.i18n.locale.peek() : undefined, { numeric: true, sensitivity: "base" });
    const byKey = new Map(columns.map((c) => [c.key, c]));
    return rows.slice().sort((x, y) => {
      for (const { column, direction } of sort) {
        const col = byKey.get(column) || { field: column };
        const r = compare(read(x, col), read(y, col), collator);
        if (r) return direction === "desc" ? -r : r;
      }
      return 0;
    });
  }

  // Search (every word somewhere in the row's shown columns) and column
  // filters (the text contained in that column), accent- and case-insensitive.
  function filterRows(rows, { search = "", filters = {} } = {}, columns) {
    const words = plain(search).split(/\s+/).filter(Boolean);
    const active = Object.entries(filters || {}).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "");
    if (!words.length && !active.length) return rows;
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const shown = columns.filter((c) => !c.hidden);
    return rows.filter((row) => {
      if (words.length) {
        const text = shown.map((c) => plain(format(read(row, c), c, row))).join(" ");
        if (!words.every((w) => text.includes(w))) return false;
      }
      for (const [key, wanted] of active) {
        const col = byKey.get(key) || { field: key };
        if (typeof wanted === "function") {
          if (!wanted(read(row, col), row)) return false;
        } else if (!plain(format(read(row, col), col, row)).includes(plain(wanted))) return false;
      }
      return true;
    });
  }

  function total(rows, col) {
    const values = rows.map((r) => read(r, col));
    if (typeof col.total === "function") return col.total(rows);
    const nums = values.map(Number).filter(Number.isFinite);
    switch (col.total) {
      case "sum":
        return nums.reduce((a, b) => a + b, 0);
      case "avg":
        return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
      case "min":
        return nums.length ? Math.min(...nums) : null;
      case "max":
        return nums.length ? Math.max(...nums) : null;
      case "count":
        return values.filter((v) => v !== null && v !== undefined && v !== "").length;
      default:
        return null;
    }
  }

  // CSV text (shown columns, formatted values) - Excel-friendly with a BOM.
  function toCsv(rows, columns, { separator = ",", formatted = true } = {}) {
    const shown = columns.filter((c) => !c.hidden && (c.field || c.value));
    const cell = (v) => {
      const s = String(v ?? "");
      return /[",\n\r;]/.test(s) || s.includes(separator) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [shown.map((c) => cell(c.label)).join(separator)];
    for (const row of rows) lines.push(shown.map((c) => cell(formatted ? format(read(row, c), c, row) : read(row, c))).join(separator));
    return "﻿" + lines.join("\r\n");
  }

  // Saves text as a file in the user's browser (their own download).
  function download(text, fileName, type = "text/csv;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  Viraspa.tableCore = { plain, columnsFromChildren, normalize, read, format, parsePipe, sortRows, filterRows, total, toCsv, download };
})(window.Viraspa);
