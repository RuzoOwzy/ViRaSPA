// Rules for ViRaSPA manifests (framework-viraspa.json,
// component-viraspa.json, extension-viraspa.json): version comparison,
// framework-version compatibility, reserved names and field checks.
// Shared by the browser (Viraspa.manifestRules) and the node tools
// (require("<site>/viraspa/core/manifest-rules.js")), so both judge a
// manifest the same way.
(function (root, factory) {
  const rules = factory();
  if (typeof module === "object" && module.exports) module.exports = rules;
  else root.Viraspa.manifestRules = rules;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // Names only the framework and its official components may use.
  const RESERVED = Object.freeze({
    tagPrefixes: ["vs", "viraspa"], // vs-*, viraspa-* elements
    eventPrefix: "viraspa:", // viraspa:* events
    cssVariablePrefix: "--vs-", // --vs-* theme variables (extensions may read, not define them)
    namespace: "Viraspa", // window.Viraspa.*
  });

  const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;
  const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  const TAG = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;

  function parseVersion(text) {
    const match = VERSION.exec(String(text || "").trim());
    return match ? match.slice(1).map(Number) : null;
  }

  // -1, 0 or 1; throws on an invalid version.
  function compareVersions(a, b) {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    if (!pa || !pb) throw new Error(`Invalid version "${pa ? b : a}" (expected x.y.z).`);
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
    return 0;
  }

  // frameworkVersion: { min?, max?, supported?: [], excluded?: [] }
  // Precedence: excluded > supported > min/max. A missing min or max means
  // no limit on that side. Only `supported` given: only those versions.
  // Nothing given: any version, with a warning.
  // Returns { ok, reason, warning }.
  function checkFrameworkVersion(rule, version) {
    const r = rule || {};
    const excluded = r.excluded || [];
    const supported = r.supported || [];
    const hasRange = r.min !== undefined || r.max !== undefined;
    if (excluded.some((v) => compareVersions(v, version) === 0)) {
      return { ok: false, reason: `framework ${version} is explicitly excluded` };
    }
    if (supported.some((v) => compareVersions(v, version) === 0)) return { ok: true };
    if (!hasRange) {
      if (supported.length) return { ok: false, reason: `framework ${version} is not in the supported list (${supported.join(", ")})` };
      return { ok: true, warning: "no frameworkVersion rule: compatibility is not declared" };
    }
    if (r.min !== undefined && compareVersions(version, r.min) < 0) return { ok: false, reason: `needs framework ${r.min} or newer (this is ${version})` };
    if (r.max !== undefined && compareVersions(version, r.max) > 0) return { ok: false, reason: `needs framework ${r.max} or older (this is ${version})` };
    return { ok: true };
  }

  function isReservedTag(tag) {
    return RESERVED.tagPrefixes.some((prefix) => tag === prefix || tag.startsWith(`${prefix}-`));
  }

  function checkPerson(person, where, errors) {
    if (person === undefined) return;
    if (!person || typeof person !== "object" || Array.isArray(person)) {
      errors.push(`${where} must be an object { name, email, website }.`);
      return;
    }
    if (!person.name || typeof person.name !== "string") errors.push(`${where}.name is required.`);
    for (const key of ["email", "website", "organization"]) {
      if (person[key] !== undefined && typeof person[key] !== "string") errors.push(`${where}.${key} must be text.`);
    }
    if (person.website && !/^https?:\/\//i.test(person.website)) errors.push(`${where}.website must start with http:// or https://.`);
  }

  // kind: "framework" | "component" | "extension".
  // options: { frameworkVersion, takenPrefixes: [] }
  // Returns { errors: [], warnings: [] } - any error means "reject".
  function validateManifest(kind, manifest, options = {}) {
    const errors = [];
    const warnings = [];
    const m = manifest || {};

    if (!NAME.test(m.name || "")) errors.push(`name "${m.name}" must be lowercase words joined by hyphens.`);
    if (!parseVersion(m.version)) errors.push(`version "${m.version}" must be x.y.z.`);
    if (!ISO_DATE.test(m.releaseDate || "")) errors.push(`releaseDate "${m.releaseDate}" must be an ISO date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss).`);
    checkPerson(m.author, "author", errors);
    if (m.contributors !== undefined) {
      if (!Array.isArray(m.contributors)) errors.push("contributors must be a list of { name, email, website }.");
      else m.contributors.forEach((person, i) => checkPerson(person, `contributors[${i}]`, errors));
    }
    if (m.files !== undefined && !Array.isArray(m.files)) errors.push("files must be a list of { path, checksum }.");

    if (kind !== "framework" && options.frameworkVersion) {
      try {
        const result = checkFrameworkVersion(m.frameworkVersion, options.frameworkVersion);
        if (!result.ok) errors.push(`not compatible: ${result.reason}.`);
        if (result.warning) warnings.push(result.warning);
      } catch (err) {
        errors.push(`frameworkVersion: ${err.message}`);
      }
    }

    if (kind === "component") {
      if (!TAG.test(m.tag || "") || !m.tag.startsWith("vs-")) errors.push(`tag "${m.tag}" must start with "vs-" (official components only).`);
      if (m.tag && m.name && m.tag !== m.name) errors.push(`tag "${m.tag}" must equal name "${m.name}".`);
      if (!m.script) errors.push("script (the component's .js file) is required.");
    }

    if (kind === "extension") {
      const prefix = m.tagPrefix || "";
      if (!/^[a-z][a-z0-9]*$/.test(prefix)) errors.push(`tagPrefix "${prefix}" must be lowercase letters and digits, e.g. "owzy".`);
      else if (isReservedTag(prefix)) errors.push(`tagPrefix "${prefix}" is reserved for ViRaSPA.`);
      else if ((options.takenPrefixes || []).includes(prefix)) errors.push(`tagPrefix "${prefix}" is already used by another extension.`);
      const components = m.components || [];
      if (!Array.isArray(components)) errors.push("components must be a list of { tag, script }.");
      else
        for (const c of components) {
          if (!TAG.test((c && c.tag) || "")) errors.push(`component tag "${c && c.tag}" is not a valid custom element name.`);
          else if (!c.tag.startsWith(`${prefix}-`)) errors.push(`component tag "${c.tag}" must start with "${prefix}-".`);
          if (!c || !c.script) errors.push(`component "${c && c.tag}" needs a script.`);
        }
    }

    return { errors, warnings };
  }

  // True when CSS text defines (not just uses) a reserved --vs-* variable.
  function definesReservedCssVariable(css) {
    return /--vs-[\w-]+\s*:/.test(String(css).replace(/\/\*[\s\S]*?\*\//g, "").replace(/var\(\s*--vs-[\w-]+/g, ""));
  }

  return Object.freeze({ RESERVED, parseVersion, compareVersions, checkFrameworkVersion, validateManifest, isReservedTag, definesReservedCssVariable });
});
