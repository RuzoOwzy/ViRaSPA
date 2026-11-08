(function () {
  // Media and editor (milestone N10).
  const { test, assert, render } = Viraspa.testing;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ready = async (element, selector) => {
    const el = element.querySelector(selector);
    await Viraspa.core.components.load(el.localName);
    await el.ready;
    return el;
  };
  const key = (target, init) => target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, composed: true, ...init }));
  const selectText = (node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  test("rich text editor: the sanitizer keeps safe, clean HTML", async () => {
    await Viraspa.core.components.load("vs-rich-text-editor");
    const S = customElements.get("vs-rich-text-editor").sanitize;
    assert.equal(S('<b>a</b><i>b</i><div>c</div>'), "<p><strong>a</strong><em>b</em></p><p>c</p>");
    assert.equal(S('<a href="javascript:alert(1)" onclick="x()">x</a>'), "<p><a>x</a></p>");
    assert.equal(S('<img src="x" onerror="y()" alt="z">'), '<p><img src="x" alt="z"></p>');
    assert.equal(S('<script>alert(1)</script><iframe src="https://e.com"></iframe>'), "");
    assert.equal(S('<ul><li>a</li><ul><li>b</li></ul></ul>'), "<ul><li>a<ul><li>b</li></ul></li></ul>");
    assert.match(S('<a href="https://e.com" target="_blank">e</a>'), /rel="noopener noreferrer"/);
    assert.equal(S('<span style="font-weight:700">B</span>'), "<p><strong>B</strong></p>");
    assert.equal(S('<p style="text-align:center;color:red">C</p>'), '<p style="text-align: center;">C</p>');
  });

  test("rich text editor: commands, value, form, limit and read-only", async () => {
    const { element } = render('<form><vs-rich-text-editor name="body" toolbar="full" maxlength="20" show-count></vs-rich-text-editor></form>');
    const ed = await ready(element, "vs-rich-text-editor");
    ed.value = "<p>Hello world</p>";
    const area = ed.querySelector(".vs-rte-area");
    area.focus();
    selectText(area.querySelector("p"));
    ed.run("bold");
    assert.match(ed.value, /<strong>Hello world<\/strong>|<p><strong>Hello world<\/strong><\/p>/);
    selectText(area.querySelector("p"));
    ed.run("bullets");
    assert.match(ed.value, /<ul><li>/);
    selectText(area.querySelector("li"));
    ed.run("clear");
    assert.ok(!/<strong>/.test(ed.value), "clear removes the bold");
    ed.value = "<p>Hello</p>";
    assert.equal(new FormData(element.querySelector("form")).get("body"), "<p>Hello</p>");
    assert.match(ed.querySelector(".vs-rte-status").textContent, /5 \/ 20/);
    ed.setAttribute("readonly", "");
    assert.equal(area.contentEditable, "false");
    assert.ok(ed.querySelector(".vs-rte-toolbar").hidden);
    ed.removeAttribute("readonly");
    assert.equal(ed.text, "Hello");
  });

  test("rich text editor: toolbar presets and on/off buttons", async () => {
    const { element } = render('<vs-rich-text-editor toolbar="minimal underline -link"></vs-rich-text-editor>');
    const ed = await ready(element, "vs-rich-text-editor");
    const names = [...ed.querySelectorAll("[data-button]")].map((b) => b.dataset.button);
    assert.deepEqual(names, ["bold", "italic", "bullets", "numbers", "underline"]);
    const toolbar = ed.querySelector(".vs-rte-toolbar");
    const first = toolbar.querySelector('[tabindex="0"]');
    first.focus();
    key(first, { key: "ArrowRight" });
    assert.equal(document.activeElement.dataset.button, "italic", "arrows move in the toolbar");
  });

  test("vs-media-viewer: opens items, moves between them, zooms, closes", async () => {
    const { element } = render("<vs-media-viewer></vs-media-viewer>");
    const v = await ready(element, "vs-media-viewer");
    await v.open([{ src: "app/assets/icons/favicon.svg", title: "One" }, { src: "file.pdf", title: "Two" }, { src: "file.docx" }], 0);
    assert.ok(v.dialog.open);
    assert.equal(v.dialog.dataset.kind, "image");
    key(v.dialog, { key: "+" });
    assert.ok(v.view.scale > 1);
    key(v.dialog, { key: "0" });
    assert.equal(v.view.scale, 1);
    key(v.dialog, { key: "ArrowRight" });
    assert.equal(v.dialog.dataset.kind, "pdf");
    key(v.dialog, { key: "End" });
    assert.equal(v.dialog.dataset.kind, "document");
    assert.ok(!v.shadowRoot.querySelector('iframe[src*="google"]'), "no external viewer unless allowed");
    key(v.dialog, { key: "Home" });
    const r = v.stage.getBoundingClientRect();
    const pointer = (type, x) => v.stage.dispatchEvent(new PointerEvent(type, { pointerId: 9, clientX: r.left + r.width * x, clientY: r.top + r.height / 2, bubbles: true }));
    pointer("pointerdown", 0.7);
    pointer("pointermove", 0.5);
    pointer("pointerup", 0.3);
    assert.equal(v.index, 1, "a swipe to the left shows the next item");
    v.close();
    assert.ok(!v.dialog.open);
  });

  test("vs-image-cropper: square crop by keyboard and output size", async () => {
    const { element } = render('<vs-image-cropper src="app/assets/icons/apple-touch-icon.png" aspect="1" output-width="64"></vs-image-cropper>');
    const c = await ready(element, "vs-image-cropper");
    for (let i = 0; i < 40 && !c.loaded; i++) await wait(50);
    assert.ok(c.loaded, "the image loaded");
    const before = c.crop;
    assert.equal(before.width, before.height);
    const frame = c.shadowRoot.querySelector(".crop");
    key(frame, { key: "ArrowRight", shiftKey: true });
    assert.ok(c.crop.x > before.x);
    key(frame, { key: "ArrowLeft", altKey: true });
    assert.ok(c.crop.width < before.width && c.crop.width === c.crop.height);
    const blob = await c.toBlob();
    assert.ok(blob && blob.type === "image/png");
    const img = new Image();
    img.src = c.toDataURL();
    await img.decode();
    assert.equal(img.naturalWidth, 64);
  });
})();
