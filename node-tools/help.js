// help.js - lists the ViRaSPA node tools, one line each.
//   node node-tools/help.js
"use strict";

const fs = require("fs");
const path = require("path");

const tools = fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith(".js") && file !== "help.js")
  .sort()
  .map((file) => {
    const { tool } = require(path.join(__dirname, file));
    return tool;
  })
  .filter(Boolean);

const width = Math.max(...tools.map((tool) => tool.name.length)) + 2;
console.log("ViRaSPA node tools (run from the repository root):\n");
for (const tool of tools) console.log(`  ${tool.name.padEnd(width)}${tool.summary}`);
console.log("\nDetails for any tool: node node-tools/<tool> --help");
