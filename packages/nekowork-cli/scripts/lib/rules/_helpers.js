// Shared helpers for regex-based deterministic risk rules.
//
// Each rule plugs in a list of patterns and a per-finding decorator, and gets
// the same scanFileContent / scanAddedLines / scanDiff surface for free.

import { addedLines as collectAddedLines } from '../diff-parser.js';

/**
 * Strip line and block comments while preserving line count and column
 * positions, so regex line offsets still map to the original text.
 */
export function stripCommentsPreservingOffsets(text) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  // // comment, but NOT inside a URL scheme like `https://`. Negative
  // lookbehind for `:` keeps `://` intact while still stripping `// real
  // comments`.
  out = out.replace(/(?<!:)\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  // Also handle # comments (shell, yaml, dockerfile). Be conservative — only
  // strip when # is at line start or preceded by whitespace, to avoid
  // mangling URL fragments or shell parameter expansions like ${#var}.
  out = out.replace(/(^|[\s;&|])#[^\n]*/g, (m, prefix) => prefix + ' '.repeat(m.length - prefix.length));
  return out;
}

export function lineNumberFromIndex(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

/**
 * If multiple patterns fire on the same {file, line}, keep the highest
 * severity (critical > high > medium > low). Output is sorted by line.
 */
export function dedupePreferHighest(findings) {
  const RANK = { critical: 4, high: 3, medium: 2, low: 1 };
  const byKey = new Map();
  for (const f of findings) {
    const key = `${f.file}:${f.line}`;
    const prev = byKey.get(key);
    if (!prev || (RANK[f.severity] || 0) > (RANK[prev.severity] || 0)) {
      byKey.set(key, f);
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file),
  );
}

/**
 * Build a deterministic regex scanner for a fixed pattern list.
 *
 * @param {object} cfg
 * @param {string} cfg.ruleName       finding.rule value
 * @param {string} cfg.category       finding.category value
 * @param {Array<{
 *   id: string,
 *   re: RegExp,
 *   severity?: 'critical' | 'high' | 'medium' | 'low',
 *   title?: string,
 *   description?: string,
 *   recommendation?: string,
 *   pickSeverity?: (m: RegExpExecArray, content: string) => 'critical' | 'high' | 'medium' | 'low',
 *   filter?: (m: RegExpExecArray) => boolean,
 * }>} cfg.patterns
 */
export function makeRegexScanner(cfg) {
  const { ruleName, category, patterns } = cfg;

  function scanFileContent(filePath, content, opts = {}) {
    const lineOffset = opts.lineOffset || 0;
    if (typeof content !== 'string' || !content) return [];
    const clean = stripCommentsPreservingOffsets(content);
    const findings = [];
    const seen = new Set();

    for (const pat of patterns) {
      // `raw: true` patterns scan the original text (needed for directives
      // that live inside comments, like @ts-nocheck or /* eslint-disable */).
      const haystack = pat.raw ? content : clean;
      pat.re.lastIndex = 0;
      let m;
      while ((m = pat.re.exec(haystack)) !== null) {
        if (pat.filter && !pat.filter(m)) continue;
        const severity = pat.pickSeverity ? pat.pickSeverity(m, haystack) : (pat.severity || 'high');
        const line = lineNumberFromIndex(haystack, m.index) + lineOffset;
        const seenKey = `${pat.id}:${line}`;
        if (seen.has(seenKey)) continue;
        seen.add(seenKey);

        findings.push({
          id: `RULE_${ruleName.toUpperCase().replace(/-/g, '_')}_${pat.id.toUpperCase().replace(/-/g, '_')}_${findings.length + 1}`,
          rule: ruleName,
          pattern: pat.id,
          severity,
          category,
          file: filePath,
          line,
          title: pat.title || 'Risk finding',
          description: pat.description || `Pattern ${pat.id} matched.`,
          recommendation: pat.recommendation || 'Review the change.',
          blocks_apply: severity === 'critical',
          match: m[0].slice(0, 160).replace(/\s+/g, ' '),
        });
      }
    }
    return dedupePreferHighest(findings);
  }

  function scanAddedLines(addedLines) {
    if (!Array.isArray(addedLines)) return [];
    const byFile = new Map();
    for (const entry of addedLines) {
      if (!byFile.has(entry.path)) byFile.set(entry.path, []);
      byFile.get(entry.path).push(entry);
    }
    const findings = [];
    for (const [filePath, entries] of byFile.entries()) {
      entries.sort((a, b) => a.line - b.line);
      let block = [];
      let blockStart = null;
      const flush = () => {
        if (!block.length) return;
        const text = block.join('\n');
        findings.push(...scanFileContent(filePath, text, { lineOffset: blockStart - 1 }));
        block = [];
        blockStart = null;
      };
      let prev = null;
      for (const entry of entries) {
        if (prev != null && entry.line !== prev + 1) flush();
        if (block.length === 0) blockStart = entry.line;
        block.push(entry.content);
        prev = entry.line;
      }
      flush();
    }
    return dedupePreferHighest(findings);
  }

  function scanDiff(parsedDiff) {
    if (!parsedDiff || !Array.isArray(parsedDiff.files)) return [];
    return scanAddedLines(collectAddedLines(parsedDiff));
  }

  return { scanFileContent, scanAddedLines, scanDiff };
}
