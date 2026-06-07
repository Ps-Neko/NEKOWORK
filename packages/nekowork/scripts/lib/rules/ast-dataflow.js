// AST dataflow rule — the variable-mediated injection detector.
//
// The line-oriented regex rules (sql-injection, command-injection, eval-usage)
// match a dangerous sink and its dynamic argument on a SINGLE line. They
// provably MISS the variable-mediated form, where the dangerous value is
// assembled in one statement and used in another:
//
//   const q = "SELECT * FROM u WHERE id = " + req.params.id;   // line N
//   db.query(q);                                               // line N+1
//
// This rule parses the WHOLE file (functions cross many lines) and runs
// intraprocedural const/taint propagation (see ../ast/analyze.js) to catch the
// dynamic value flowing into the sink — while const-propagation keeps FP=0 on a
// constant bound to a variable (`const q = \`SELECT 1\`; db.query(q)`).
//
// Two surfaces:
//   - scanFileContent(filePath, content): analyze content directly. Used by the
//     benchmark harness (which passes fixture file content) AND as the shared
//     core.
//   - scanDiff(parsedDiff, opts): for each CHANGED JS/TS-family file, read the
//     FULL post-change file from disk (opts.projectRoot) and analyze it. AST
//     needs whole functions, not just added lines. Reading the post-change file
//     also catches the "risky code re-activated by deleting a comment fence"
//     evasion. If a file can't be read (e.g. --from-patch with no working copy)
//     or doesn't parse, it is skipped silently — the regex rules still cover it.

import fs from 'node:fs';
import path from 'node:path';
import { analyze } from '../ast/analyze.js';
import { isTsPath } from '../ast/parse.js';

// JS/TS family extensions the AST engine understands.
const JS_TS_EXT = /\.(js|jsx|mjs|cjs|ts|tsx|mts|cts)$/i;

export function isAnalyzablePath(filePath) {
  return JS_TS_EXT.test(String(filePath || ''));
}

/**
 * Analyze a single file's content. Matches the regex rules' scanFileContent
 * signature so the benchmark harness (which calls scanFileContent(file, content))
 * exercises this rule the same way.
 *
 * @param {string} filePath  reported in findings + decides TS stripping
 * @param {string} content
 * @returns {Array} findings (regex-rule finding shape)
 */
export function scanFileContent(filePath, content) {
  if (!isAnalyzablePath(filePath)) return [];
  if (typeof content !== 'string' || content.length === 0) return [];
  const { findings } = analyze(content, filePath, { ts: isTsPath(filePath) });
  return findings;
}

/**
 * scanDiff for the real verify-pr pipeline. Needs full file content, so it reads
 * each changed file from disk under opts.projectRoot.
 *
 * @param {object} parsedDiff
 * @param {{ projectRoot?: string }} [opts]
 * @returns {Array} findings
 */
export function scanDiff(parsedDiff, opts = {}) {
  if (!parsedDiff || !Array.isArray(parsedDiff.files)) return [];
  const projectRoot = opts.projectRoot;
  // Without a working copy we cannot read whole files — skip silently (the regex
  // rules still scan the diff's added lines). This is the --from-patch path and
  // the heavy package's no-projectRoot call.
  if (!projectRoot) return [];

  const findings = [];
  const seenPaths = new Set();
  for (const file of parsedDiff.files) {
    if (!file || file.binary) continue;
    // Deleted files have no post-change content to analyze.
    if (file.status === 'deleted') continue;
    const rel = file.path;
    if (!rel || seenPaths.has(rel)) continue;
    seenPaths.add(rel);
    if (!isAnalyzablePath(rel)) continue;

    const abs = path.join(projectRoot, rel);
    let content;
    try {
      const stat = fs.statSync(abs);
      if (!stat.isFile()) continue;
      content = fs.readFileSync(abs, 'utf8');
    } catch {
      continue; // unreadable → regex rules still cover the diff
    }

    const fileFindings = scanFileContent(rel, content);
    for (const f of fileFindings) findings.push(f);
  }
  return findings;
}

// scanAddedLines is part of the regex rules' surface; the AST engine works on
// whole files, so added-lines-only analysis would lose cross-statement flow.
// Provide a no-op for interface parity (nothing calls it for this rule).
export function scanAddedLines() {
  return [];
}
