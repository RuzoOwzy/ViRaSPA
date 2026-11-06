// The option reader every ViRaSPA node tool uses, so all tools behave the
// same way:
//
//   * Each tool reads its own section of app/project-viraspa.json, e.g.
//     serve.js reads "devServer". A flag is that section's key in
//     kebab-case: devServer.port <-> --port, prerender.outputFolder <->
//     --output-folder. Flags are generated from the keys, so they can't drift.
//   * Precedence: command-line flag > environment variable > config file >
//     built-in default. Flags apply to that run only; --save writes them
//     into the config file.
//   * Every tool has --help (-h) and --version.
"use strict";

const path = require("path");
const site = require("./site");

const kebab = (key) => key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);

// Edit distance, for "did you mean" suggestions on mistyped flags.
function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

const COMMON_OPTIONS = [
  {
    key: "siteFolder",
    type: "path",
    env: "VIRASPA_SITE_FOLDER",
    configurable: false,
    description: "The served folder (the one containing app/project-viraspa.json). Found automatically when omitted.",
  },
];

function convert(option, raw, source) {
  if (option.type === "number") {
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`--${kebab(option.key)} needs a number (got "${raw}" from ${source}).`);
    return value;
  }
  if (option.type === "boolean") {
    if (typeof raw === "boolean") return raw;
    if (/^(true|1|yes)$/i.test(raw)) return true;
    if (/^(false|0|no)$/i.test(raw)) return false;
    throw new Error(`--${kebab(option.key)} needs true or false (got "${raw}" from ${source}).`);
  }
  if (option.choices && !option.choices.includes(raw)) {
    throw new Error(`--${kebab(option.key)} must be one of: ${option.choices.join(", ")} (got "${raw}" from ${source}).`);
  }
  return raw;
}

function defineTool(definition) {
  const tool = {
    commands: [],
    examples: [],
    ...definition,
    options: [...(definition.options || []), ...COMMON_OPTIONS],
  };

  function helpText() {
    const lines = [];
    lines.push(`${tool.name} — ${tool.summary}`, "");
    if (tool.description) lines.push(...tool.description.split("\n"), "");
    lines.push(`Usage:  ${tool.usage}`, "");
    if (tool.commands.length) {
      lines.push("Commands");
      const width = Math.max(...tool.commands.map((c) => c.name.length)) + 2;
      for (const command of tool.commands) lines.push(`  ${command.name.padEnd(width)}${command.description}`);
      lines.push("");
    }
    const rows = tool.options.map((option) => {
      const flag = `--${kebab(option.key)}${option.type === "boolean" ? "" : ` <${option.valueName || option.type || "value"}>`}`;
      const configKey = option.configurable === false ? "(none)" : `${tool.configSection}.${option.key}`;
      const env = option.env || "(none)";
      const def = option.default === undefined ? (option.key === "siteFolder" ? "auto-detected" : "(none)") : String(option.default);
      return { flag, configKey, env, def, description: option.description };
    });
    rows.push({ flag: "--save", configKey: "", env: "", def: "", description: "Write the flags given in this run into app/project-viraspa.json." });
    rows.push({ flag: "--help, -h", configKey: "", env: "", def: "", description: "Show this help." });
    rows.push({ flag: "--version", configKey: "", env: "", def: "", description: "Show the tool and framework versions." });
    const w = {
      flag: Math.max(4, ...rows.map((r) => r.flag.length)) + 2,
      configKey: Math.max(10, ...rows.map((r) => r.configKey.length)) + 2,
      env: Math.max(11, ...rows.map((r) => r.env.length)) + 2,
    };
    lines.push(`  ${"Flag".padEnd(w.flag)}${"Config key".padEnd(w.configKey)}${"Environment".padEnd(w.env)}Default`);
    for (const r of rows) {
      lines.push(`  ${r.flag.padEnd(w.flag)}${r.configKey.padEnd(w.configKey)}${r.env.padEnd(w.env)}${r.def}`.trimEnd());
      lines.push(`      ${r.description}`);
    }
    lines.push("", `Precedence: flag > environment variable > config (app/project-viraspa.json, "${tool.configSection}" section) > default.`);
    if (tool.examples.length) {
      lines.push("", "Examples");
      for (const example of tool.examples) lines.push(`  ${example}`);
    }
    lines.push("", "All tools: node node-tools/help.js");
    return lines.join("\n");
  }

  // Parses argv; returns { command, args, options, sources, siteFolder, project }.
  // Prints help/version and exits when asked.
  function parse(argv = process.argv.slice(2)) {
    const flags = {};
    const positional = [];
    let save = false;

    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];
      if (arg === "--help" || arg === "-h" || arg === "/?") {
        console.log(helpText());
        process.exit(0);
      }
      if (arg === "--version") {
        flags.__version = true;
        continue;
      }
      if (arg === "--save") {
        save = true;
        continue;
      }
      if (!arg.startsWith("--")) {
        positional.push(arg);
        continue;
      }
      const [name, inlineValue] = arg.slice(2).split(/=(.*)/s);
      const negated = name.startsWith("no-");
      const option = tool.options.find((o) => kebab(o.key) === name || (negated && o.type === "boolean" && kebab(o.key) === name.slice(3)));
      if (!option) {
        const near = tool.options.map((o) => kebab(o.key)).filter((f) => distance(f, name) <= 2).map((f) => `--${f}`);
        throw new Error(`Unknown flag --${name}.${near.length ? ` Did you mean ${near.join(" or ")}?` : ""}`);
      }
      if (option.type === "boolean") {
        flags[option.key] = inlineValue !== undefined ? inlineValue : !negated;
      } else {
        const value = inlineValue !== undefined ? inlineValue : argv[++i];
        if (value === undefined || value.startsWith("--")) throw new Error(`--${name} needs a value.`);
        flags[option.key] = value;
      }
    }

    const siteFolderFlag = flags.siteFolder || process.env.VIRASPA_SITE_FOLDER;
    let siteFolder = null;
    let project = null;
    let siteError = null;
    try {
      siteFolder = site.findSiteFolder(siteFolderFlag);
      project = site.readProjectFile(siteFolder);
    } catch (err) {
      siteError = err;
    }

    if (flags.__version) {
      const fw = siteFolder ? site.frameworkVersion(siteFolder) : "unknown (no site folder found)";
      console.log(`${tool.name} (ViRaSPA node tools), framework ${fw}`);
      process.exit(0);
    }
    if (siteError && tool.needsSite !== false) throw siteError;

    const section = (project && project[tool.configSection]) || {};
    const options = {};
    const sources = {};
    for (const option of tool.options) {
      if (option.key === "siteFolder") {
        options.siteFolder = siteFolder;
        sources.siteFolder = flags.siteFolder ? "flag" : process.env.VIRASPA_SITE_FOLDER ? "environment" : "auto-detected";
        continue;
      }
      if (flags[option.key] !== undefined) {
        options[option.key] = convert(option, flags[option.key], "the command line");
        sources[option.key] = "flag";
      } else if (option.env && process.env[option.env] !== undefined && process.env[option.env] !== "") {
        options[option.key] = convert(option, process.env[option.env], `environment variable ${option.env}`);
        sources[option.key] = "environment";
      } else if (option.configurable !== false && section[option.key] !== undefined) {
        options[option.key] = convert(option, section[option.key], `${tool.configSection}.${option.key}`);
        sources[option.key] = "config";
      } else {
        options[option.key] = option.default;
        sources[option.key] = "default";
      }
    }

    if (save) {
      const toSave = tool.options.filter((o) => o.configurable !== false && sources[o.key] === "flag");
      if (!toSave.length) {
        console.log("--save: no flags to save.");
      } else {
        project[tool.configSection] = { ...section };
        for (const o of toSave) project[tool.configSection][o.key] = options[o.key];
        site.writeProjectFile(siteFolder, project);
        console.log(`Saved ${toSave.map((o) => `${tool.configSection}.${o.key}`).join(", ")} to ${site.projectFilePath(siteFolder)}.`);
      }
    }

    return { command: positional[0], args: positional.slice(1), options, sources, siteFolder, project };
  }

  // Runs main(parsed) with friendly error reporting.
  async function run(main) {
    try {
      await main(parse());
    } catch (err) {
      console.error(`Error: ${err.message}`);
      console.error(`Run "node node-tools/${tool.name} --help" for usage.`);
      process.exitCode = 1;
    }
  }

  return { ...tool, helpText, parse, run, relative: (p) => path.relative(process.cwd(), p) || "." };
}

module.exports = { defineTool, kebab };
