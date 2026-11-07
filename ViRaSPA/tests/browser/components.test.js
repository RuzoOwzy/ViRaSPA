(function () {
  const { test, assert, mount } = Viraspa.testing;

  test("vs-card renders its heading in a shadow root", async () => {
    const card = await mount("vs-card", { heading: "Hello", subheading: "World" });
    assert.ok(card.shadowRoot, "full isolation");
    assert.equal(card.shadowRoot.querySelector(".heading").textContent, "Hello");
  });

  test("app-note (scoped) fills its slot and has no shadow root", async () => {
    const note = document.createElement("app-note");
    note.setAttribute("heading", "Tip");
    note.textContent = "Body text";
    document.getElementById("vs-test-area").appendChild(note);
    await note.ready;
    assert.equal(note.shadowRoot, null);
    assert.match(note.querySelector(".body").textContent, /Body text/);
  });

  test("vs-icon renders a Lucide icon", async () => {
    const icon = await mount("vs-icon");
    icon.icon = "lucide:house";
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(icon.shadowRoot.querySelector("svg"));
  });

  test("components can't take the reserved vs- prefix", async () => {
    await assert.throws(() => Viraspa.core.defineComponent(class extends Viraspa.core.Component { static tag = "vs-test-thing"; }), /reserved/);
  });

  test("a component's effects stop when it leaves the page", async () => {
    const card = await mount("vs-card", { heading: "x" });
    const n = Viraspa.state.signal(0);
    let runs = 0;
    card.effect(() => {
      n.value;
      runs++;
    });
    card.remove();
    await new Promise((r) => setTimeout(r, 0));
    n.value = 1;
    assert.equal(runs, 1);
  });
})();
