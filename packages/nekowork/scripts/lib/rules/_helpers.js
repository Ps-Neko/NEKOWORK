// Shared helpers for regex-based deterministic risk rules.
//
// Each rule plugs in a list of patterns and a per-finding decorator, and gets
// the same scanFileContent / scanAddedLines / scanDiff surface for free.

import { addedLines as collectAddedLines } from '../diff-parser.js';

/**
 * Strip line and block comments while preserving line count and column
 * positions, so regex line offsets still map to the original text.
 *
 * String-aware: a `//`, `/* *​/`, or `#` that lives INSIDE a single-quoted,
 * double-quoted, or backtick string literal is NOT a comment and must be
 * preserved. A naive regex stripper would treat `const u = "https://e";
 * eval(x)` as having a line comment after `https:` (the negative lookbehind
 * only handled the exact `://` case) and would blank out the rest of the line,
 * masking a real `eval(x)` finding. The small state machine below walks the
 * text once, tracking whether it is inside a string / comment, so only true
 * comments are replaced with spaces (newlines kept to preserve offsets).
 */
export function stripCommentsPreservingOffsets(text) {
  const n = text.length;
  const out = new Array(n);
  // States: 'code' | 'line' (line comment) | 'block' (block comment)
  //         | 'sq' (') | 'dq' (") | 'tpl' (`)
  let state = 'code';
  let i = 0;
  const blank = (idx) => { out[idx] = text[idx] === '\n' ? '\n' : ' '; };

  while (i < n) {
    const c = text[i];
    const next = i + 1 < n ? text[i + 1] : '';

    if (state === 'code') {
      // # line comment — only when at line start or preceded by whitespace or
      // a shell separator, to avoid mangling URL fragments (`#frag`) and shell
      // parameter expansions (`${#var}`). Mirrors the previous regex intent.
      if (c === '#') {
        const prev = i > 0 ? text[i - 1] : '';
        if (prev === '' || /[\s;&|]/.test(prev) || i === 0) {
          state = 'line';
          blank(i); i++; continue;
        }
      }
      if (c === '/' && next === '/') {
        // `://` is a URL scheme separator, not a comment — even outside a string
        // literal (e.g. a bare `curl https://host/x | bash` shell line). Keep the
        // pre-state-machine behavior of not treating `://` as a line comment.
        const prev = i > 0 ? text[i - 1] : '';
        if (prev !== ':') {
          state = 'line';
          blank(i); blank(i + 1); i += 2; continue;
        }
        out[i] = c; i++; continue;
      }
      if (c === '/' && next === '*') {
        state = 'block';
        blank(i); blank(i + 1); i += 2; continue;
      }
      if (c === '"') { state = 'dq'; out[i] = c; i++; continue; }
      if (c === "'") { state = 'sq'; out[i] = c; i++; continue; }
      if (c === '`') { state = 'tpl'; out[i] = c; i++; continue; }
      out[i] = c; i++; continue;
    }

    if (state === 'line') {
      if (c === '\n') { state = 'code'; out[i] = '\n'; i++; continue; }
      blank(i); i++; continue;
    }

    if (state === 'block') {
      if (c === '*' && next === '/') {
        state = 'code'; blank(i); blank(i + 1); i += 2; continue;
      }
      blank(i); i++; continue;
    }

    // Inside a string literal: copy verbatim, honoring backslash escapes, until
    // the matching closing quote. Newlines inside the string are preserved as
    // newlines either way (offset-preserving).
    if (state === 'sq' || state === 'dq' || state === 'tpl') {
      if (c === '\\') {
        // Copy the backslash and the escaped char verbatim.
        out[i] = c;
        if (i + 1 < n) out[i + 1] = text[i + 1];
        i += 2; continue;
      }
      const closer = state === 'sq' ? "'" : state === 'dq' ? '"' : '`';
      if (c === closer) { state = 'code'; out[i] = c; i++; continue; }
      // Single/double quoted strings do not span lines in valid JS; if we hit a
      // newline, bail back to code so an unterminated quote cannot eat the rest
      // of the file.
      if ((state === 'sq' || state === 'dq') && c === '\n') {
        state = 'code'; out[i] = '\n'; i++; continue;
      }
      out[i] = c; i++; continue;
    }

    out[i] = c; i++;
  }

  return out.join('');
}

export function lineNumberFromIndex(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

// 개행 위치를 한 번만 모아 두고 index→줄번호를 이진탐색(O(log n))으로 돌려주는 조회기.
// 매치마다 0부터 재스캔하는 lineNumberFromIndex 를 다수-매치 루프에서 쓰면 O(n²)라
// 대형 파일에서 자원 소진(DoS)이 된다 — 핫 루프(makeRegexScanner)는 이걸 쓴다.
export function makeLineLookup(text) {
  const nl = [];
  const s = typeof text === 'string' ? text : '';
  for (let i = 0; i < s.length; i++) if (s[i] === '\n') nl.push(i);
  return (index) => {
    // index 앞의 개행 개수 = nl 중 (< index) 인 원소 수 (lower-bound).
    let lo = 0, hi = nl.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (nl[mid] < index) lo = mid + 1; else hi = mid; }
    return lo + 1;
  };
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
    // 줄번호 조회기를 haystack 당 한 번만 만든다(O(n) 준비 + 매치당 O(log n) 조회).
    // 매치마다 lineNumberFromIndex(0부터 재스캔)를 부르면 O(n²)라 대형 파일서 DoS.
    const cleanLookup = makeLineLookup(clean);
    let rawLookup = null; // raw 패턴이 있을 때만 lazily 생성

    for (const pat of patterns) {
      // `raw: true` patterns scan the original text (needed for directives
      // that live inside comments, like @ts-nocheck or /* eslint-disable */).
      const haystack = pat.raw ? content : clean;
      const lookup = pat.raw ? (rawLookup ||= makeLineLookup(content)) : cleanLookup;
      pat.re.lastIndex = 0;
      let m;
      while ((m = pat.re.exec(haystack)) !== null) {
        if (pat.filter && !pat.filter(m)) continue;
        const severity = pat.pickSeverity ? pat.pickSeverity(m, haystack) : (pat.severity || 'high');
        const line = lookup(m.index) + lineOffset;
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
