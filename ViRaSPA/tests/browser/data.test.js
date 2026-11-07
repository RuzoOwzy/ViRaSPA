(function () {
  // The composite components (milestone N9): pagination, tables, tree.
  const { test, assert, render } = Viraspa.testing;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ready = async (element, selector) => {
    const el = element.querySelector(selector);
    await Viraspa.core.components.load(el.localName);
    await el.ready;
    return el;
  };
  const key = (target, init) => target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, composed: true, ...init }));
  const ROWS = [
    { id: 1, name: "Amina", region: "Dar es Salaam", amount: 300 },
    { id: 2, name: "Élodie", region: "Arusha", amount: 100 },
    { id: 3, name: "Baraka", region: "Dar es Salaam", amount: 200 },
  ];

  test("vs-pagination: pages, the page box and the event", async () => {
    const { element } = render('<vs-pagination total="95" page-size="10"></vs-pagination>');
    const p = await ready(element, "vs-pagination");
    assert.equal(p.pages, 10);
    let seen = null;
    p.addEventListener("vs-page-change", (e) => (seen = e.detail));
    p.shadowRoot.querySelector(".next").click();
    assert.deepEqual(seen, { page: 2, pageSize: 10 });
    const box = p.shadowRoot.querySelector(".box");
    box.value = "99";
    key(box, { key: "Enter" });
    assert.equal(p.page, 10, "clamped to the last page");
    assert.match(p.shadowRoot.querySelector(".info").textContent, /91.95 of 95/);
  });

  test("vs-table: local rows - search, filter, sort, paging, totals, selection", async () => {
    const { element } = render('<vs-table page-size="2" search selectable="multiple"><column field="name" label="Name" filterable></column><column field="region" label="Region"></column><column field="amount" label="Amount" total="sum"></column></vs-table>');
    const tb = await ready(element, "vs-table");
    tb.rows = ROWS;
    const s = tb.shadowRoot;
    assert.equal(s.querySelectorAll("tbody tr").length, 2);
    assert.match(s.querySelector("tfoot").textContent, /600/, "totals cover every matching row");
    // Every cell has the wrapper.
    assert.ok(s.querySelector("tbody td[data-c] > div.cell"));
    const search = s.querySelector(".search");
    search.value = "elodie";
    search.dispatchEvent(new Event("input"));
    assert.equal(s.querySelectorAll("tbody tr").length, 1);
    assert.equal(s.querySelector("tbody tr").cells[1].textContent, "Élodie");
    search.value = "";
    search.dispatchEvent(new Event("input"));
    s.querySelector('[data-sort="amount"]').click();
    s.querySelector('[data-sort="amount"]').click();
    assert.equal(s.querySelector("tbody tr").cells[1].textContent, "Amina", "descending");
    assert.equal(s.querySelector('th[data-key="amount"]').getAttribute("aria-sort"), "descending");
    s.querySelector(".row-check").click();
    assert.deepEqual(tb.selection, ["1"]);
    tb.page = 2;
    assert.equal(s.querySelectorAll("tbody tr").length, 1);
    let opened = null;
    tb.addEventListener("vs-row-open", (e) => (opened = e.detail.row));
    const cell = s.querySelector("tbody td[data-c]");
    cell.focus();
    key(cell, { key: "Enter" });
    assert.equal(opened.name, "Élodie");
    const csv = Viraspa.tableCore.toCsv(ROWS, tb.cols);
    assert.match(csv, /^﻿Name,Region,Amount\r\nAmina,Dar es Salaam,300/);
  });

  test("vs-table: server mode sends page, sort, filters and search", async () => {
    const { element } = render('<vs-table page-size="2" search debounce="10"><column field="name" label="Name" filterable></column></vs-table>');
    const tb = await ready(element, "vs-table");
    const requests = [];
    tb.source = async (req) => {
      requests.push({ ...req, signal: undefined });
      return { rows: [{ id: 9, name: `page ${req.page}` }], total: 5 };
    };
    await wait(50);
    const s = tb.shadowRoot;
    assert.equal(s.querySelector("tbody tr").cells[0].textContent, "page 1");
    s.querySelector('[data-sort="name"]').click();
    await wait(50);
    assert.deepEqual(requests[requests.length - 1].sort, [{ column: "name", direction: "asc" }]);
    const search = s.querySelector(".search");
    search.value = "x";
    search.dispatchEvent(new Event("input"));
    await wait(80);
    assert.equal(requests[requests.length - 1].search, "x");
    s.querySelector("vs-pagination").shadowRoot.querySelector(".next").click();
    await wait(50);
    assert.equal(requests[requests.length - 1].page, 2);
  });

  test("vs-table-entry: Enter moves on and adds a row; Ctrl+Delete removes it; form value", async () => {
    const { element } = render('<form><vs-table-entry name="lines"><column field="product" label="Product" required></column><column field="qty" label="Qty" editor="number" total="sum"></column></vs-table-entry></form>');
    const te = await ready(element, "vs-table-entry");
    te.rows = [{ product: "Rice", qty: 2 }];
    const s = te.shadowRoot;
    const qty = s.querySelector('[data-r="0"][data-c="1"]');
    qty.focus();
    qty.value = "5";
    qty.dispatchEvent(new Event("input", { bubbles: true }));
    key(qty, { key: "Enter" });
    assert.equal(te.rows.length, 2, "a new row after the last cell");
    assert.equal(s.activeElement.dataset.r, "1");
    assert.equal(te.checkValidity(), true, "an empty new row doesn't count");
    assert.deepEqual(JSON.parse(new FormData(element.querySelector("form")).get("lines")), [{ product: "Rice", qty: 5 }]);
    assert.match(s.querySelector("tfoot").textContent, /5/);
    key(s.activeElement, { key: "Delete", ctrlKey: true });
    assert.equal(te.rows.length, 1);
    te.setAttribute("add-row-on-enter", "off");
    const last = s.querySelector('[data-r="0"][data-c="1"]');
    key(last, { key: "Enter" });
    assert.equal(te.rows.length, 1, "switched off");
  });

  test("vs-tree: keyboard, selection and locked nodes", async () => {
    const { element } = render('<vs-tree selectable="single" editable></vs-tree>');
    const tree = await ready(element, "vs-tree");
    tree.nodes = [{ id: 1, label: "Assets", locked: true, children: [{ id: 2, label: "Cash" }, { id: 3, label: "Bank" }] }];
    const item = (id) => tree.shadowRoot.querySelector(`[data-id="${id}"]`);
    tree.focusNode(tree.node(1));
    key(item(1), { key: "ArrowRight" });
    assert.equal(item(1).getAttribute("aria-expanded"), "true");
    key(item(1), { key: "ArrowDown" });
    assert.equal(tree.shadowRoot.activeElement, item(2));
    key(item(2), { key: " " });
    assert.equal(tree.value, "2");
    assert.equal(item(2).getAttribute("aria-selected"), "true");
    tree.focusNode(tree.node(1));
    key(item(1), { key: "Delete" });
    assert.ok(tree.node(1), "a locked node stays");
    tree.items = [{ id: "a", label: "A" }, { id: "b", label: "B", parent: "a" }];
    assert.equal(tree.parent(tree.node("b")).label, "A", "a flat list becomes a tree");
  });

  test("vs-select-tree: leaves only by default, value in the form", async () => {
    const { element } = render('<form><vs-select-tree name="cat"></vs-select-tree></form>');
    const st = await ready(element, "vs-select-tree");
    st.items = [{ id: "food", label: "Food" }, { id: "rice", label: "Rice", parent: "food" }];
    await wait(50);
    st.treeEl.dispatchEvent(new CustomEvent("vs-node-select", { detail: { node: st.treeEl.node("food") } }));
    assert.equal(st.value, "", "a branch opens instead of being chosen");
    st.treeEl.dispatchEvent(new CustomEvent("vs-node-select", { detail: { node: st.treeEl.node("rice") } }));
    assert.equal(st.value, "rice");
    assert.equal(new FormData(element.querySelector("form")).get("cat"), "rice");
    assert.match(st.shadowRoot.querySelector(".text").textContent, /Rice/);
  });
})();
