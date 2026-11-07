(function (Viraspa) {
  // Viraspa.forms - everyday form work, on top of the browser's own
  // validation (required, min, max, pattern, type="email"...), for native
  // fields and form-associated components alike.
  //
  //   Viraspa.forms.markRequired(container)          a * after the label of each required field
  //   const { valid, invalid } = Viraspa.forms.validate(form)   focuses and explains the first problem
  //   Viraspa.forms.setReadOnly(container, true)     every field read-only (and back, exactly as before)
  //   const before = Viraspa.forms.snapshot(form); ... Viraspa.forms.isDirty(form, before)
  //   Viraspa.forms.values(form) / Viraspa.forms.fill(form, { name: "Amina" })
  //
  // Viraspa.forms.configure({ markRequired: true, messages: "inline" | "browser" })
  // markRequired: true marks every page when it is shown. Messages "inline"
  // show the problem under the field (data-error-message overrides the text).

  const settings = { markRequired: true, messages: "inline" };
  const FIELD = "input, select, textarea, [contenteditable='true'], [data-vs-component]";
  const t = (text) => (Viraspa.i18n ? Viraspa.i18n.t(text) : text);

  const isField = (el) => /^(input|select|textarea)$/i.test(el.localName) || (el.constructor && el.constructor.formAssociated) || el.isContentEditable;
  function fields(root) {
    const scope = typeof root === "string" ? document.querySelector(root) : root || document;
    return [...scope.querySelectorAll(FIELD)].filter((el) => isField(el) && el.type !== "hidden" && el.type !== "submit" && el.type !== "button");
  }

  // ---- required marks -------------------------------------------------------
  function labelFor(field) {
    if (field.labels && field.labels.length) return field.labels[0];
    if (field.id) {
      const label = (field.getRootNode() || document).querySelector(`label[for="${CSS.escape(field.id)}"]`);
      if (label) return label;
    }
    return field.closest("label");
  }

  function markRequired(root = document) {
    for (const field of fields(root)) {
      const required = field.required || field.hasAttribute("required");
      const label = labelFor(field);
      if (!label || field.getAttribute("data-required-mark") === "off") continue;
      const mark = label.querySelector(".vs-required-mark");
      if (required && !mark) {
        const span = document.createElement("span");
        span.className = "vs-required-mark";
        span.setAttribute("aria-hidden", "true"); // the field itself says "required"
        span.textContent = "*";
        label.appendChild(span);
      } else if (!required && mark) mark.remove();
    }
  }

  // ---- validation ------------------------------------------------------------
  function clearMessage(field) {
    field.removeAttribute("aria-invalid");
    const id = field.getAttribute("data-vs-error-id");
    if (id) {
      const box = document.getElementById(id);
      if (box) box.remove();
      field.removeAttribute("data-vs-error-id");
      const described = (field.getAttribute("aria-describedby") || "").split(/\s+/).filter((x) => x && x !== id);
      if (described.length) field.setAttribute("aria-describedby", described.join(" "));
      else field.removeAttribute("aria-describedby");
    }
  }

  let errorCount = 0;
  function showMessage(field, message) {
    clearMessage(field);
    field.setAttribute("aria-invalid", "true");
    const box = document.createElement("div");
    box.className = "vs-field-error";
    box.id = `vs-field-error-${++errorCount}`;
    box.textContent = message;
    field.setAttribute("data-vs-error-id", box.id);
    field.setAttribute("aria-describedby", `${field.getAttribute("aria-describedby") || ""} ${box.id}`.trim());
    field.insertAdjacentElement("afterend", box);
  }

  const messageOf = (field) => field.getAttribute("data-error-message") || field.validationMessage || t("Please check this field.");

  // { valid, invalid: [fields] }. Options: { focus: true, messages }.
  function validate(root, { focus = true, messages = settings.messages } = {}) {
    const invalid = [];
    for (const field of fields(root)) {
      if (field.disabled || typeof field.checkValidity !== "function") continue;
      if (field.checkValidity()) {
        clearMessage(field);
        continue;
      }
      invalid.push(field);
      if (messages === "inline") showMessage(field, messageOf(field));
      if (!field.dataset.vsValidateBound) {
        // The message goes away as soon as the field is fixed.
        field.dataset.vsValidateBound = "";
        const recheck = () => field.checkValidity() && clearMessage(field);
        field.addEventListener("input", recheck);
        field.addEventListener("change", recheck);
      }
    }
    if (invalid.length && focus) {
      invalid[0].focus();
      if (messages === "browser" && invalid[0].reportValidity) invalid[0].reportValidity();
    }
    return { valid: invalid.length === 0, invalid };
  }

  // ---- read-only mode -------------------------------------------------------
  // Text fields become readonly (still selectable and copyable); selects,
  // checkboxes, radios and buttons become disabled; components get a
  // `readonly` attribute. setReadOnly(root, false) restores each one exactly.
  function setReadOnly(root, on = true) {
    const scope = typeof root === "string" ? document.querySelector(root) : root;
    scope.toggleAttribute("data-readonly", on);
    const targets = [...fields(scope), ...scope.querySelectorAll("button:not([type=submit]):not([data-readonly-keep])")];
    for (const el of targets) {
      if (el.hasAttribute("data-readonly-keep")) continue;
      const usesReadOnly = /^(textarea)$/i.test(el.localName) || (el.localName === "input" && !/^(checkbox|radio|file|range|color|button|submit|reset)$/i.test(el.type));
      const property = usesReadOnly ? "readOnly" : el.constructor && el.constructor.formAssociated ? "readonly-attr" : "disabled";
      if (on) {
        if (el.dataset.vsReadonlyWas !== undefined) continue;
        el.dataset.vsReadonlyWas = property === "readonly-attr" ? String(el.hasAttribute("readonly")) : String(Boolean(el[property]));
        if (property === "readonly-attr") el.setAttribute("readonly", "");
        else el[property] = true;
      } else if (el.dataset.vsReadonlyWas !== undefined) {
        const was = el.dataset.vsReadonlyWas === "true";
        if (property === "readonly-attr") el.toggleAttribute("readonly", was);
        else el[property] = was;
        delete el.dataset.vsReadonlyWas;
      }
    }
  }

  // ---- values ---------------------------------------------------------------
  function valueOf(field) {
    if (field.type === "checkbox") return field.checked;
    if (field.type === "radio") return field.checked ? field.value : undefined;
    if (field.localName === "select" && field.multiple) return [...field.selectedOptions].map((o) => o.value);
    if (field.isContentEditable) return field.innerHTML;
    return field.value;
  }

  // An object of the form's values by name (several with one name: a list).
  function values(form) {
    const out = {};
    for (const field of fields(form)) {
      const name = field.name || field.getAttribute("name");
      if (!name || field.disabled) continue;
      const value = valueOf(field);
      if (value === undefined) continue;
      if (name in out && field.type !== "radio") out[name] = [].concat(out[name], value);
      else out[name] = value;
    }
    return out;
  }

  function fill(form, data) {
    for (const field of fields(form)) {
      const name = field.name || field.getAttribute("name");
      if (!name || !(name in data)) continue;
      const value = data[name];
      if (field.type === "checkbox") field.checked = Array.isArray(value) ? value.includes(field.value) : Boolean(value);
      else if (field.type === "radio") field.checked = String(value) === field.value;
      else if (field.localName === "select" && field.multiple) for (const o of field.options) o.selected = [].concat(value).map(String).includes(o.value);
      else field.value = value ?? "";
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // A copy of every field's value, to restore or compare later.
  function snapshot(root) {
    return new Map(fields(root).map((f) => [f, valueOf(f)]));
  }
  function restore(root, snap) {
    for (const [field, value] of snap) {
      if (!field.isConnected) continue;
      if (field.type === "checkbox") field.checked = value;
      else if (field.type === "radio") field.checked = value !== undefined;
      else if (field.localName === "select" && field.multiple) for (const o of field.options) o.selected = value.includes(o.value);
      else if (field.isContentEditable) field.innerHTML = value;
      else field.value = value;
    }
  }
  function isDirty(root, snap) {
    return fields(root).some((f) => JSON.stringify(valueOf(f)) !== JSON.stringify(snap.has(f) ? snap.get(f) : undefined));
  }

  function configure(options = {}) {
    Object.assign(settings, options);
  }

  document.addEventListener("viraspa:pageShown", (event) => {
    if (settings.markRequired) markRequired(event.target);
  });

  Viraspa.forms = { configure, fields, markRequired, validate, clearMessage, setReadOnly, values, fill, snapshot, restore, isDirty };
})(window.Viraspa);
