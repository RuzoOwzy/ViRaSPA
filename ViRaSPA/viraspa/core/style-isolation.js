(function (Viraspa) {
  // Applies a component's CSS according to its isolation mode:
  //   "full"   - Shadow DOM: the CSS (plus shared styles such as base.css)
  //              is adopted into the component's shadow root. Nothing leaks
  //              in or out, except inherited values and CSS variables.
  //   "scoped" - light DOM: the CSS is limited to the component's own
  //              elements, with @scope where the browser supports it and by
  //              prefixing every selector with the tag name otherwise. The
  //              component's styles don't leak out; page styles do reach in.
  //   "none"   - light DOM: the CSS is added to the page as it is.
  // In every mode, :host means the component element and ::slotted(x) means
  // slotted content, so one stylesheet works whichever mode the author picks.

  const sheets = new Map(); // href -> Promise<CSSStyleSheet>
  const injected = new Set(); // tags whose light-DOM <style> is in <head>
  const sharedStyles = new Map([["base", Viraspa.core.frameworkUrl("styles/base.css")]]);

  const supportsScope = typeof window.CSSScopeRule !== "undefined";

  // At-rules that may contain style rules (kept inside @scope / prefixed
  // inside); any other block at-rule (@keyframes, @font-face...) is left alone.
  const GROUP_RULE = /^@(media|supports|container|layer|document)\b/i;

  function stripComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, "");
  }

  function matchingBrace(css, open) {
    let depth = 0;
    let quote = null;
    for (let i = open; i < css.length; i++) {
      const ch = css[i];
      if (quote) {
        if (ch === "\\") i++;
        else if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) return i;
    }
    return css.length;
  }

  // Top-level pieces: { statement } for "@import ...;", or { prelude, body }.
  function parseBlocks(css) {
    const blocks = [];
    let i = 0;
    while (i < css.length) {
      const open = css.indexOf("{", i);
      const semi = css.indexOf(";", i);
      if (open === -1) {
        if (css.slice(i).trim()) blocks.push({ statement: css.slice(i).trim() });
        break;
      }
      if (semi !== -1 && semi < open) {
        blocks.push({ statement: css.slice(i, semi + 1).trim() });
        i = semi + 1;
        continue;
      }
      const close = matchingBrace(css, open);
      blocks.push({ prelude: css.slice(i, open).trim(), body: css.slice(open + 1, close) });
      i = close + 1;
    }
    return blocks;
  }

  function splitSelectors(list) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < list.length; i++) {
      const ch = list[i];
      if (ch === "(" || ch === "[") depth++;
      else if (ch === ")" || ch === "]") depth--;
      else if (ch === "," && depth === 0) {
        parts.push(list.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(list.slice(start));
    return parts.map((part) => part.trim()).filter(Boolean);
  }

  // ":host(.open) .x" -> "tag.open .x", ":host" -> "tag", ".x" -> "tag .x"
  function prefixSelector(selector, tag) {
    const sel = selector.replace(/::slotted\(([^)]*)\)/g, "$1");
    if (sel.startsWith(":host(")) {
      let depth = 0;
      for (let i = 5; i < sel.length; i++) {
        if (sel[i] === "(") depth++;
        else if (sel[i] === ")" && --depth === 0) return `${tag}${sel.slice(6, i)}${sel.slice(i + 1)}`;
      }
    }
    if (sel.startsWith(":host")) return `${tag}${sel.slice(5)}`;
    return `${tag} ${sel}`;
  }

  function prefixCss(css, tag) {
    return parseBlocks(css)
      .map((block) => {
        if (block.statement) return block.statement;
        if (GROUP_RULE.test(block.prelude)) return `${block.prelude}{${prefixCss(block.body, tag)}}`;
        if (block.prelude.startsWith("@")) return `${block.prelude}{${block.body}}`;
        const selectors = splitSelectors(block.prelude).map((s) => prefixSelector(s, tag));
        return `${selectors.join(", ")}{${block.body}}`;
      })
      .join("\n");
  }

  // Wraps the style rules in @scope, stopping at nested framework
  // components so a parent's rules don't reach into a child's elements.
  function scopeCss(css, tag) {
    const inside = [];
    const outside = [];
    for (const block of parseBlocks(css)) {
      if (block.statement) outside.push(block.statement);
      else if (block.prelude.startsWith("@") && !GROUP_RULE.test(block.prelude)) {
        outside.push(`${block.prelude}{${block.body}}`);
      } else inside.push(`${block.prelude}{${block.body}}`);
    }
    const body = inside
      .join("\n")
      .replace(/::slotted\(([^)]*)\)/g, "$1")
      .replace(/:host\(([^)]*)\)/g, ":scope:is($1)")
      .replace(/:host\b/g, ":scope");
    return `${outside.join("\n")}\n@scope (${tag}) to (:scope [data-vs-component]) {\n${body}\n}`;
  }

  function scopedCss(css, tag) {
    const clean = stripComments(css);
    return supportsScope ? scopeCss(clean, tag) : prefixCss(clean, tag);
  }

  function getSheet(href) {
    if (!sheets.has(href)) {
      const pending = Viraspa.utility.assetLoader.fetchStyleText(href).then((css) => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        return sheet;
      });
      pending.catch(() => sheets.delete(href));
      sheets.set(href, pending);
    }
    return sheets.get(href);
  }

  // Loads the component's stylesheet (if any) and applies it for its mode.
  // Extensions may read the --vs-* theme variables but not define them.
  async function allowedCss(Class, href) {
    const info = Viraspa.core.components.info(Class.tag);
    if (!info || info.source !== "extension") return true;
    const css = await Viraspa.utility.assetLoader.fetchStyleText(href).catch(() => "");
    if (!Viraspa.manifestRules.definesReservedCssVariable(css)) return true;
    console.error(`<${Class.tag}> (extension "${info.owner}"): ${href} defines --vs-* variables, which are reserved for ViRaSPA; its styles were not applied.`);
    return false;
  }

  async function apply(component) {
    const Class = component.constructor;
    let href = Class.folder ? `${Viraspa.core.pageLoader.basePath(Class.folder)}.css` : null;
    if (href && Class.hasStyles === false) href = null;
    if (href && !(await allowedCss(Class, href))) href = null;

    if (component.isolation === "full") {
      const names = Class.sharedStyles || [];
      const hrefs = names.map((name) => sharedStyles.get(name)).filter(Boolean);
      if (href) hrefs.push(href);
      const results = await Promise.allSettled(hrefs.map(getSheet));
      component.componentRoot.adoptedStyleSheets = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
      return;
    }

    if (!href || injected.has(Class.tag)) return;
    injected.add(Class.tag);
    try {
      const css = await Viraspa.utility.assetLoader.fetchStyleText(href);
      const style = document.createElement("style");
      style.dataset.vsStyles = Class.tag;
      style.textContent = component.isolation === "scoped" ? scopedCss(css, Class.tag) : css;
      document.head.appendChild(style);
    } catch (err) {
      injected.delete(Class.tag);
      console.warn(`Styles for <${Class.tag}> could not be loaded:`, err);
    }
  }

  // Makes a stylesheet available to "full" components by name, e.g.
  // registerSharedStyle("forms", "app/assets/forms.css"), then
  // `static sharedStyles = ["base", "forms"]`.
  function registerSharedStyle(name, href) {
    sharedStyles.set(name, href);
  }

  Viraspa.core = Viraspa.core || {};
  Viraspa.core.styleIsolation = { apply, scopedCss, prefixCss, registerSharedStyle, supportsScope };
})(window.Viraspa);
