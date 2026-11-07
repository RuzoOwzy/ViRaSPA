(function () {
  // The basic official components (milestone N8), installed in the sample.
  const { test, assert, render } = Viraspa.testing;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ready = async (element, selector) => {
    const el = element.querySelector(selector);
    await Viraspa.core.components.load(el.localName);
    await el.ready;
    return el;
  };
  const key = (target, init) => target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, composed: true, ...init }));

  test("vs-input-number: formats, parses, steps, validates and joins its form", async () => {
    const { element } = render('<form><label for="n1">Amount</label><vs-input-number id="n1" name="amount" decimals="2" min="0" max="1000" value="1234.5"></vs-input-number></form>');
    const n = await ready(element, "vs-input-number");
    const input = n.shadowRoot.querySelector("input");
    assert.equal(input.value, "1,234.50");
    assert.equal(n.value, 1234.5);
    assert.equal(input.getAttribute("aria-label"), "Amount");
    assert.equal(n.parse("TZS 2.500,75"), 2500.75);
    assert.equal(n.parse("2,500"), 2500);
    assert.equal(n.parse("12.5"), 12.5);
    assert.equal(n.parse("1.234.567"), 1234567);
    assert.equal(n.parse(""), null);
    assert.equal(n.checkValidity(), false, "over max");
    n.value = 999.999;
    assert.equal(n.value, 1000);
    n.value = 10;
    key(input, { key: "ArrowUp" });
    assert.equal(n.value, 11);
    key(input, { key: "PageDown" });
    assert.equal(n.value, 1);
    assert.equal(new FormData(element.querySelector("form")).get("amount"), "1");
    assert.equal(n.checkValidity(), true);
    element.querySelector("form").reset();
    assert.equal(n.value, 1234.5);
  });

  test("vs-textarea: grows, counts and submits on its own key only", async () => {
    const { element } = render('<form><vs-textarea name="note" rows="2" maxlength="50" show-count></vs-textarea></form>');
    const ta = await ready(element, "vs-textarea");
    ta.value = "Hello";
    assert.equal(ta.shadowRoot.querySelector(".count").textContent, "5 / 50");
    assert.equal(new FormData(element.querySelector("form")).get("note"), "Hello");
    let submitted = 0;
    ta.addEventListener("vs-submit", (e) => {
      e.preventDefault();
      submitted++;
    });
    const area = ta.shadowRoot.querySelector("textarea");
    key(area, { key: "Enter", ctrlKey: true });
    assert.equal(submitted, 0, "no submit key by default");
    ta.keys = { submit: "ctrl+enter" };
    key(area, { key: "Enter", ctrlKey: true });
    assert.equal(submitted, 1);
  });

  test("vs-input-password: show/hide, strength, a real input for password managers", async () => {
    const { element } = render('<form><label for="pw1">Password</label><vs-input-password id="pw1" name="pw" strength></vs-input-password></form>');
    const pw = await ready(element, "vs-input-password");
    const input = element.querySelector("input#pw1");
    assert.ok(input, "the real input carries the id");
    assert.equal(input.name, "pw");
    assert.equal(input.type, "password");
    pw.value = "Tz-2026-Strong!";
    assert.equal(pw.strength, 3);
    pw.querySelector(".eye").click();
    assert.equal(input.type, "text");
    assert.equal(pw.querySelector(".eye").getAttribute("aria-pressed"), "true");
    assert.equal(new FormData(element.querySelector("form")).get("pw"), "Tz-2026-Strong!");
  });

  test("vs-select: options, choice by keyboard, multiple values in the form", async () => {
    const { element } = render('<form><vs-select name="region" required><option value="dar">Dar es Salaam</option><option value="aru">Arusha</option><option value="mbe">Mbeya</option></vs-select><vs-select name="tags" multiple><option value="a">A</option><option value="b">B</option></vs-select></form>');
    const [single, multi] = [...element.querySelectorAll("vs-select")];
    await Viraspa.core.components.load("vs-select");
    await single.ready;
    await multi.ready;
    assert.equal(single.checkValidity(), false);
    const control = single.shadowRoot.querySelector(".control");
    key(control, { key: "ArrowDown" });
    assert.ok(single.isOpen);
    key(control, { key: "ArrowDown" });
    key(control, { key: "Enter" });
    assert.equal(single.value, "aru");
    assert.ok(!single.isOpen);
    multi.value = ["a", "b"];
    const data = new FormData(element.querySelector("form"));
    assert.deepEqual(data.getAll("tags"), ["a", "b"]);
    assert.equal(data.get("region"), "aru");
    single.options = [{ value: "x", label: "X" }];
    assert.equal(single.value, "", "a value no longer in the options is dropped");
  });

  test("vs-select-search: searches through the handler and chooses", async () => {
    const { element } = render('<vs-select-search columns="phone" min-chars="1" debounce="10"></vs-select-search>');
    const el = await ready(element, "vs-select-search");
    let asked = 0;
    el.source = async ({ text }) => {
      asked++;
      return [{ id: 1, name: "Amina Juma", phone: "0712" }, { id: 2, name: "Baraka", phone: "0755" }].filter((p) => p.name.toLowerCase().includes(text.toLowerCase()));
    };
    const input = el.shadowRoot.querySelector("input");
    input.value = "am";
    input.dispatchEvent(new Event("input"));
    await wait(80);
    assert.equal(asked, 1);
    const rows = el.shadowRoot.querySelectorAll('[role="option"]');
    assert.equal(rows.length, 1);
    assert.match(rows[0].textContent, /0712/);
    key(input, { key: "Enter" });
    assert.equal(el.value, "1");
    assert.equal(el.item.name, "Amina Juma");
  });

  test("vs-input-date: parses typed dates, formats them, keeps ISO values", async () => {
    const { element } = render('<form><vs-input-date name="due" min="2026-01-01"></vs-input-date><vs-input-date name="m" type="month"></vs-input-date></form>');
    const [d, m] = [...element.querySelectorAll("vs-input-date")];
    await Viraspa.core.components.load("vs-input-date");
    await d.ready;
    await m.ready;
    const order = d.order().join(",");
    const typed = order.startsWith("month") ? "12/31/26" : order.startsWith("day") ? "31/12/26" : "2026/12/31";
    assert.equal(d.parse(typed), "2026-12-31");
    assert.equal(d.parse("2026-02-30"), null, "no such day");
    assert.equal(d.parse("2026-03-04"), "2026-03-04", "four-digit year first is always ISO");
    d.value = "2025-05-05";
    assert.equal(d.checkValidity(), false, "before min");
    d.value = "2026-07-09";
    assert.equal(new FormData(element.querySelector("form")).get("due"), "2026-07-09");
    m.value = "2026-07-15";
    assert.equal(m.value, "2026-07");
    d.isDateDisabled = (iso) => iso === "2026-07-10";
    d.value = "2026-07-10";
    assert.equal(d.checkValidity(), false);
  });

  test("vs-input-color: hex values, palette choice", async () => {
    const { element } = render('<form><vs-input-color name="c" value="#ABC"></vs-input-color></form>');
    const c = await ready(element, "vs-input-color");
    assert.equal(c.value, "#aabbcc");
    c.shadowRoot.querySelector(".control").click();
    const first = c.shadowRoot.querySelector(".pick");
    first.click();
    assert.equal(c.value, first.dataset.color);
    assert.equal(new FormData(element.querySelector("form")).get("c"), first.dataset.color);
  });

  test("vs-tabs: ARIA tabs with keyboard and lazy panels", async () => {
    const { element } = render('<vs-tabs><section label="One">1</section><section label="Two" lazy><template><b>two</b></template></section><section label="Off" disabled>3</section></vs-tabs>');
    const tabs = await ready(element, "vs-tabs");
    const buttons = tabs.shadowRoot.querySelectorAll('[role="tab"]');
    assert.equal(buttons.length, 3);
    assert.equal(buttons[0].getAttribute("aria-selected"), "true");
    let changed = null;
    tabs.addEventListener("vs-tab-change", (e) => (changed = e.detail.index));
    buttons[0].focus();
    key(buttons[0], { key: "ArrowRight" });
    assert.equal(tabs.selectedIndex, 1);
    assert.equal(changed, 1);
    assert.ok(tabs.querySelectorAll("section")[1].querySelector("b"), "lazy content created");
    key(buttons[1], { key: "ArrowRight" });
    assert.equal(tabs.selectedIndex, 0, "the disabled tab is skipped");
  });

  test("Viraspa.popup: confirm and prompt resolve with the answer", async () => {
    await Viraspa.core.components.load("vs-popup");
    const answer = Viraspa.popup.confirm("Delete?");
    await wait(100);
    const popup = [...document.querySelectorAll("vs-popup")].pop();
    assert.ok(popup.isOpen);
    popup.querySelector('[data-close="ok"]').click();
    assert.equal(await answer, true);
    const name = Viraspa.popup.prompt("Name", { value: "Amina" });
    await wait(100);
    const second = [...document.querySelectorAll("vs-popup")].pop();
    second.querySelector("[data-close]:not([data-close='ok'])").click();
    assert.equal(await name, null);
    assert.equal(document.querySelectorAll("vs-popup").length, 0, "quick popups remove themselves");
  });

  test("vs-progress and vs-countdown", async () => {
    const { element } = render('<vs-progress value="25" show-value></vs-progress><vs-countdown seconds="3725" format="{h}:{mm}:{ss}"></vs-countdown>');
    const p = await ready(element, "vs-progress");
    assert.equal(p.shadowRoot.querySelector(".progress").getAttribute("aria-valuenow"), "25");
    assert.match(p.shadowRoot.querySelector(".text").textContent, /25/);
    p.value = null;
    assert.ok(p.shadowRoot.querySelector(".progress").hasAttribute("data-indeterminate"));
    const c = await ready(element, "vs-countdown");
    assert.match(c.shadowRoot.querySelector(".time").textContent, /^1:0[12]:\d\d$/);
    assert.equal(c.format({ days: 2, hours: 3, minutes: 4, seconds: 5, totalSeconds: 183845 }), "51:04:05");
  });
})();
