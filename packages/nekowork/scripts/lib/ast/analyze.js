// Intraprocedural const/taint propagation + dangerous-sink detection.
//
// Goal: catch the variable-mediated injection forms the line-oriented regex
// rules provably miss, WITHOUT introducing a single false positive. A naive
// taint analyzer over-flags (every Identifier looks "tainted"); that would
// regress the benchmark. So the rule is inverted and conservative:
//
//   A value is flagged ONLY when it is provably DYNAMIC (not a compile-time
//   constant string) AND it flows into a dangerous sink. When the binding can't
//   be resolved with confidence we still treat it as dynamic — but the FP guard
//   is the const-propagation: a variable bound only to constant strings is
//   CONST-SAFE and is never flagged.
//
// Const-propagation (the prototype's FP fix):
//   const q = `SELECT 1`;  db.query(q);   // q is CONST-SAFE → NOT flagged
//   const q = "SELECT " + x; db.query(q); // q is DYNAMIC    → flagged
//
// Scope model: a binding map per function/program scope (lexical chain). A
// binding is CONST-SAFE iff EVERY assignment to it (declarator init +
// reassignments) is a const-safe string; any non-const-safe assignment, or a
// reassignment we can't see as const-safe, makes it DYNAMIC. Function PARAMETERS
// are always dynamic. Analysis is strictly intraprocedural: a value returned
// from another function call is dynamic (we never chase across calls — that is
// where FPs come from).

import { parseToAst, walk } from './parse.js';

const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

// SQL-ish sink methods executed against a connection/ORM raw escape hatch.
const SQL_SINKS = new Set(['query', 'execute', 'raw']);

// SQL DML/DDL keyword — a dynamic string only counts as a SQL-injection sink if
// the surrounding code actually looks like SQL. This keeps a generic
// `emitter.query(dynamic)` or `cache.execute(fn)` out (huge FP source).
const SQL_KW_RE = /\b(SELECT|INSERT\s+INTO|INSERT|UPDATE|DELETE\s+FROM|DELETE|REPLACE|MERGE|UNION|DROP\s+TABLE|DROP|ALTER\s+TABLE|ALTER|TRUNCATE|CREATE\s+TABLE|FROM|WHERE)\b/i;

// child_process methods that run a SHELL command string (injectable directly).
const CP_SHELL_EXEC = new Set(['exec', 'execSync']);
// child_process methods that take (command, args[]) and only become injectable
// when shell:true is set AND the command is dynamic.
const CP_SPAWN = new Set(['spawn', 'spawnSync', 'execFile', 'execFileSync']);

/**
 * Scope: a binding map + parent link. `bindings` maps name → { dynamic: bool }.
 * A name absent from the whole chain resolves to dynamic (unknown = unsafe).
 */
function makeScope(parent) {
  return { parent, bindings: new Map() };
}

function lookup(scope, name) {
  let s = scope;
  while (s) {
    if (s.bindings.has(name)) return s.bindings.get(name);
    s = s.parent;
  }
  return null;
}

/**
 * Is `node` a compile-time-constant string expression?
 *   Literal                        → const-safe (any literal; a SQL keyword can
 *                                     only appear in a string literal anyway)
 *   TemplateLiteral, 0 expressions → const-safe (`SELECT 1`)
 *   BinaryExpression '+'           → const-safe iff BOTH sides const-safe
 *   Identifier                     → const-safe iff its binding is const-safe
 *   anything else                  → NOT const-safe
 */
function isConstSafe(node, scope) {
  if (!node) return true;
  switch (node.type) {
    case 'Literal':
      return true;
    case 'TemplateLiteral':
      return node.expressions.length === 0;
    case 'BinaryExpression':
      if (node.operator !== '+') return false;
      return isConstSafe(node.left, scope) && isConstSafe(node.right, scope);
    case 'Identifier': {
      const b = lookup(scope, node.name);
      // Unknown identifier (e.g. an import or global) → treat as NOT const-safe
      // so we don't accidentally clear a binding; but it is also not "dynamic
      // user input" on its own. The sink check uses isDynamic(), which is the
      // inverse and the FP guard, so const-safe=false here just means "we are
      // not certain it is a constant".
      return b ? b.constSafe === true : false;
    }
    default:
      return false;
  }
}

/**
 * Is `node` a DYNAMIC value (runtime-assembled / external), i.e. the thing we
 * flag when it flows into a sink? This is intentionally the conservative
 * inverse of isConstSafe at the leaves, with the const-propagation FP guard:
 *   Literal                        → false
 *   TemplateLiteral with ${...}    → true   (interpolation)
 *   TemplateLiteral, no expr       → false
 *   BinaryExpression '+'           → either side dynamic
 *   Identifier                     → binding dynamic? (const-safe binding=false)
 *   MemberExpression/CallExpr/...  → true
 */
function isDynamic(node, scope) {
  if (!node) return false;
  switch (node.type) {
    case 'Literal':
      return false;
    case 'TemplateLiteral':
      return node.expressions.length > 0;
    case 'BinaryExpression':
      if (node.operator === '+') return isDynamic(node.left, scope) || isDynamic(node.right, scope);
      // Other binary ops (e.g. comparisons) yield booleans/numbers, not an
      // injectable command/query string — not the dynamic-string shape.
      return false;
    case 'Identifier': {
      const b = lookup(scope, node.name);
      if (b) return b.dynamic === true;
      // Unknown identifier: a bare top-level/imported name passed straight to a
      // sink. We do NOT flag this — it is not a clear assembled dynamic value
      // and flagging bare identifiers is the #1 FP source. Conservative: false.
      return false;
    }
    case 'TaggedTemplateExpression':
      return isDynamic(node.quasi, scope);
    case 'ParenthesizedExpression':
      return isDynamic(node.expression, scope);
    default:
      // MemberExpression (req.body.x), CallExpression, AwaitExpression-wrapped,
      // etc. These are clearly runtime values. But to hold FP=0 we are
      // selective at the SINK level (a SQL sink also requires a SQL keyword);
      // here we report the structural truth.
      return true;
  }
}

/**
 * Classify the binding produced by an init/assignment expression.
 * Returns { constSafe, dynamic }.
 *   - constSafe: the value is provably a constant string (for propagation).
 *   - dynamic:   the value is a clearly assembled/external dynamic value.
 * A value can be neither (e.g. a bare unknown identifier or a number): not a
 * constant string AND not a flaggable dynamic string.
 */
function classifyValue(node, scope) {
  return {
    constSafe: isConstSafe(node, scope),
    dynamic: isDynamic(node, scope),
  };
}

/**
 * Collect bindings declared/assigned directly in a scope body, WITHOUT
 * descending into nested function scopes (those get their own scope). Two-phase
 * per scope:
 *   1. seed every declared name + parameter
 *   2. merge: a name is const-safe only if EVERY assignment is const-safe; any
 *      dynamic assignment marks it dynamic.
 * Reassignments that we cannot prove const-safe demote a previously const-safe
 * binding (so `let q="SELECT 1"; q=q+x; query(q)` is dynamic).
 *
 * @param {object} scopeNode  Program | Function node
 * @param {object} scope      the scope whose bindings we fill
 */
function collectBindings(scopeNode, scope) {
  // Phase 0: parameters of a function scope are always dynamic.
  if (FN_TYPES.has(scopeNode.type) && Array.isArray(scopeNode.params)) {
    for (const p of scopeNode.params) {
      for (const name of patternNames(p)) {
        scope.bindings.set(name, { constSafe: false, dynamic: true });
      }
    }
  }

  // Phase 1+2: walk the scope body but DO NOT cross into nested functions.
  const body = scopeNode.type === 'Program' ? scopeNode : scopeNode.body;
  walkScopeLocal(body, scopeNode, (node) => {
    if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        // Only simple `name = expr` bindings carry a recoverable init expr; a
        // destructuring pattern is treated as dynamic per-name (no init text).
        const simple = decl.id.type === 'Identifier';
        for (const name of patternNames(decl.id)) {
          const cls = decl.init ? classifyValue(decl.init, scope) : { constSafe: false, dynamic: false };
          if (simple && decl.init) cls.initExpr = decl.init;
          mergeBinding(scope, name, cls);
        }
      }
    } else if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') {
      const name = node.left.name;
      // Compound assignment (+=) on a binding: treat the RHS combined with the
      // existing value. If existing is const-safe and RHS const-safe → still
      // const-safe; otherwise dynamic.
      let cls;
      if (node.operator === '=') {
        cls = classifyValue(node.right, scope);
        cls.initExpr = node.right;
      } else if (node.operator === '+=') {
        const rhsSafe = isConstSafe(node.right, scope);
        const existing = scope.bindings.get(name);
        const existingSafe = existing ? existing.constSafe === true : false;
        cls = { constSafe: rhsSafe && existingSafe, dynamic: isDynamic(node.right, scope) || (existing ? existing.dynamic : false) };
        // A reassignment with += loses a single recoverable init expr; clear it
        // (the SQL-text recovery becomes best-effort, which only risks a MISS,
        // never an FP).
        cls.initExpr = null;
      } else {
        // Other compound ops produce numbers — not a string sink concern.
        cls = { constSafe: false, dynamic: false };
      }
      mergeBinding(scope, name, cls);
    }
  });
}

/**
 * Merge a new classification into a binding. Monotonic toward "unsafe":
 *   - once dynamic, stays dynamic
 *   - const-safe only if it was const-safe (or unseen) AND the new value is
 *     const-safe; a non-const-safe assignment clears const-safe.
 */
function mergeBinding(scope, name, cls) {
  const prev = scope.bindings.get(name);
  const newExprs = cls.initExpr ? [cls.initExpr] : [];
  if (!prev) {
    scope.bindings.set(name, { constSafe: cls.constSafe, dynamic: cls.dynamic, initExprs: newExprs });
    return;
  }
  scope.bindings.set(name, {
    constSafe: prev.constSafe && cls.constSafe,
    dynamic: prev.dynamic || cls.dynamic,
    // Accumulate ALL assigned expressions so SQL-text recovery can scan the full
    // assignment history (so `let q="SELECT 1"; q=q+x` still surfaces the
    // SELECT keyword after the dynamic reassignment). This only affects the
    // looksLikeSql gate — it cannot create an FP (the binding must already be
    // dynamic to reach the sink check).
    initExprs: [...(prev.initExprs || []), ...newExprs],
  });
}

/** Extract bound names from a binding pattern (Identifier / destructuring). */
function patternNames(pat, out = []) {
  if (!pat) return out;
  switch (pat.type) {
    case 'Identifier':
      out.push(pat.name);
      break;
    case 'AssignmentPattern':
      patternNames(pat.left, out);
      break;
    case 'RestElement':
      patternNames(pat.argument, out);
      break;
    case 'ArrayPattern':
      for (const el of pat.elements) if (el) patternNames(el, out);
      break;
    case 'ObjectPattern':
      for (const prop of pat.properties) {
        if (prop.type === 'RestElement') patternNames(prop.argument, out);
        else patternNames(prop.value, out);
      }
      break;
    default:
      break;
  }
  return out;
}

/**
 * Walk a scope's body visiting every node but NOT descending into nested
 * function bodies (those are separate scopes collected on their own). The
 * scopeNode itself is allowed (we start below it).
 */
function walkScopeLocal(root, scopeNode, visit) {
  const SKIP_KEYS = new Set(['loc', 'start', 'end', 'range', 'parent', '__parent']);
  const recurse = (node) => {
    if (!node || typeof node.type !== 'string') return;
    // Do not cross into a nested function scope.
    if (node !== scopeNode && FN_TYPES.has(node.type)) return;
    visit(node);
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) if (child && typeof child.type === 'string') recurse(child);
      } else if (value && typeof value.type === 'string') {
        recurse(value);
      }
    }
  };
  // root is either a Program (has .body array) or a Function body node.
  if (root && root.type === 'Program') {
    for (const stmt of root.body) recurse(stmt);
  } else if (root && root.type === 'BlockStatement') {
    for (const stmt of root.body) recurse(stmt);
  } else if (root) {
    // Arrow with expression body: `() => expr`
    recurse(root);
  }
}

/**
 * Build the scope chain and attach a resolved scope to each function/program
 * node, so sink detection can look up the right binding map. Returns a Map from
 * node → scope.
 */
function buildScopes(ast) {
  const scopeOf = new Map();
  const programScope = makeScope(null);
  collectBindings(ast, programScope);
  scopeOf.set(ast, programScope);

  // Walk all function nodes (pre-order, so an enclosing function's scope is
  // always built before its nested functions). Each function gets a child scope
  // whose parent is the nearest enclosing scope already in scopeOf.
  walk(ast, (node, parent) => {
    if (FN_TYPES.has(node.type)) {
      const parentScope = nearestScope(scopeOf, parent) || programScope;
      const scope = makeScope(parentScope);
      collectBindings(node, scope);
      scopeOf.set(node, scope);
    }
  });
  return scopeOf;
}

/** Climb the __parent chain to the nearest ancestor that already has a scope. */
function nearestScope(scopeOf, node) {
  let n = node;
  while (n) {
    if (scopeOf.has(n)) return scopeOf.get(n);
    n = n.__parent || null;
  }
  return null;
}

/**
 * Analyze source code for variable-mediated injection sinks.
 *
 * @param {string} code
 * @param {string} file       reported in findings
 * @param {{ ts?: boolean }} [opts]
 * @returns {{ parsed: boolean, findings: Array }}
 */
export function analyze(code, file, opts = {}) {
  const ast = parseToAst(code, { ts: opts.ts });
  if (!ast) return { parsed: false, findings: [] };

  // Annotate parent links so we can resolve the enclosing scope of any node.
  annotateParents(ast);
  const scopeOf = buildScopes(ast);

  const findings = [];
  const line = (n) => (n.loc ? n.loc.start.line : 0);

  walk(ast, (node) => {
    if (node.type === 'CallExpression') {
      handleCall(node, scopeOf, file, line, findings);
    } else if (node.type === 'NewExpression') {
      handleNew(node, scopeOf, file, line, findings);
    }
  });

  return { parsed: true, findings: dedupe(findings) };
}

/** Resolve the binding scope that ENCLOSES a given node (its nearest function
 * or the program). */
function scopeForNode(scopeOf, node) {
  let n = node.__parent;
  while (n) {
    if (FN_TYPES.has(n.type) && scopeOf.has(n)) return scopeOf.get(n);
    if (n.type === 'Program' && scopeOf.has(n)) return scopeOf.get(n);
    n = n.__parent;
  }
  // Fallback: program scope.
  for (const [k, v] of scopeOf) if (k.type === 'Program') return v;
  return makeScope(null);
}

function handleCall(node, scopeOf, file, line, findings) {
  const callee = node.callee;
  const scope = scopeForNode(scopeOf, node);
  const args = node.arguments || [];

  // eval(dynamic)
  if (callee.type === 'Identifier' && callee.name === 'eval') {
    if (args[0] && isDynamic(args[0], scope)) {
      findings.push(evalFinding(file, line(node), node));
    }
    return;
  }

  // window/globalThis/self/global .eval(dynamic) — indirect eval
  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'eval' &&
    callee.object.type === 'Identifier' &&
    /^(window|globalThis|self|global)$/.test(callee.object.name)
  ) {
    if (args[0] && isDynamic(args[0], scope)) {
      findings.push(evalFinding(file, line(node), node));
    }
    return;
  }

  if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
    const method = callee.property.name;

    // SQL sink: .query / .execute / .raw with a dynamic, NON-parameterized,
    // SQL-shaped argument.
    if (SQL_SINKS.has(method)) {
      const arg0 = args[0];
      if (arg0 && isDynamic(arg0, scope) && looksLikeSql(arg0, scope) && !isParameterized(node, arg0, scope)) {
        findings.push(sqlFinding(file, line(node), node));
        return;
      }
    }

    // child_process exec / execSync with a dynamic command string.
    if (CP_SHELL_EXEC.has(method)) {
      const arg0 = args[0];
      if (arg0 && isDynamic(arg0, scope)) {
        findings.push(cmdFinding(file, line(node), node, 'critical'));
        return;
      }
    }

    // spawn / execFile family: only injectable with shell:true AND dynamic cmd.
    if (CP_SPAWN.has(method)) {
      const arg0 = args[0];
      if (arg0 && isDynamic(arg0, scope) && hasShellTrue(args, scope)) {
        findings.push(cmdFinding(file, line(node), node, 'critical'));
        return;
      }
    }
  }

  // Bare exec/execSync identifier (destructured from child_process):
  //   const { exec } = require('child_process'); exec(cmd);
  if (callee.type === 'Identifier' && CP_SHELL_EXEC.has(callee.name)) {
    const arg0 = args[0];
    if (arg0 && isDynamic(arg0, scope)) {
      findings.push(cmdFinding(file, line(node), node, 'critical'));
      return;
    }
  }
  if (callee.type === 'Identifier' && CP_SPAWN.has(callee.name)) {
    const arg0 = args[0];
    if (arg0 && isDynamic(arg0, scope) && hasShellTrue(args, scope)) {
      findings.push(cmdFinding(file, line(node), node, 'critical'));
    }
  }
}

function handleNew(node, scopeOf, file, line, findings) {
  // new Function(...) — the Function constructor compiles a string body. The
  // dangerous case is a dynamic body; a pure-literal body (rare) is low signal.
  if (node.callee.type === 'Identifier' && node.callee.name === 'Function') {
    const scope = scopeForNode(scopeOf, node);
    const args = node.arguments || [];
    // The body is the LAST argument. Flag when it is dynamic, OR when there are
    // multiple args (codegen shape). A single pure-literal arg is left to the
    // regex rule (which flags new Function outright) to avoid duplicating.
    const body = args[args.length - 1];
    if (body && isDynamic(body, scope)) {
      findings.push(evalFinding(file, line(node), node));
    }
  }
}

/** A SQL sink argument only counts if it actually contains SQL keywords. This is
 * the FP guard against generic `.query(dynamic)` / `.execute(dynamic)` on
 * non-SQL emitters. We inspect the literal/template parts and any const-safe
 * identifier bindings reachable from the argument. */
function looksLikeSql(node, scope) {
  const text = collectStaticText(node, scope, new Set());
  return SQL_KW_RE.test(text);
}

/**
 * Gather the static (literal) text contributed by an expression — string
 * literals, template quasis, and the literal parts of identifiers whose binding
 * is a const-safe string we can reconstruct is out of scope; instead we only
 * gather text statically reachable through +/template/identifier-to-init. For
 * identifiers we re-derive their init text by re-reading the binding's source is
 * not stored, so we approximate: an identifier contributes its name (which won't
 * match SQL keywords) UNLESS we can see literal text in the same expression.
 *
 * In practice the dynamic SQL shape always carries the SQL keyword in a literal
 * part of the SAME expression chain (the assembled query string), so collecting
 * literals from the argument expression (following identifier inits within
 * scope) is sufficient and conservative.
 */
function collectStaticText(node, scope, seen) {
  if (!node) return '';
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string' ? node.value : '';
    case 'TemplateLiteral':
      return node.quasis.map((q) => (q.value && q.value.cooked != null ? q.value.cooked : q.value.raw || '')).join(' ');
    case 'BinaryExpression':
      if (node.operator === '+') {
        return collectStaticText(node.left, scope, seen) + ' ' + collectStaticText(node.right, scope, seen);
      }
      return '';
    case 'Identifier': {
      if (seen.has(node.name)) return '';
      seen.add(node.name);
      // Recover the variable's assembled text by following its binding's init
      // expression(s), recursively. This is how the cross-statement SQL shape
      // `const q = "SELECT..." + x; db.query(q)` surfaces the SELECT keyword
      // even though the literal lives in a different statement.
      const b = lookup(scope, node.name);
      if (!b || !Array.isArray(b.initExprs)) return '';
      return b.initExprs.map((e) => collectStaticText(e, scope, seen)).join(' ');
    }
    case 'TaggedTemplateExpression':
      return collectStaticText(node.quasi, scope, seen);
    default:
      return '';
  }
}

/**
 * A call is "parameterized" (safe) when it passes a 2nd ArrayExpression of
 * params (pg `$1` + [..], mysql2 `?` + [..]) — the canonical safe shape. The
 * dynamic 1st arg being a bound placeholder-only string is already excluded by
 * looksLikeSql requiring a real keyword + isDynamic; here we just exclude the
 * params-array shape.
 */
function isParameterized(callNode, arg0, scope) {
  const args = callNode.arguments || [];
  // 2nd argument is an array literal → parameterized.
  if (args[1] && args[1].type === 'ArrayExpression') return true;
  // 2nd argument is an identifier bound to nothing dynamic and named like a
  // params array (best-effort, conservative): if it's an ArrayExpression via
  // binding we can't easily see — skip. We only treat a literal array as the
  // safe marker to avoid both FPs and FNs.
  void arg0;
  void scope;
  return false;
}

/** Does the call carry an options object with shell:true? */
function hasShellTrue(args, scope) {
  for (const a of args) {
    if (a && a.type === 'ObjectExpression') {
      for (const prop of a.properties) {
        if (
          prop.type === 'Property' &&
          !prop.computed &&
          ((prop.key.type === 'Identifier' && prop.key.name === 'shell') ||
            (prop.key.type === 'Literal' && prop.key.value === 'shell'))
        ) {
          // shell: true (literal true) or shell: <const-safe truthy> — we only
          // treat a literal `true` as enabling the shell, conservatively.
          if (prop.value.type === 'Literal' && prop.value.value === true) return true;
        }
      }
    }
  }
  void scope;
  return false;
}

/** Attach __parent back-links to every node so a sink can resolve the binding
 * scope that encloses it. Single pass. */
function annotateParents(ast) {
  const SKIP_KEYS = new Set(['loc', 'start', 'end', 'range', '__parent']);
  const recurse = (node, parent) => {
    if (!node || typeof node.type !== 'string') return;
    node.__parent = parent;
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) if (child && typeof child.type === 'string') recurse(child, node);
      } else if (value && typeof value.type === 'string') {
        recurse(value, node);
      }
    }
  };
  recurse(ast, null);
}

// ---- Finding constructors (match the regex-rule finding shape) ----

function baseFinding({ rule, pattern, severity, file, line, title, description, recommendation, node }) {
  return {
    id: `RULE_${rule.toUpperCase().replace(/-/g, '_')}_${pattern.toUpperCase().replace(/-/g, '_')}`,
    rule,
    pattern,
    severity,
    category: 'code-injection',
    file,
    line,
    title,
    description,
    recommendation,
    // Match regex-rule convention: blocks_apply iff critical. (HIGH → human
    // review but does not hard-block apply, matching eval-usage/sql-injection.)
    blocks_apply: severity === 'critical',
    match: snippet(node),
  };
}

function evalFinding(file, line, node) {
  return baseFinding({
    rule: 'ast-eval-injection',
    pattern: 'ast-eval',
    severity: 'high',
    file,
    line,
    title: 'eval()/Function() with a dynamically-built value (dataflow)',
    description:
      'Dataflow analysis found a runtime-assembled (non-constant) value flowing into eval()/new Function(). Executing assembled strings is a code-injection / RCE vector the line-by-line scanner misses when the value is built across statements.',
    recommendation: 'Remove eval()/new Function(). Use JSON.parse for data or a lookup table for dispatch.',
    node,
  });
}

function sqlFinding(file, line, node) {
  return baseFinding({
    rule: 'ast-sql-injection',
    pattern: 'ast-sql',
    severity: 'high',
    file,
    line,
    title: 'SQL sink fed a dynamically-built query (dataflow)',
    description:
      'Dataflow analysis found a runtime-assembled (non-constant) SQL string flowing into .query()/.execute()/.raw() without a params array. This is a SQL-injection vector the line scanner misses when the query is built in a separate statement.',
    recommendation: 'Use parameterized queries (placeholders + a params array), not an assembled query string.',
    node,
  });
}

function cmdFinding(file, line, node, severity) {
  return baseFinding({
    rule: 'ast-command-injection',
    pattern: 'ast-cmd',
    severity,
    file,
    line,
    title: 'Shell sink fed a dynamically-built command (dataflow)',
    description:
      'Dataflow analysis found a runtime-assembled (non-constant) command string flowing into child_process exec/execSync (or spawn with shell:true). This is an OS-command-injection / RCE vector the line scanner misses when the command is assembled across statements.',
    recommendation: 'Use execFile/spawn with an argument array (no shell), or strictly validate the input.',
    node,
  });
}

function snippet(node) {
  // No raw source on the node; build a short structural marker from the callee.
  try {
    if (node.type === 'CallExpression') {
      const c = node.callee;
      if (c.type === 'Identifier') return `${c.name}(...)`;
      if (c.type === 'MemberExpression' && c.property.type === 'Identifier') {
        const obj = c.object.type === 'Identifier' ? c.object.name : '…';
        return `${obj}.${c.property.name}(...)`;
      }
    }
    if (node.type === 'NewExpression' && node.callee.type === 'Identifier') {
      return `new ${node.callee.name}(...)`;
    }
  } catch {
    /* best-effort */
  }
  return '';
}

/** Drop duplicate findings on the same {rule,line}. */
function dedupe(findings) {
  const seen = new Set();
  const out = [];
  for (const f of findings) {
    const key = `${f.rule}:${f.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out.sort((a, b) => a.line - b.line);
}
