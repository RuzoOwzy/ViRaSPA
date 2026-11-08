(function () {
  const { test, assert, render } = Viraspa.testing;
  const { signal, computed } = Viraspa.state;

  test("{{x}} escapes HTML and stays live for signals", () => {
    const name = signal("<b>Amina</b>");
    const { element } = render("<p>Hello {{ name }}!</p>", { name });
    assert.equal(element.querySelector("p").textContent, "Hello <b>Amina</b>!");
    assert.equal(element.querySelector("b"), null);
    name.value = "Baraka";
    assert.equal(element.querySelector("p").textContent, "Hello Baraka!");
  });

  test("{{{x}}} inserts raw HTML; \\{{ writes literal braces", () => {
    const { element } = render("<div>{{{ html }}} \\{{ literal }}</div>", { html: "<i>raw</i>" });
    assert.ok(element.querySelector("i"));
    assert.match(element.textContent, /\{\{ literal \}\}/);
  });

  test("attributes interpolate; a lone boolean toggles the attribute", () => {
    const count = signal(2);
    const { element } = render('<button title="Cart ({{ count }} items)" disabled="{{ count === 0 }}">x</button>', { count });
    const button = element.querySelector("button");
    assert.equal(button.title, "Cart (2 items)");
    assert.equal(button.disabled, false);
    count.value = 0;
    assert.equal(button.title, "Cart (0 items)");
    assert.equal(button.disabled, true);
  });

  test("URL attributes refuse javascript: values", () => {
    const { element } = render('<a href="{{ link }}">x</a>', { link: "javascript:alert(1)" });
    assert.equal(element.querySelector("a").getAttribute("href"), "about:blank");
  });

  test("data-bind-show-if hides and shows", () => {
    const open = signal(false);
    const { element } = render('<p data-bind-show-if="{{ open }}">x</p>', { open });
    assert.equal(element.querySelector("p").hidden, true);
    open.value = true;
    assert.equal(element.querySelector("p").hidden, false);
  });

  test("<template data-bind-if> adds and removes a block", () => {
    const show = signal(true);
    const { element } = render('<div><template data-bind-if="{{ show }}"><span class="x">yes</span></template></div>', { show });
    assert.ok(element.querySelector(".x"));
    show.value = false;
    assert.equal(element.querySelector(".x"), null);
  });

  test("<template data-bind-repeat> keeps rows by key", () => {
    const users = signal([{ id: 1, name: "A" }, { id: 2, name: "B" }]);
    const { element } = render(
      '<ul><template data-bind-repeat="{{ users }}" data-bind-item="u" data-bind-key="{{ u.id }}" data-bind-index="i"><li>{{ i }}:{{ u.name }}</li></template></ul>',
      { users }
    );
    const texts = () => [...element.querySelectorAll("li")].map((li) => li.textContent);
    assert.deepEqual(texts(), ["0:A", "1:B"]);
    const second = element.querySelectorAll("li")[1];
    users.value = [{ id: 2, name: "B2" }, { id: 3, name: "C" }];
    assert.deepEqual(texts(), ["0:B2", "1:C"]);
    assert.equal(element.querySelectorAll("li")[0], second, "the row for id 2 is reused");
  });

  test("keyed repeat: any reordering ends in the right order, reusing rows", () => {
    const list = signal([1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id })));
    const { element } = render('<ul><template data-bind-repeat="{{ list }}" data-bind-item="r" data-bind-key="{{ r.id }}"><li>{{ r.id }}</li></template><li class="end">end</li></ul>', { list });
    const ids = () => [...element.querySelectorAll("li:not(.end)")].map((li) => Number(li.textContent));
    const byId = () => new Map([...element.querySelectorAll("li:not(.end)")].map((li) => [Number(li.textContent), li]));
    const before = byId();
    const orders = [
      [1, 7, 3, 4, 5, 6, 2, 8], // swap
      [8, 7, 6, 5, 4, 3, 2, 1], // reverse
      [8, 7, 9, 6, 5, 10, 4, 3, 2, 1], // insert in the middle
      [7, 9, 5, 10, 3, 1], // remove some
      [3, 10, 1, 7, 9, 5, 11], // shuffle + new at the end
      [11, 3, 10, 1, 7, 9, 5], // last to first
      [],
      [2, 1],
    ];
    for (const order of orders) {
      list.value = order.map((id) => ({ id }));
      assert.deepEqual(ids(), order);
      assert.equal(element.querySelector("ul, div > ul").lastElementChild.className, "end", "rows stay before what follows the template");
    }
    list.value = [5, 3].map((id) => ({ id }));
    assert.deepEqual(ids(), [5, 3]);
    list.value = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id }));
    const again = byId();
    list.value = [1, 7, 3, 4, 5, 6, 2, 8].map((id) => ({ id }));
    assert.equal(byId().get(4), again.get(4), "rows that didn't move are the same nodes");
    assert.ok(before.size === 8);
  });

  test("state.selector updates only the old and the new chosen row", () => {
    const selected = signal(2);
    const isSelected = Viraspa.state.selector(selected);
    const runs = { 1: 0, 2: 0, 3: 0 };
    const stops = [1, 2, 3].map((id) => Viraspa.state.effect(() => {
      isSelected(id);
      runs[id]++;
    }));
    assert.deepEqual(runs, { 1: 1, 2: 1, 3: 1 });
    selected.value = 3;
    assert.deepEqual(runs, { 1: 1, 2: 2, 3: 2 }, "row 1 didn't run again");
    assert.equal(isSelected(3), true);
    assert.equal(isSelected(2), false);
    const rows = signal([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const { element } = render('<ul><template data-bind-repeat="{{ rows }}" data-bind-item="r" data-bind-key="{{ r.id }}"><li class="{{ isSelected(r.id) ? \'on\' : \'\' }}">{{ r.id }}</li></template></ul>', { rows, isSelected });
    assert.equal(element.querySelector("li.on").textContent, "3");
    selected.value = 1;
    assert.equal(element.querySelector("li.on").textContent, "1");
    stops.forEach((s) => s());
    isSelected.dispose();
    selected.value = 2;
    assert.equal(element.querySelector("li.on").textContent, "1", "a disposed selector stops following");
  });

  test("data-bind-two-way connects inputs and signals", () => {
    const text = signal("hi");
    const agreed = signal(false);
    const { element } = render('<input class="t" data-bind-two-way="{{ text }}"><input class="c" type="checkbox" data-bind-two-way="{{ agreed }}">', { text, agreed });
    const input = element.querySelector(".t");
    assert.equal(input.value, "hi");
    input.value = "typed";
    input.dispatchEvent(new Event("input"));
    assert.equal(text.value, "typed");
    const box = element.querySelector(".c");
    box.click();
    assert.equal(agreed.value, true);
  });

  test("data-bind-on-* calls methods with arguments", () => {
    const owner = {
      clicked: [],
      pick(item) {
        this.clicked.push(item);
      },
    };
    const { element } = render('<button data-bind-on-click="{{ pick(\'a\') }}">x</button>', {}, owner);
    element.querySelector("button").click();
    assert.deepEqual(owner.clicked, ["a"]);
  });

  test("computed values and pipes", () => {
    const price = signal(1500);
    const doubled = computed(() => price.value * 2);
    const { element } = render("<p>{{ doubled | number }}</p>", { doubled });
    assert.equal(element.textContent, "3,000");
    price.value = 2000;
    assert.equal(element.textContent, "4,000");
  });

  test("bindings stop after their scope is disposed", () => {
    const n = signal(1);
    const { element, scope } = render("<p>{{ n }}</p>", { n });
    scope.dispose();
    n.value = 2;
    assert.equal(element.textContent, "1");
  });
})();
