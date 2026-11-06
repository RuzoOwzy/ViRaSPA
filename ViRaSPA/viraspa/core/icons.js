(function (Viraspa) {
  // Icons are described by an object, so where an icon comes from is
  // always explicit:
  //   { set: "fontawesome", name: "house", style: "solid" }  (solid | regular | brands)
  //   { set: "lucide", name: "house" }
  //   { set: "char", text: "★" }                     a character or emoji
  //   { set: "svg", src: "app/assets/icons/logo.svg" } an SVG file, inlined
  //   { set: "image", src: "app/assets/icons/logo.png" }
  // In HTML the short form "set:name[:style]" works too:
  //   <vs-icon icon="lucide:house"></vs-icon>
  //   <vs-icon icon="fontawesome:github:brands" label="GitHub"></vs-icon>
  // Libraries are self-hosted in lib/ (offline-friendly). Point a set
  // elsewhere with Viraspa.icons.configure("lucide", { folder: "..." }), or
  // add a new set with Viraspa.icons.register(name, provider).

  const settings = {
    fontawesome: { stylesheet: "lib/fontawesome/7.3.1/css/all.min.css", defaultStyle: "solid" },
    lucide: { folder: "lib/lucide/1.70.0/icons" },
  };
  const providers = new Map();
  const texts = new Map(); // url -> Promise<string>

  function fetchTextOnce(url) {
    if (!texts.has(url)) {
      const pending = Viraspa.utility.assetLoader.fetchText(url);
      pending.catch(() => texts.delete(url));
      texts.set(url, pending);
    }
    return texts.get(url);
  }

  // "lucide:house" / "fontawesome:github:brands" / object -> object.
  function parse(icon) {
    if (!icon) return null;
    if (typeof icon === "object") return { ...icon };
    const text = String(icon).trim();
    if (text.startsWith("{")) {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }
    const [set, name, style] = text.split(":");
    if (set === "char") return { set, text: text.slice(5) };
    if (set === "svg" || set === "image") return { set, src: text.slice(set.length + 1) };
    return name ? { set, name, style } : null;
  }

  function svgElement(markup) {
    const template = document.createElement("template");
    template.innerHTML = markup.trim();
    const svg = template.content.querySelector("svg");
    if (!svg) return null;
    // Size and colour come from CSS (1em, currentColor), not the file.
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    for (const el of svg.querySelectorAll("script, foreignObject")) el.remove();
    return svg;
  }

  // ---- Font Awesome ------------------------------------------------------
  // Its @font-face rules only work at document level, so the stylesheet is
  // linked into the page once; its icon classes are also adopted into each
  // icon's shadow root.
  let faSheet = null;
  function fontAwesomeSheet() {
    if (!faSheet) {
      const href = settings.fontawesome.stylesheet;
      Viraspa.utility.assetLoader.loadStyle(href);
      faSheet = Viraspa.utility.assetLoader.fetchStyleText(href).then((css) => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css.replace(/@font-face\s*\{[^}]*\}/g, ""));
        return sheet;
      });
      faSheet.catch(() => (faSheet = null));
    }
    return faSheet;
  }

  providers.set("fontawesome", {
    async render(icon, root) {
      const sheet = await fontAwesomeSheet();
      if (root.adoptedStyleSheets && !root.adoptedStyleSheets.includes(sheet)) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      }
      const el = document.createElement("i");
      el.className = `fa-${icon.style || settings.fontawesome.defaultStyle} fa-${icon.name}`;
      el.setAttribute("aria-hidden", "true");
      return el;
    },
  });

  providers.set("lucide", {
    async render(icon) {
      const markup = await fetchTextOnce(`${settings.lucide.folder}/${icon.name}.svg`);
      return svgElement(markup);
    },
  });

  providers.set("char", {
    render(icon) {
      const el = document.createElement("span");
      el.className = "vs-icon-char";
      el.textContent = icon.text || icon.name || "";
      el.setAttribute("aria-hidden", "true");
      return el;
    },
  });

  providers.set("svg", {
    async render(icon) {
      return svgElement(await fetchTextOnce(icon.src));
    },
  });

  providers.set("image", {
    render(icon) {
      const img = document.createElement("img");
      img.src = icon.src;
      img.alt = "";
      return img;
    },
  });

  // Renders `icon` into `root` (usually a vs-icon's shadow root). Resolves
  // with the element, or null (with a console warning) if it can't.
  async function render(icon, root) {
    const parsed = parse(icon);
    const provider = parsed && providers.get(parsed.set);
    if (!provider) {
      console.warn(`Unknown icon ${JSON.stringify(icon)}: use { set, name } with set ${[...providers.keys()].join(" | ")}.`);
      return null;
    }
    try {
      return (await provider.render(parsed, root)) || null;
    } catch (err) {
      console.warn(`Icon ${JSON.stringify(parsed)} could not be loaded:`, err.message);
      return null;
    }
  }

  // provider: { render(icon, root) -> Element | Promise<Element> }
  function register(set, provider) {
    if (providers.has(set)) throw new Error(`Icon set "${set}" is already registered.`);
    if (!provider || typeof provider.render !== "function") throw new Error("An icon provider needs a render(icon, root) function.");
    providers.set(set, provider);
  }

  function configure(set, options) {
    if (!settings[set]) throw new Error(`Icon set "${set}" has no settings to configure.`);
    Object.assign(settings[set], options);
    if (set === "fontawesome") faSheet = null;
  }

  Viraspa.icons = { parse, render, register, configure, sets: () => [...providers.keys()] };
})(window.Viraspa);
