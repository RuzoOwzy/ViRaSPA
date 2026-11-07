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
