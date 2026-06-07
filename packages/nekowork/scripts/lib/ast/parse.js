// AST parsing primitives for the dataflow detection engine.
//
// The regex rules (sql-injection, command-injection, eval-usage) match the
// dangerous sink and its argument on a SINGLE line. They provably miss the
// variable-mediated form, where the dangerous value is assembled across
// statements:
//
//   const q = "SELECT * FROM u WHERE id = " + req.params.id;  // line N
//   db.query(q);                                              // line N+1
//
// To catch that we need a real parse + intraprocedural const/taint propagation
// (see ./analyze.js). This module only turns source text into an ESTree AST and
// provides a generic walker; all detection logic lives in analyze.js.
//
// Design constraints (FP=0 is the gate):
//   - Parse failure returns null. The caller falls back to the regex rules, so a
//     file the AST engine cannot understand is never silently dropped AND never
//     produces a false finding.
//   - TS/TSX is stripped with Node's built-in stripTypeScriptTypes in 'strip'
//     mode, which BLANKS type annotations in place (offsets preserved → the
//     line numbers acorn reports still map to the original source).

import { parse as acornParse } from 'acorn';
import { stripTypeScriptTypes } from 'node:module';

const TS_EXT = /\.(ts|tsx|mts|cts)$/i;

/**
 * Strip TS types with the experimental warning suppressed. stripTypeScriptTypes
 * is flagged experimental and emits a one-time process 'warning'. Node DEFERS
 * that emission to a later tick (the default warning handler runs via
 * process.nextTick), so a try/finally scoped listener swap around the strip call
 * cannot catch it. Instead we install ONE persistent filter (lazily, on first
 * TS strip) that drops ONLY this specific stripTypeScriptTypes experimental
 * warning and forwards everything else to the pre-existing listeners. The CLI
 * therefore never prints the warning, and unrelated warnings are untouched.
 */
let warningFilterInstalled = false;
function installExperimentalWarningFilter() {
  if (warningFilterInstalled) return;
  warningFilterInstalled = true;
  const prior = process.listeners('warning');
  process.removeAllListeners('warning');
  process.on('warning', (w) => {
    const isStripWarning =
      w &&
      w.name === 'ExperimentalWarning' &&
      typeof w.message === 'string' &&
      /stripTypeScriptTypes/.test(w.message);
    if (isStripWarning) return; // swallow only this one
    for (const l of prior) {
      try { l(w); } catch { /* ignore listener errors */ }
    }
  });
}

function stripTypesQuiet(code) {
  installExperimentalWarningFilter();
  return stripTypeScriptTypes(code, { mode: 'strip' });
}

/**
 * Parse source text to an ESTree AST.
 *
 * @param {string} code
 * @param {{ ts?: boolean }} [opts]  ts=true → run stripTypeScriptTypes first.
 * @returns {object|null} ESTree Program node, or null on parse failure.
 */
export function parseToAst(code, opts = {}) {
  if (typeof code !== 'string' || code.length === 0) return null;
  let src = code;
  if (opts.ts) {
    try {
      src = stripTypesQuiet(code);
    } catch {
      // Type stripping can fail on exotic syntax; bail to regex fallback.
      return null;
    }
  }
  // Try module first (the common case: import/export), then fall back to script
  // (for files using top-level `return`, CommonJS-only constructs, etc.).
  for (const sourceType of ['module', 'script']) {
    try {
      return acornParse(src, {
        ecmaVersion: 'latest',
        sourceType,
        locations: true,
        allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
        allowHashBang: true,
      });
    } catch {
      /* try next sourceType */
    }
  }
  return null;
}

/** True when a file path is in the TypeScript family. */
export function isTsPath(filePath) {
  return TS_EXT.test(String(filePath || ''));
}

// Skip metadata keys. `__parent` is an analyzer-injected back-link (see
// analyze.js annotateParents); recursing into it would loop forever.
const SKIP_KEYS = new Set(['loc', 'start', 'end', 'range', 'parent', '__parent']);

/**
 * Depth-first ESTree walk. Calls visit(node, parent) for every node, then
 * recurses into array-valued and node-valued child properties. loc/start/end/
 * range keys are skipped (they are metadata, not children).
 *
 * @param {object} node           ESTree node (or Program)
 * @param {(node: object, parent: object|null) => void} visit
 * @param {object|null} [parent]
 */
export function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child.type === 'string') walk(child, visit, node);
      }
    } else if (value && typeof value.type === 'string') {
      walk(value, visit, node);
    }
  }
}
