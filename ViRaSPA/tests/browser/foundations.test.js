(function () {
  const { test, assert, render } = Viraspa.testing;
  const { signal } = Viraspa.state;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (target, init) => {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, composed: true, ...init });
    target.dispatchEvent(event);
    return event;
  };

  // ---- Viraspa.templates ------------------------------------------------
  let added = false;
  const addHelpers = () => {
    if (added) return;
    added = true;
    Viraspa.templates.add("testFullName", (u) => `${u.first} ${u.last}`);
    Viraspa.templates.add("testInitials", (name, count = 2) => String(name).split(" ").map((w) => w[0]).slice(0, count).join(""));
  };

  test("template helpers work as calls and as pipes, and stay live", () => {
    addHelpers();
    const user = signal({ first: "Amina", last: "Juma Said" });
    const { element } = render("<p>{{ testFullName(user) }}</p><b>{{ user.last | testInitials:1 }}</b>", { user });
    assert.equal(element.querySelector("p").textContent, "Amina Juma Said");
    assert.equal(element.querySelector("b").textContent, "J");
    user.value = { first: "Baraka", last: "Mussa" };
    assert.equal(element.querySelector("p").textContent, "Baraka Mussa");
    assert.throws(() => Viraspa.templates.add("t", () => 1));
  });

  // ---- Viraspa.keyboard -------------------------------------------------
  test("shortcuts fire, but never when the app already handled the key", () => {
    let count = 0;
    const off = Viraspa.keyboard.shortcut("ctrl+k", () => count++);
    key(document.body, { key: "k", ctrlKey: true });
    assert.equal(count, 1);
    const own = (e) => e.preventDefault();
    document.addEventListener("keydown", own);
    key(document.body, { key: "k", ctrlKey: true });
    document.removeEventListener("keydown", own);
    assert.equal(count, 1, "the app's handler won");
    off();
    key(document.body, { key: "k", ctrlKey: true });
    assert.equal(count, 1, "removed");
  });

  test("data-keys=native switches framework keys off; plain keys skip fields", () => {
    let count = 0;
    const off = Viraspa.keyboard.shortcut("alt+j", () => count++);
    const offPlain = Viraspa.keyboard.shortcut("j", () => count++);
    const { element } = render('<div data-keys="native"><button>x</button></div><input>');
    key(element.querySelector("button"), { key: "j", altKey: true });
    assert.equal(count, 0, "native area");
    key(element.querySelector("input"), { key: "j" });
    assert.equal(count, 0, "typing in a field");
    key(element.querySelector("input"), { key: "j", altKey: true });
    assert.equal(count, 1, "with a modifier it works in fields");
    off();
    offPlain();
  });

  test("the most specific shortcut wins", () => {
    const calls = [];
    const { element } = render('<section class="area"><button>x</button></section>');
    const offApp = Viraspa.keyboard.shortcut("alt+q", () => calls.push("app"));
    const offArea = Viraspa.keyboard.shortcut("alt+q", () => calls.push("area"), { within: element.querySelector(".area") });
    key(element.querySelector("button"), { key: "q", altKey: true });
    key(document.body, { key: "q", altKey: true });
    offApp();
    offArea();
    assert.deepEqual(calls, ["area", "app"]);
  });

  test("component key maps: defaults, then app settings, then the element", () => {
    const el = document.createElement("div");
    let map = Viraspa.keyboard.keymap("vs-test-keys", { addRow: "enter", remove: "ctrl+delete" }, el);
    assert.equal(map.addRow, "enter");
    Viraspa.keyboard.configure({ components: { "vs-test-keys": { remove: "alt+delete" } } });
    el.keys = { addRow: false };
    map = Viraspa.keyboard.keymap("vs-test-keys", { addRow: "enter", remove: "ctrl+delete" }, el);
    assert.equal(map.addRow, false);
    assert.equal(map.remove, "alt+delete");
    assert.equal(Viraspa.keyboard.actionFor(new KeyboardEvent("keydown", { key: "Delete", altKey: true }), map), "remove");
    assert.equal(Viraspa.keyboard.actionFor(new KeyboardEvent("keydown", { key: "Enter" }), map), null);
    assert.equal(Viraspa.keyboard.label("ctrl+shift+k"), "Ctrl+Shift+K");
    assert.ok(Viraspa.keyboard.matches(new KeyboardEvent("keydown", { key: " " }), " "), "a lone space is the Space key");
    assert.ok(Viraspa.keyboard.matches(new KeyboardEvent("keydown", { key: " " }), "space"));
  });

  test("roving focus moves with the arrow keys; trapFocus keeps Tab inside", () => {
    const { element } = render('<ul><li role="option">a</li><li role="option">b</li><li role="option">c</li></ul><div class="box"><button>1</button><button>2</button></div><button class="outside">o</button>');
    const items = element.querySelectorAll("li");
    Viraspa.keyboard.roving(element.querySelector("ul"));
    items[0].focus();
    key(items[0], { key: "ArrowDown" });
    assert.equal(document.activeElement, items[1]);
    key(items[1], { key: "End" });
    assert.equal(document.activeElement, items[2]);
    key(items[2], { key: "ArrowDown" });
    assert.equal(document.activeElement, items[0], "loops");
    const box = element.querySelector(".box");
    const outside = element.querySelector(".outside");
    outside.focus();
    const release = Viraspa.keyboard.trapFocus(box);
    const buttons = box.querySelectorAll("button");
    assert.equal(document.activeElement, buttons[0]);
    buttons[1].focus();
    key(buttons[1], { key: "Tab" });
    assert.equal(document.activeElement, buttons[0], "Tab wraps inside");
    release();
    assert.equal(document.activeElement, outside, "focus returns");
  });

  // ---- Viraspa.data -----------------------------------------------------
  test("a data source debounces, cancels outdated requests and keeps the newest answer", async () => {
    const seen = [];
    const source = Viraspa.data.createSource(
      async ({ search, signal }) => {
        seen.push(search);
        await wait(search === "slow" ? 80 : 10);
        if (signal.aborted) throw new DOMException("aborted", "AbortError");
        return { rows: [search], total: 1 };
      },
      { debounce: 40 }
    );
    source.load({ search: "a" }, { debounce: true });
    source.load({ search: "ab" }, { debounce: true });
    await wait(80);
    assert.deepEqual(seen, ["ab"], "only the last typed value is asked for");
    source.load({ search: "slow" });
    const fast = source.load({ search: "fast" });
    await fast;
    await wait(100);
    assert.deepEqual(source.result.value.rows, ["fast"]);
    assert.equal(source.loading.value, false);
  });

  test("a data source reports errors and can retry", async () => {
    let fail = true;
    const source = Viraspa.data.createSource(async () => {
      if (fail) throw new Error("offline");
      return [1, 2];
    }, { onError: () => {} });
    await source.load({ page: 1 });
    assert.equal(source.error.value.message, "offline");
    fail = false;
    await source.reload();
    assert.equal(source.error.value, null);
    assert.equal(source.result.value.total, 2);
  });

  test("localSource searches (accents too), sorts and pages", async () => {
    const rows = [
      { name: "Zainab", city: "Arusha", amount: 5 },
      { name: "Élodie", city: "Dodoma", amount: 20 },
      { name: "baraka", city: "Arusha", amount: 10 },
    ];
    const handler = Viraspa.data.localSource(rows);
    assert.deepEqual((await handler({ search: "elodie" })).rows.map((r) => r.name), ["Élodie"]);
    const sorted = await handler({ sort: [{ column: "city", direction: "asc" }, { column: "amount", direction: "desc" }] });
    assert.deepEqual(sorted.rows.map((r) => r.name), ["baraka", "Zainab", "Élodie"]);
    const paged = await handler({ sort: [{ column: "name", direction: "asc" }], page: 2, pageSize: 2 });
    assert.equal(paged.total, 3);
    assert.deepEqual(paged.rows.map((r) => r.name), ["Zainab"]);
    assert.equal((await handler({ filters: { city: "arusha" } })).total, 2);
  });

  // ---- Viraspa.busy top line ----------------------------------------------
  test("the top line shows for slow global work and hides afterwards", async () => {
    Viraspa.busy.configure({ topLineDelay: 0 });
    const work = Viraspa.busy.run(() => wait(120));
    await wait(40);
    const line = document.querySelector(".vs-top-line");
    assert.ok(line && line.classList.contains("is-active"), "visible while working");
    assert.equal(line.getAttribute("role"), "progressbar");
    await work;
    await wait(350);
    assert.ok(!line.classList.contains("is-active"), "hidden when done");
    Viraspa.busy.configure({ topLineDelay: 150 });
  });

  // ---- form fields ------------------------------------------------------
  test("a form-associated component takes part in its form", async () => {
    if (!customElements.get("test-form-field")) {
      class TestFormField extends Viraspa.core.Component {
        static tag = "test-form-field";
        static isolation = "none";
        static formAssociated = true;
        async onLoad() {
          this.setFormValue("42");
          this.setValidity({ valueMissing: true }, "Required");
        }
        onFormReset() {
          this.wasReset = true;
        }
      }
      Viraspa.core.defineComponent(TestFormField);
    }
    const { element } = render('<form><test-form-field name="amount"></test-form-field></form>');
    const field = element.querySelector("test-form-field");
    await field.ready;
    const form = element.querySelector("form");
    assert.equal(new FormData(form).get("amount"), "42");
    assert.equal(field.form, form);
    assert.equal(form.checkValidity(), false);
    field.setValidity({});
    assert.equal(form.checkValidity(), true);
    form.reset();
    assert.ok(field.wasReset);
  });
})();
