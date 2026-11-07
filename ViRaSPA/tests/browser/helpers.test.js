(function () {
  // The official helpers the sample installs (forms, data-entry, filter, tooltip).
  const { test, assert, render } = Viraspa.testing;
  const enter = (target, init = {}) => {
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, composed: true, ...init });
    target.dispatchEvent(event);
    return event;
  };

  test("forms: required marks, inline messages, values and read-only mode", () => {
    const { element } = render('<form><label for="f-name">Name</label><input id="f-name" name="name" required><label for="f-qty">Qty</label><input id="f-qty" name="qty" type="number" min="1" value="0"><select name="kind"><option>a</option><option selected>b</option></select><input type="checkbox" name="paid" checked></form>');
    const form = element.querySelector("form");
    Viraspa.forms.markRequired(form);
    assert.equal(form.querySelectorAll(".vs-required-mark").length, 1);
    const result = Viraspa.forms.validate(form);
    assert.equal(result.valid, false);
    assert.equal(result.invalid.length, 2);
    assert.equal(document.activeElement, form.elements.name, "the first problem gets focus");
    assert.equal(form.elements.name.getAttribute("aria-invalid"), "true");
    assert.ok(form.querySelector(".vs-field-error"));
    form.elements.name.value = "Amina";
    form.elements.name.dispatchEvent(new Event("input"));
    assert.equal(form.elements.name.getAttribute("aria-invalid"), null, "the message goes once fixed");
    assert.deepEqual(Viraspa.forms.values(form), { name: "Amina", qty: "0", kind: "b", paid: true });
    const before = Viraspa.forms.snapshot(form);
    form.elements.qty.value = "3";
    assert.ok(Viraspa.forms.isDirty(form, before));
    Viraspa.forms.restore(form, before);
    assert.ok(!Viraspa.forms.isDirty(form, before));
    form.elements.kind.disabled = false;
    Viraspa.forms.setReadOnly(form, true);
    assert.ok(form.elements.name.readOnly && form.elements.kind.disabled && form.elements.paid.disabled);
    Viraspa.forms.setReadOnly(form, false);
    assert.ok(!form.elements.name.readOnly && !form.elements.kind.disabled && !form.elements.paid.disabled);
  });

  test("data-entry: Enter moves on (skipping read-only fields), Shift+Enter back, the end is announced", () => {
    const { element } = render('<form data-entry-mode><input id="de-a"><input id="de-b" readonly><select id="de-c"><option>x</option></select><textarea id="de-d"></textarea><input id="de-e"></form>');
    const $ = (id) => element.querySelector(`#${id}`);
    $("de-a").focus();
    assert.ok(enter($("de-a")).defaultPrevented);
    assert.equal(document.activeElement, $("de-c"), "the read-only field was skipped");
    enter($("de-c"), { shiftKey: true });
    assert.equal(document.activeElement, $("de-a"));
    $("de-d").focus();
    assert.ok(!enter($("de-d")).defaultPrevented, "Enter in a textarea is a new line");
    let ended = false;
    element.querySelector("form").addEventListener("vs-entry-end", () => (ended = true));
    $("de-e").focus();
    enter($("de-e"));
    assert.ok(ended);
  });

  test("data-entry: the developer's handler and data-enter=default win", () => {
    const { element } = render('<div data-entry-mode><input id="dx-a" data-enter="default"><input id="dx-b"><input id="dx-c"></div>');
    const $ = (id) => element.querySelector(`#${id}`);
    $("dx-a").focus();
    enter($("dx-a"));
    assert.equal(document.activeElement, $("dx-a"));
    $("dx-b").addEventListener("keydown", (e) => e.preventDefault());
    $("dx-b").focus();
    enter($("dx-b"));
    assert.equal(document.activeElement, $("dx-b"), "an app handler that prevented the key wins");
  });

  test("filter: accents and case ignored, empty message, event", () => {
    const { element } = render('<input class="q"><ul class="l"><li>Élodie Mushi</li><li>Amina Juma</li><li>Baraka</li></ul>');
    let detail = null;
    const list = element.querySelector(".l");
    list.addEventListener("vs-filter", (e) => (detail = e.detail));
    const filter = Viraspa.filter.bind(element.querySelector(".q"), list, { empty: "Nothing" });
    filter.apply("elodie");
    assert.deepEqual([...list.querySelectorAll("li:not([hidden])")].map((li) => li.textContent), ["Élodie Mushi"]);
    assert.equal(detail.shown, 1);
    filter.apply("zzz");
    assert.equal(list.querySelector(".vs-filter-empty").hidden, false);
    filter.dispose();
    assert.equal(list.querySelectorAll("li[hidden]").length, 0);
  });

  test("tooltip: shown for a data-tooltip element and linked for screen readers", () => {
    const { element } = render('<button data-tooltip="Save (Ctrl+S)">Save</button>');
    const button = element.querySelector("button");
    Viraspa.tooltip.show(button);
    const tip = document.querySelector(".vs-tooltip");
    assert.equal(tip.hidden, false);
    assert.equal(tip.textContent, "Save (Ctrl+S)");
    assert.equal(tip.getAttribute("role"), "tooltip");
    assert.equal(button.getAttribute("aria-describedby"), "vs-tooltip");
    Viraspa.tooltip.hide();
    assert.equal(tip.hidden, true);
    assert.equal(button.getAttribute("aria-describedby"), null);
  });
})();
