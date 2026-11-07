// JavaScript and CSS helpers for bundle.js, built on one small tokenizer:
//
//   compactJs / compactCss  remove comments, indentation, trailing spaces,
//                           blank lines and repeated spaces - nothing else. No
//                           renaming and no rewriting, so the result reads like
//                           the source and behaves the same. Line breaks are
//                           kept (no automatic-semicolon surprises). Strings,
//                           template literals and regular expressions are
//                           copied untouched; /*! licence comments are kept.
//   topLevelDeclarations    the names a script declares at its top level (var,
//                           let, const, class, function), so a bundle knows
//                           when a file can be wrapped in its own error
//                           boundary without changing what it defines.
"use strict";

// Words after which a "/" starts a regular expression, not a division.
const BEFORE_EXPRESSION = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);
const isWordChar = (c) => /[A-Za-z0-9_$\u0080-￿]/.test(c);
const SPACES = " \t\f\v ﻿";

// Tokens: { type: "space" | "newline" | "comment" | "value" | "word" | "punct", text }.
// "value" covers strings, template literal pieces and regular expressions.
function tokenizeJs(source) {
  const src = String(source).replace(/\r\n?/g, "\n");
  const tokens = [];
  let i = 0;
  let last = { type: "start", text: "" }; // last significant token
  const templates = []; // brace depth inside each open ${ }

  const push = (type, text) => {
    tokens.push({ type, text });
    if (type !== "space" && type !== "newline" && type !== "comment") last = { type, text };
  };

  // Is a "/" here the start of a regular expression? When unsure, say yes:
  // a division read as a regex is only copied unchanged (safe), while a
  // regex read as a division could have "//" in it taken for a comment.
  const regexAllowed = () => (last.type === "value" ? false : last.type === "word" ? BEFORE_EXPRESSION.has(last.text) : true);

  function quoted(quote) {
    let j = i + 1;
    while (j < src.length && src[j] !== quote && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
    return src.slice(i, j + 1);
  }

  // Template text from `from` to the closing ` or the next ${.
  function templateChunk(from) {
    let j = from;
    while (j < src.length) {
      if (src[j] === "\\") j += 2;
      else if (src[j] === "`") return { end: j + 1, opens: false };
      else if (src[j] === "$" && src[j + 1] === "{") return { end: j + 2, opens: true };
      else j++;
    }
    return { end: src.length, opens: false };
  }

  function regex() {
    let j = i + 1;
    let inClass = false;
    while (j < src.length && src[j] !== "\n") {
      const c = src[j];
      if (c === "\\") j++;
      else if (c === "[") inClass = true;
      else if (c === "]") inClass = false;
      else if (c === "/" && !inClass) break;
      j++;
    }
    j++;
    while (j < src.length && /[a-z]/i.test(src[j])) j++;
    return src.slice(i, j);
  }

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "\n") {
      push("newline", "\n");
      i++;
    } else if (SPACES.includes(c)) {
      let j = i;
      while (j < src.length && SPACES.includes(src[j])) j++;
      push("space", src.slice(i, j));
      i = j;
    } else if (c === "/" && next === "/") {
      let j = i;
      while (j < src.length && src[j] !== "\n") j++;
      push("comment", src.slice(i, j));
      i = j;
    } else if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      push("comment", src.slice(i, stop));
      i = stop;
    } else if (c === "'" || c === '"') {
      const text = quoted(c);
      push("value", text);
      i += text.length;
    } else if (c === "`" || (c === "}" && templates.length && templates[templates.length - 1] === 0)) {
      if (c === "}") templates.pop();
      const chunk = templateChunk(i + 1);
      push("value", src.slice(i, chunk.end));
      if (chunk.opens) {
        templates.push(0);
        last = { type: "punct", text: "{" };
      }
      i = chunk.end;
    } else if (c === "/" && regexAllowed()) {
      const text = regex();
      push("value", text);
      i += text.length;
    } else if (isWordChar(c)) {
      let j = i;
      while (j < src.length && isWordChar(src[j])) j++;
      push("word", src.slice(i, j));
      i = j;
    } else {
      if (templates.length) {
        if (c === "{") templates[templates.length - 1]++;
        else if (c === "}") templates[templates.length - 1]--;
      }
      const text = (c === "+" || c === "-") && next === c ? c + c : c;
      push("punct", text);
      i += text.length;
    }
  }
  return tokens;
}

function compactJs(source) {
  let out = "";
  let space = false;
  let newline = false;
  for (const token of tokenizeJs(source)) {
    if (token.type === "space") {
      space = true;
      continue;
    }
    if (token.type === "newline") {
      newline = true;
      continue;
    }
    if (token.type === "comment") {
      if (token.text.startsWith("/*!")) {
        if (out && !out.endsWith("\n")) out += "\n";
        out += token.text;
        newline = true;
        space = false;
      } else if (token.text.startsWith("//") || token.text.includes("\n")) newline = true;
      else space = true;
      continue;
    }
    if (newline) {
      if (out && !out.endsWith("\n")) out += "\n";
    } else if (space && out && !out.endsWith("\n") && !out.endsWith(" ")) out += " ";
    space = newline = false;
    out += token.text;
  }
  return out.endsWith("\n") ? out : out + "\n";
}

// Top-level declarations (depth 0): [{ kind, name }]. Errs on the side of
// reporting one: a declaration missed would make wrapping unsafe.
const DECLARATION_WORDS = new Set(["var", "let", "const", "class", "function"]);
const EXPRESSION_BEFORE = new Set(["=", "(", ",", ":", "?", "!", "&", "|", "+", "-", "*", "/", "%", "<", ">", "~", "^", "[", "++", "--", "."]);

function topLevelDeclarations(source) {
  const found = [];
  let depth = 0;
  let prev = null; // last significant token
  const tokens = tokenizeJs(source).filter((t) => t.type !== "space" && t.type !== "newline" && t.type !== "comment");
  tokens.forEach((token, index) => {
    if (token.type === "punct") {
      if ("([{".includes(token.text)) depth++;
      else if (")]}".includes(token.text)) depth--;
    } else if (token.type === "word" && depth === 0 && DECLARATION_WORDS.has(token.text)) {
      const isExpression = prev && ((prev.type === "punct" && EXPRESSION_BEFORE.has(prev.text)) || (prev.type === "word" && BEFORE_EXPRESSION.has(prev.text)));
      if (!isExpression) {
        const next = tokens[index + 1];
        found.push({ kind: token.text, name: next && next.type === "word" ? next.text : "" });
      }
    }
    prev = token;
  });
  return found;
}

function compactCss(source) {
  const src = String(source).replace(/\r\n?/g, "\n");
  let out = "";
  let i = 0;
  let pendingSpace = false;
  let pendingNewline = false;
  function emit(text) {
    if (pendingNewline) {
      if (out && !out.endsWith("\n")) out += "\n";
    } else if (pendingSpace && out && !out.endsWith("\n") && !out.endsWith(" ")) out += " ";
    pendingSpace = pendingNewline = false;
    out += text;
  }
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") {
      pendingNewline = true;
      i++;
    } else if (c === " " || c === "\t") {
      pendingSpace = true;
      i++;
    } else if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      const comment = src.slice(i, stop);
      if (comment.startsWith("/*!")) {
        emit(comment);
        pendingNewline = true;
      } else pendingSpace = true;
      i = stop;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      emit(src.slice(i, j + 1));
      i = j + 1;
    } else {
      let j = i;
      while (j < src.length && !" \t\n'\"".includes(src[j]) && !(src[j] === "/" && src[j + 1] === "*")) j++;
      emit(src.slice(i, j));
      i = j;
    }
  }
  return out.endsWith("\n") ? out : out + "\n";
}

module.exports = { tokenizeJs, compactJs, compactCss, topLevelDeclarations };
