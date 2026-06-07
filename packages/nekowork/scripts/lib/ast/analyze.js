// Inter-procedural (intra-module) const/taint propagation + dangerous-sink
// detection.
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
// are always dynamic.
//
// Inter-procedural upgrade (intra-module only — never crosses files):
//   1. Arg-sensitive local-function return-taint resolution. When a sink
//      argument is a CallExpression to a function DEFINED in this module
//      (FunctionDeclaration or const = FunctionExpression/Arrow), the function's
//      return expression(s) are evaluated with its params BOUND to the call
//      site's argument classifications, recovering both the dynamic flag and the
//      static SQL text. This makes
//        function build(x){ return "SELECT "+x } db.query(build(req.id))   // FLAG
//      while keeping
//        function build(){ return "SELECT 1" } db.query(build())          // clean
//        function id(x){ return x }            db.query(id("SELECT 1"))   // clean
//      The resolver is guarded by a visited-set (cycle guard) and a depth limit
//      (~6). Unknown / non-local calls stay structurally dynamic with NO
//      recovered text, so the SQL-keyword gate still protects against FPs. The
//      resolution is ADDITIVE: it can only turn a clean SQL sink into a finding
//      (by recovering SQL text from a helper) — it never clears an existing one.
//   2. Sink-alias resolution. A module binding `const X = <obj>.<sinkMethod>`
//      (query/execute/raw → sql alias; exec/execSync → shell alias), where X is a
//      simple const not reassigned, makes a later `X(arg)` call get the same
//      dynamic + SQL-keyword + parameterized treatment as the underlying sink.
//      `const run = console.log; run(...)` is NOT a sink (console.log is not a
//      tracked sink method).
//
// Both upgrades inherit the same FP guards (const-propagation, SQL-keyword gate,
// params-array exemption), so they hold the FP=0 benchmark gate.

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

// Inter-procedural resolution guards.
const IP_DEPTH_LIMIT = 6; // max local-call resolution depth (cycle/runaway guard)

/**
 * Collect LOCALLY-DEFINED functions by name (module + nested scopes; last wins,
 * matching JS hoisting/redeclaration for our conservative best-effort). A name
 * here resolves to a FunctionDeclaration node, or the FunctionExpression/Arrow
 * bound by `const f = () => …`. Used by the arg-sensitive return-taint resolver.
 *
 * @param {object} ast Program node
 * @returns {Map<string, object>} name → function node
 */
function collectLocalFns(ast) {
  const fns = new Map();
  walk(ast, (n) => {
    if (n.type === 'FunctionDeclaration' && n.id && n.id.type === 'Identifier') {
      fns.set(n.id.name, n);
    } else if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) {
        if (
          d.id.type === 'Identifier' &&
          d.init &&
          (d.init.type === 'FunctionExpression' || d.init.type === 'ArrowFunctionExpression')
        ) {
          fns.set(d.id.name, d.init);
        }
      }
    }
  });
  return fns;
}

/**
 * Collect SINK ALIASES: a module binding `const X = <obj>.<sinkMethod>` where
 * sinkMethod ∈ query/execute/raw (→ sql alias) or exec/execSync (→ shell alias).
 * Only a SIMPLE const Identifier binding that is NEVER reassigned qualifies (a
 * reassigned binding cannot be trusted to still point at the sink). A later
 * `X(arg)` call is then treated as the underlying sink. `const run=console.log`
 * is ignored (console.log is not a tracked sink method).
 *
 * @param {object} ast Program node
 * @returns {Map<string, {kind:'sql'|'shell', method:string}>}
 */
function collectSinkAliases(ast) {
  const candidates = new Map(); // name → {kind, method}
  const reassigned = new Set(); // names reassigned anywhere → disqualified
  walk(ast, (n) => {
    if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) {
        if (
          d.id.type === 'Identifier' &&
          d.init &&
          d.init.type === 'MemberExpression' &&
          d.init.property.type === 'Identifier' &&
          !d.init.computed
        ) {
          const method = d.init.property.name;
          // Only `const` declarations qualify (let/var can be reassigned to a
          // non-sink; const cannot be rebound).
          if (n.kind !== 'const') continue;
          if (SQL_SINKS.has(method)) candidates.set(d.id.name, { kind: 'sql', method });
          else if (CP_SHELL_EXEC.has(method)) candidates.set(d.id.name, { kind: 'shell', method });
        }
      }
    } else if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier') {
      reassigned.add(n.left.name);
    }
  });
  for (const name of reassigned) candidates.delete(name);
  return candidates;
}

/**
 * Collect the return expressions of a function node. For an arrow with an
 * expression body the body itself is the (single) return. For a block body we
 * gather every ReturnStatement argument, NOT descending into nested functions
 * (a nested closure's return is not this function's return value).
 *
 * @param {object} fn FunctionDeclaration | FunctionExpression | ArrowFunctionExpression
 * @returns {object[]} return-value expressions
 */
function returnsOf(fn) {
  if (fn.type === 'ArrowFunctionExpression' && fn.body.type !== 'BlockStatement') {
    return [fn.body];
  }
  const out = [];
  const recurse = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'ReturnStatement') {
      if (node.argument) out.push(node.argument);
      return;
    }
    // Do not descend into a NESTED function — its returns are not ours.
    if (FN_TYPES.has(node.type)) return;
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'range' || key === '__parent') continue;
      const v = node[key];
      if (Array.isArray(v)) {
        for (const c of v) if (c && typeof c.type === 'string') recurse(c);
      } else if (v && typeof v.type === 'string') {
        recurse(v);
      }
    }
  };
  recurse(fn.body);
  return out;
}

/**
 * Arg-sensitive evaluator: classify an expression's { dynamic, text } where
 * `text` is the recovered static string (used by the SQL-keyword gate). `env`
 * maps a parameter name → its already-computed { dynamic, text } at the call
 * site. This is the inter-procedural core: a CallExpression to a LOCAL function
 * is resolved by binding its params to the call arguments' classifications and
 * evaluating its return expression(s).
 *
 * Conservative leaves (mirror the prototype): a bare unknown Identifier and a
 * MemberExpression contribute NO text; an unknown/non-local call is structurally
 * dynamic with NO text (so the SQL-keyword gate still guards FPs).
 *
 * @param {object} node
 * @param {Map<string,{dynamic:boolean,text:string}>} env param bindings
 * @param {Map<string,object>} fns local-function map
 * @param {number} depth current recursion depth
 * @param {Set<string>} seen function names on the active call stack (cycle guard)
 * @returns {{dynamic:boolean, text:string}}
 */
function evalExpr(node, env, fns, depth, seen) {
  if (!node || depth > IP_DEPTH_LIMIT) return { dynamic: depth > IP_DEPTH_LIMIT, text: '' };
  switch (node.type) {
    case 'Literal':
      return { dynamic: false, text: typeof node.value === 'string' ? node.value : '' };
    case 'TemplateLiteral': {
      const text = node.quasis
        .map((q) => (q.value && q.value.cooked != null ? q.value.cooked : q.value.raw || ''))
        .join(' ');
      const dyn = node.expressions.some((e) => evalExpr(e, env, fns, depth + 1, seen).dynamic);
      return { dynamic: node.expressions.length > 0 && dyn, text };
    }
    case 'BinaryExpression': {
      if (node.operator !== '+') return { dynamic: false, text: '' };
      const l = evalExpr(node.left, env, fns, depth + 1, seen);
      const r = evalExpr(node.right, env, fns, depth + 1, seen);
      return { dynamic: l.dynamic || r.dynamic, text: l.text + ' ' + r.text };
    }
    case 'TaggedTemplateExpression':
      return evalExpr(node.quasi, env, fns, depth + 1, seen);
    case 'ParenthesizedExpression':
      return evalExpr(node.expression, env, fns, depth + 1, seen);
    case 'Identifier': {
      if (env.has(node.name)) return env.get(node.name);
      // Unknown bare identifier: conservative — not dynamic-flaggable, no text.
      return { dynamic: false, text: '' };
    }
    case 'CallExpression': {
      const callee = node.callee;
      const name = callee.type === 'Identifier' ? callee.name : null;
      if (name && fns.has(name) && !seen.has(name)) {
        const fn = fns.get(name);
        const argEnv = new Map();
        (fn.params || []).forEach((p, i) => {
          if (p.type === 'Identifier') {
            const arg = node.arguments[i];
            argEnv.set(
              p.name,
              arg ? evalExpr(arg, env, fns, depth + 1, seen) : { dynamic: false, text: '' },
            );
          }
        });
        const seen2 = new Set(seen);
        seen2.add(name);
        let dynamic = false;
        let text = '';
        for (const ret of returnsOf(fn)) {
          const v = evalExpr(ret, argEnv, fns, depth + 1, seen2);
          dynamic = dynamic || v.dynamic;
          text += ' ' + v.text;
        }
        return { dynamic, text };
      }
      // Unknown / non-local / recursive call → structurally dynamic, no text.
      return { dynamic: true, text: '' };
    }
    default:
      // MemberExpression (req.body.x), AwaitExpression, etc. — runtime value,
      // but no statically recoverable text.
      return { dynamic: true, text: '' };
  }
}

/**
 * Build the enclosing-scope param env for a node: every parameter of an
 * enclosing function is dynamic (external/runtime). This seeds evalExpr so a
 * sink-arg call like `db.query(build(req.id))` inside `function h(req){…}` knows
 * `req` is dynamic. Mirrors the prototype's enclosingEnv via the __parent chain.
 *
 * @param {object} node a CallExpression sink node
 * @returns {Map<string,{dynamic:boolean,text:string}>}
 */
function enclosingParamEnv(node) {
  const env = new Map();
  let n = node.__parent;
  while (n) {
    if (FN_TYPES.has(n.type) && Array.isArray(n.params)) {
      for (const p of n.params) {
        for (const name of patternNames(p)) {
          if (!env.has(name)) env.set(name, { dynamic: true, text: '' });
        }
      }
    }
    n = n.__parent;
  }
  return env;
}

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

  // Inter-procedural (intra-module) maps: local functions for arg-sensitive
  // return-taint resolution, and sink aliases for `const X = obj.query` etc.
  const ipCtx = { fns: collectLocalFns(ast), aliases: collectSinkAliases(ast) };

  const findings = [];
  const line = (n) => (n.loc ? n.loc.start.line : 0);

  walk(ast, (node) => {
    if (node.type === 'CallExpression') {
      handleCall(node, scopeOf, file, line, findings, ipCtx);
    } else if (node.type === 'NewExpression') {
      handleNew(node, scopeOf, file, line, findings);
    }
  });

  return { parsed: true, findings: dedupe(findings) };
}

/**
 * Arg-sensitive inter-procedural resolution of a sink argument that is a CALL to
 * a local function. Returns the recovered { dynamic, text } so the caller can
 * apply the SAME dynamic + SQL-keyword gate it uses for intraprocedural values.
 * Returns null when the argument is not a local-function call (the caller then
 * keeps the existing intraprocedural classification — purely additive).
 */
function resolveLocalCallArg(arg, node, ipCtx) {
  if (!arg || arg.type !== 'CallExpression') return null;
  if (!(arg.callee.type === 'Identifier' && ipCtx.fns.has(arg.callee.name))) return null;
  const env = enclosingParamEnv(node);
  return evalExpr(arg, env, ipCtx.fns, 0, new Set());
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

function handleCall(node, scopeOf, file, line, findings, ipCtx) {
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
      // INTER-PROCEDURAL (additive): the intraprocedural path above recovers NO
      // SQL text from a CallExpression arg. If arg0 is a call to a LOCAL helper,
      // resolve its return arg-sensitively; flag only when the recovered value
      // is dynamic AND carries a real SQL keyword AND the call is not
      // parameterized. A const-returning helper or an identity-fn(constant) stays
      // clean (no dynamic / no recovered keyword); a non-SQL helper stays clean
      // (keyword gate).
      if (ipCtx && arg0) {
        const ip = resolveLocalCallArg(arg0, node, ipCtx);
        if (ip && ip.dynamic && SQL_KW_RE.test(ip.text) && !isParameterized(node, arg0, scope)) {
          findings.push(sqlFinding(file, line(node), node));
          return;
        }
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

  // SINK ALIAS (inter-procedural): `const X = obj.query` / `const X = cp.execSync`
  // makes a later `X(arg)` call the same sink. Apply the SAME guards as the
  // underlying member sink (dynamic + SQL-keyword + parameterized for sql;
  // dynamic for shell). The arg may itself be a local-function call, so reuse the
  // inter-procedural resolver. `const run=console.log; run(...)` is not an alias
  // (console.log is not a tracked sink method) and never reaches here.
  if (callee.type === 'Identifier' && ipCtx && ipCtx.aliases.has(callee.name)) {
    const alias = ipCtx.aliases.get(callee.name);
    const arg0 = args[0];
    if (arg0) {
      const ip = resolveLocalCallArg(arg0, node, ipCtx);
      const dynamic = ip ? ip.dynamic : isDynamic(arg0, scope);
      if (alias.kind === 'shell') {
        if (dynamic) {
          findings.push(cmdFinding(file, line(node), node, 'critical'));
          return;
        }
      } else {
        // sql alias: dynamic + real SQL keyword + not parameterized.
        const text = ip ? ip.text : collectStaticText(arg0, scope, new Set());
        if (dynamic && SQL_KW_RE.test(text) && !isParameterized(node, arg0, scope)) {
          findings.push(sqlFinding(file, line(node), node));
          return;
        }
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
