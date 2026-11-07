// Safe template expressions: what may appear inside {{ }}.
// A small parser - no eval or new Function, so it works under a strict
// Content Security Policy, and expressions can only reach the values the
// page or component gives them (never window, document or prototypes).
//
// Supported:
//   values      42  3.5  "text"  'text'  true  false  null  undefined  [1, 2]  { name: user.name }
//   names       cartCount  user.name  items[0]  row["code"]   (signals are read automatically)
//   operators   !  -  +  *  /  %  <  <=  >  >=  ==  !=  ===  !==  &&  ||  ??  a ? b : c
//   calls       formatTotal(cart)  user.fullName()  t("Hello {name}", { name: user.name })
//   pipes       amount | currency:"TZS"   createdAt | date:"invoiceDate"   name | upper
// Anything more complex belongs in a computed() in the page's JavaScript.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Viraspa.expressions = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const BLOCKED = new Set(["__proto__", "constructor", "prototype", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__"]);
  const PUNCTUATORS = ["===", "!==", "==", "!=", "<=", ">=", "&&", "||", "??", "(", ")", "[", "]", "{", "}", ".", ",", "?", ":", "!", "<", ">", "+", "-", "*", "/", "%", "|"];

  function tokenize(text) {
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(text[i + 1]))) {
        const match = /^(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?/.exec(text.slice(i));
        tokens.push({ type: "number", value: Number(match[0]) });
        i += match[0].length;
        continue;
      }
      if (ch === '"' || ch === "'") {
        let j = i + 1;
        let value = "";
        while (j < text.length && text[j] !== ch) {
          if (text[j] === "\\" && j + 1 < text.length) {
            const next = text[j + 1];
            value += { n: "\n", t: "\t", r: "\r" }[next] ?? next;
            j += 2;
          } else value += text[j++];
        }
        if (j >= text.length) throw new SyntaxError(`Unclosed string in "${text}".`);
        tokens.push({ type: "string", value });
        i = j + 1;
        continue;
      }
      if (/[A-Za-z_$]/.test(ch)) {
        const match = /^[A-Za-z_$][\w$]*/.exec(text.slice(i));
        tokens.push({ type: "name", value: match[0] });
        i += match[0].length;
        continue;
      }
      const punct = PUNCTUATORS.find((p) => text.startsWith(p, i));
      if (!punct) throw new SyntaxError(`Unexpected "${ch}" in "${text}".`);
      tokens.push({ type: "punct", value: punct });
      i += punct.length;
    }
    return tokens;
  }

  // ---- parser: builds a tree of small evaluator functions ---------------
  function parse(text) {
    const tokens = tokenize(text);
    let pos = 0;
    const peek = (value) => tokens[pos] && tokens[pos].type === "punct" && tokens[pos].value === value;
    const take = (value) => {
      if (peek(value)) {
        pos++;
        return true;
      }
      return false;
    };
    const expect = (value) => {
      if (!take(value)) throw new SyntaxError(`Expected "${value}" in "${text}".`);
    };

    function pipeExpr() {
      let node = conditional();
      while (peek("|")) {
        pos++;
        const name = tokens[pos++];
        if (!name || name.type !== "name") throw new SyntaxError(`Expected a pipe name after "|" in "${text}".`);
        const args = [];
        while (take(":")) args.push(conditional());
        const input = node;
        node = { kind: "pipe", name: name.value, input, args };
      }
      return node;
    }

    function conditional() {
      const test = nullish();
      if (!take("?")) return test;
      const yes = conditional();
      expect(":");
      const no = conditional();
      return { kind: "if", test, yes, no };
    }

    function binaryLevel(next, operators) {
      return function level() {
        let left = next();
        for (;;) {
          const op = operators.find((o) => peek(o));
          if (!op) return left;
          pos++;
          left = { kind: "binary", op, left, right: next() };
        }
      };
    }

    function unary() {
      for (const op of ["!", "-", "+"]) {
        if (take(op)) return { kind: "unary", op, arg: unary() };
      }
      return postfix();
    }

    const multiplicative = binaryLevel(unary, ["*", "/", "%"]);
    const additive = binaryLevel(multiplicative, ["+", "-"]);
    const relational = binaryLevel(additive, ["<=", ">=", "<", ">"]);
    const equality = binaryLevel(relational, ["===", "!==", "==", "!="]);
    const and = binaryLevel(equality, ["&&"]);
    const or = binaryLevel(and, ["||"]);
    const nullish = binaryLevel(or, ["??"]);

    function args() {
      const list = [];
      if (take(")")) return list;
      do list.push(pipeExpr());
      while (take(","));
      expect(")");
      return list;
    }

    function postfix() {
      let node = primary();
      for (;;) {
        if (take(".")) {
          const name = tokens[pos++];
          if (!name || name.type !== "name") throw new SyntaxError(`Expected a name after "." in "${text}".`);
          node = { kind: "member", object: node, key: { kind: "literal", value: name.value } };
        } else if (take("[")) {
          const key = pipeExpr();
          expect("]");
          node = { kind: "member", object: node, key };
        } else if (take("(")) {
          node = { kind: "call", callee: node, args: args() };
        } else return node;
      }
    }

    function primary() {
      const token = tokens[pos++];
      if (!token) throw new SyntaxError(`Unexpected end of "${text}".`);
      if (token.type === "number" || token.type === "string") return { kind: "literal", value: token.value };
      if (token.type === "name") {
        const literals = { true: true, false: false, null: null, undefined: undefined };
        if (Object.prototype.hasOwnProperty.call(literals, token.value)) return { kind: "literal", value: literals[token.value] };
        return { kind: "name", name: token.value };
      }
      if (token.value === "(") {
        const inner = pipeExpr();
        expect(")");
        return inner;
      }
      if (token.value === "[") {
        const items = [];
        if (!take("]")) {
          do items.push(pipeExpr());
          while (take(","));
          expect("]");
        }
        return { kind: "array", items };
      }
      if (token.value === "{") {
        const entries = [];
        if (!take("}")) {
          do {
            const key = tokens[pos++];
            if (!key || (key.type !== "name" && key.type !== "string")) throw new SyntaxError(`Expected a key in "${text}".`);
            if (take(":")) entries.push([key.value, pipeExpr()]);
            else entries.push([key.value, { kind: "name", name: key.value }]); // { name } shorthand
          } while (take(","));
          expect("}");
        }
        return { kind: "object", entries };
      }
      throw new SyntaxError(`Unexpected "${token.value}" in "${text}".`);
    }

    const tree = pipeExpr();
    if (pos < tokens.length) throw new SyntaxError(`Unexpected "${tokens[pos].value}" in "${text}".`);
    return tree;
  }

  // ---- evaluation -----------------------------------------------------
  // ctx: { scopes: [objects to look names up in, innermost first],
  //        unwrap(value) -> value (reads signals), pipe(name) -> fn }
  function safeKey(key) {
    const k = String(key);
    if (BLOCKED.has(k)) throw new Error(`"${k}" can't be used in a template expression.`);
    return k;
  }

  function lookup(name, ctx) {
    safeKey(name);
    for (const scope of ctx.scopes) {
      if (scope != null && name in Object(scope)) return { value: scope[name], owner: scope };
    }
    return { value: undefined, owner: undefined };
  }

  function evaluate(node, ctx) {
    const u = ctx.unwrap || ((v) => v);
    switch (node.kind) {
      case "literal":
        return node.value;
      case "name":
        return u(lookup(node.name, ctx).value);
      case "member": {
        const object = evaluate(node.object, ctx);
        if (object == null) return undefined;
        return u(object[safeKey(evaluate(node.key, ctx))]);
      }
      case "call": {
        let fn;
        let thisArg;
        if (node.callee.kind === "member") {
          thisArg = evaluate(node.callee.object, ctx);
          fn = thisArg == null ? undefined : thisArg[safeKey(evaluate(node.callee.key, ctx))];
        } else if (node.callee.kind === "name") {
          const found = lookup(node.callee.name, ctx);
          fn = found.value;
          thisArg = found.owner;
        } else fn = evaluate(node.callee, ctx);
        if (typeof fn !== "function") throw new Error("A template expression called something that isn't a function.");
        if (fn === Function || fn === eval) throw new Error("This function can't be called from a template.");
        return fn.apply(thisArg, node.args.map((a) => evaluate(a, ctx)));
      }
      case "unary": {
        const v = evaluate(node.arg, ctx);
        return node.op === "!" ? !v : node.op === "-" ? -v : +v;
      }
      case "binary": {
        if (node.op === "&&") return evaluate(node.left, ctx) && evaluate(node.right, ctx);
        if (node.op === "||") return evaluate(node.left, ctx) || evaluate(node.right, ctx);
        if (node.op === "??") return evaluate(node.left, ctx) ?? evaluate(node.right, ctx);
        const a = evaluate(node.left, ctx);
        const b = evaluate(node.right, ctx);
        switch (node.op) {
          case "+": return a + b;
          case "-": return a - b;
          case "*": return a * b;
          case "/": return a / b;
          case "%": return a % b;
          case "<": return a < b;
          case "<=": return a <= b;
          case ">": return a > b;
          case ">=": return a >= b;
          case "==": return a == b; // eslint-disable-line eqeqeq
          case "!=": return a != b; // eslint-disable-line eqeqeq
          case "===": return a === b;
          case "!==": return a !== b;
        }
        throw new Error(`Unknown operator ${node.op}`);
      }
      case "if":
        return evaluate(node.test, ctx) ? evaluate(node.yes, ctx) : evaluate(node.no, ctx);
      case "array":
        return node.items.map((item) => evaluate(item, ctx));
      case "object": {
        const out = {};
        for (const [key, value] of node.entries) out[safeKey(key)] = evaluate(value, ctx);
        return out;
      }
      case "pipe": {
        const fn = ctx.pipe && ctx.pipe(node.name);
        if (typeof fn !== "function") throw new Error(`Unknown pipe "${node.name}".`);
        return fn(evaluate(node.input, ctx), ...node.args.map((a) => evaluate(a, ctx)));
      }
    }
    throw new Error(`Unknown expression node ${node.kind}`);
  }

  const cache = new Map();

  // Parses once (cached) and returns (ctx) => value.
  function compile(text) {
    const source = String(text).trim();
    if (!cache.has(source)) {
      const tree = parse(source);
      cache.set(source, (ctx) => evaluate(tree, ctx));
    }
    return cache.get(source);
  }

  // The simplest form: a plain path such as "user.name" (used to bind
  // two-way inputs, which need a target to write to).
  const PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;
  const isPath = (text) => PATH.test(String(text).trim());

  // Finds {{ ... }} (and {{{ ... }}}) in text, respecting strings and braces
  // inside the expression. Returns [{ text } | { expr, raw }] parts.
  // "\{{" is a literal "{{".
  function splitTemplate(text) {
    const parts = [];
    let i = 0;
    let buffer = "";
    while (i < text.length) {
      if (text[i] === "\\" && text.startsWith("{{", i + 1)) {
        buffer += "{{";
        i += 3;
        continue;
      }
      if (!text.startsWith("{{", i)) {
        buffer += text[i++];
        continue;
      }
      const raw = text.startsWith("{{{", i);
      let j = i + (raw ? 3 : 2);
      let depth = 0;
      let quote = null;
      let end = -1;
      for (; j < text.length; j++) {
        const ch = text[j];
        if (quote) {
          if (ch === "\\") j++;
          else if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === "{") depth++;
        else if (ch === "}") {
          if (depth > 0) depth--;
          else if (text.startsWith(raw ? "}}}" : "}}", j)) {
            end = j;
            break;
          }
        }
      }
      if (end < 0) {
        buffer += text.slice(i);
        break;
      }
      if (buffer) parts.push({ text: buffer });
      buffer = "";
      parts.push({ expr: text.slice(i + (raw ? 3 : 2), end).trim(), raw });
      i = end + (raw ? 3 : 2);
    }
    if (buffer) parts.push({ text: buffer });
    return parts;
  }

  return { compile, evaluate, parse, tokenize, isPath, splitTemplate };
});
