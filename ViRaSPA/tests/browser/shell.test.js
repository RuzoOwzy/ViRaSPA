(function () {
  // The shell components' newer options: vs-menu groups, nested items,
  // search and drop-downs; vs-sidebar collapse="hide"; self-closing tags.
  const { test, assert, render } = Viraspa.testing;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (target, init) => target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, composed: true, ...init }));
  const type = (input, text) => {
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  };
  const ITEMS = [
    { label: "Overview", href: "/menu-test/overview" },
    { group: "Data", items: [
      { group: "Tables", items: [
        { label: "Orders", href: "/menu-test/orders", items: [{ label: "Paging", href: "/menu-test/paging" }] },
        { label: "Élodie's list", href: "/menu-test/elodie" },
      ] },
      { label: "Trees", href: "/menu-test/trees" },
    ] },
    { divider: true },
    { group: "Links", items: [{ label: "Website", href: "https://example.com", external: true }] },
  ];

  async function menu(attributes) {
    const { element } = render(`<vs-menu ${attributes}></vs-menu>`);
    const m = element.querySelector("vs-menu");
    m.items = ITEMS;
    await Viraspa.core.components.load("vs-menu");
    await m.ready;
    try {
      localStorage.removeItem("vs-menu:test:/Data");
    } catch {
      // storage blocked
    }
    return m;
  }

  test("vs-menu: groups with headings, nested groups and nested items, indented", async () => {
    const m = await menu('orientation="vertical" menu="test"');
    const root = m.shadowRoot;
    assert.deepEqual([...root.querySelectorAll(".heading")].map((h) => h.textContent.trim()), ["Data", "Tables", "Links"]);
    const data = root.querySelector('li.group[data-key="/Data"]');
    assert.ok(data.querySelector(':scope > ul[role="list"][aria-labelledby]'), "a labelled list per group");
    const paging = root.querySelector('a[href$="/menu-test/paging"]');
    const orders = root.querySelector('a[href$="/menu-test/orders"]');
    assert.ok(paging.getBoundingClientRect().left > orders.getBoundingClientRect().left, "a nested item steps in");
    const tables = root.querySelector('li.group[data-key="/Data/Tables"] > .heading');
    assert.ok(tables.getBoundingClientRect().left > data.querySelector(":scope > .heading").getBoundingClientRect().left, "a nested group's heading steps in");
  });

  test("vs-menu: groups from routes (nav.group with '/', nav.parent)", async () => {
    const saved = Viraspa.routes;
    Viraspa.routes = [
      { path: "/r-a", name: "r-a", nav: { label: "A", menus: ["rt"], group: "One/Two" } },
      { path: "/r-b", name: "r-b", nav: { label: "B", menus: ["rt"], parent: "r-a" } },
      { path: "/r-c", name: "r-c", nav: { label: "C", menus: ["rt"] } },
    ];
    try {
      const m = new (customElements.get("vs-menu"))();
      const tree = m.routeItems("rt");
      assert.equal(tree[0].group, "One");
      assert.equal(tree[0].items[0].group, "Two");
      assert.equal(tree[0].items[0].items[0].label, "A");
      assert.equal(tree[0].items[0].items[0].items[0].label, "B", "B is nested under A");
      assert.equal(tree[1].label, "C");
    } finally {
      Viraspa.routes = saved;
    }
  });

  test("vs-menu: collapsible groups open and close, and remember it", async () => {
    const m = await menu('orientation="vertical" menu="test" collapsible-groups');
    const button = m.shadowRoot.querySelector('li.group[data-key="/Data"] > .heading-button');
    assert.equal(button.getAttribute("aria-expanded"), "true");
    button.click();
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(m.shadowRoot.querySelector('a[href$="/menu-test/trees"]').offsetParent, null, "its items are out of sight");
    assert.equal(localStorage.getItem("vs-menu:test:/Data"), "closed");
    button.click();
    assert.equal(button.getAttribute("aria-expanded"), "true");
    assert.equal(localStorage.getItem("vs-menu:test:/Data"), null);
  });

  test("vs-menu: search keeps the matches with their groups and parents, accents ignored", async () => {
    const m = await menu('orientation="vertical" menu="test" searchable collapsible-groups');
    const root = m.shadowRoot;
    const search = root.querySelector("input.search");
    const visible = () => [...root.querySelectorAll("a.link")].filter((a) => a.offsetParent !== null).map((a) => a.textContent.trim());
    type(search, "pag");
    assert.deepEqual(visible(), ["Orders", "Paging"]);
    assert.equal(root.querySelector("mark").textContent, "Pag");
    type(search, "elodie");
    assert.deepEqual(visible(), ["Élodie's list"]);
    type(search, "zzz");
    assert.equal(root.querySelector(".no-match").hidden, false);
    key(search, { key: "Escape" });
    assert.equal(search.value, "");
    assert.equal(visible().length, 6);
  });

  test("vs-menu: horizontal drop-downs open, move with the arrows and close with Escape", async () => {
    const m = await menu('menu="test"');
    const root = m.shadowRoot;
    const host = root.querySelector('li.group[data-key="/Data"]');
    const opener = host.querySelector(":scope > .heading-button");
    const dropdown = host.querySelector(":scope > .dropdown");
    assert.equal(getComputedStyle(dropdown).display, "none");
    opener.click();
    assert.equal(opener.getAttribute("aria-expanded"), "true");
    assert.notEqual(getComputedStyle(dropdown).display, "none");
    // Under 768px the menu is folded behind its toggle: open that first.
    if (getComputedStyle(root.querySelector(".toggle")).display !== "none") root.querySelector(".toggle").click();
    key(opener, { key: "ArrowDown" });
    assert.equal(root.activeElement && root.activeElement.textContent.trim(), "Orders");
    key(root.activeElement, { key: "Escape" });
    assert.equal(opener.getAttribute("aria-expanded"), "false");
    // Opening another closes the first; a click elsewhere closes all.
    opener.click();
    root.querySelector('li.group[data-key="/Links"] > .heading-button').click();
    assert.equal(opener.getAttribute("aria-expanded"), "false");
    document.body.click();
    assert.equal(root.querySelectorAll(".dropdown-host.open").length, 0);
  });

  test("vs-sidebar: collapse=\"hide\" hides it completely, toggled by a data-sidebar-toggle button", async () => {
    try {
      localStorage.removeItem("test-hide");
    } catch {
      // storage blocked
    }
    const { element } = render('<button type="button" data-sidebar-toggle="side-test">Menu</button><div style="display:flex"><vs-sidebar id="side-test" collapse="hide" storage-key="test-hide"><a href="#x">Link</a></vs-sidebar><main style="flex:1">Page</main></div>');
    const sidebar = element.querySelector("vs-sidebar");
    await Viraspa.core.components.load("vs-sidebar");
    await sidebar.ready;
    const button = element.querySelector("button");
    const main = element.querySelector("main");
    const wide = window.matchMedia("(min-width: 768px)").matches;
    if (wide) assert.ok(!sidebar.hasAttribute("collapsed"), "open on a wide screen");
    assert.equal(button.getAttribute("aria-controls"), "side-test");
    const before = main.getBoundingClientRect().width;
    if (!sidebar.hasAttribute("collapsed")) button.click();
    assert.ok(sidebar.hasAttribute("collapsed"));
    assert.equal(getComputedStyle(sidebar).display, "none");
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.ok(sidebar.inert, "nothing hidden can be reached with Tab");
    if (wide) assert.ok(main.getBoundingClientRect().width > before, "the page gets the room");
    button.click();
    assert.ok(!sidebar.hasAttribute("collapsed"));
    assert.equal(button.getAttribute("aria-expanded"), "true");
  });

  test("self-closing tags: expanded in templates, left alone where they must be", async () => {
    const x = Viraspa.core.pageLoader.expandSelfClosing;
    assert.equal(x('<vs-icon name="a" /><vs-icon name="b"/>'), '<vs-icon name="a" data-vs-short></vs-icon><vs-icon name="b" data-vs-short></vs-icon>');
    assert.equal(x('<x-a title="a /> b" />'), '<x-a title="a /> b" data-vs-short></x-a>', "quoted values keep their />");
    const untouched = '<script>let s = "<vs-x />";</script><textarea><vs-y /></textarea><!-- <vs-z /> --><br/><img src="a" />';
    assert.equal(x(untouched), untouched, "scripts, textareas, comments and void elements");
    // Two in a row stay siblings once parsed.
    const { element } = render(x('<div><vs-progress value="1" /><vs-progress value="2" /><p>after</p></div>'));
    const div = element.querySelector("div");
    assert.deepEqual([...div.children].map((c) => c.localName), ["vs-progress", "vs-progress", "p"]);
  });

  test("self-closing tags: the marker goes, and a component with content warns", async () => {
    const warnings = [];
    const original = console.warn;
    console.warn = (text) => warnings.push(String(text));
    try {
      const { element } = render(Viraspa.core.pageLoader.expandSelfClosing('<vs-progress value="5" /><vs-card heading="x" />'));
      await Viraspa.core.components.load("vs-progress");
      await Viraspa.core.components.load("vs-card");
      await element.querySelector("vs-card").ready;
      assert.equal(element.querySelectorAll("[data-vs-short]").length, 0);
      assert.ok(warnings.some((w) => /vs-card holds content/.test(w)), "vs-card warns");
      assert.ok(!warnings.some((w) => /vs-progress/.test(w)), "vs-progress is fine self-closing");
    } finally {
      console.warn = original;
    }
  });

  test("start-up: the framework marks <html> ready once the first page is shown", async () => {
    await wait(0);
    assert.equal(typeof Viraspa.core.pageLoader.expandSelfClosing, "function");
    // run.html has no app shell: the fallback still sets it within 4 s of start-up.
    const deadline = Date.now() + 4500;
    while (!document.documentElement.hasAttribute("data-vs-ready") && Date.now() < deadline) await wait(100);
    assert.ok(document.documentElement.hasAttribute("data-vs-ready"));
  });
})();
