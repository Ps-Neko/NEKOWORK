// Unified diff parser for verify-pr.
//
// Parses `git diff` output (or any unified patch) into a structured shape that
// downstream risk rules can scan. Preserves per-file additions/deletions plus
// per-line numbers so a finding can be reported with file:line precision.
//
// Out of scope: rename similarity, color codes, three-way merge markers.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const HEADER_RE = /^diff --git a\/(.+?) b\/(.+?)$/;
const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parse a unified diff string.
 * @param {string} diffText
 * @returns {{
 *   files: Array<{
 *     path: string,
 *     oldPath: string,
 *     status: 'modified' | 'added' | 'deleted' | 'renamed' | 'binary',
 *     additions: number,
 *     deletions: number,
 *     binary: boolean,
 *     hunks: Array<{
 *       oldStart: number, oldLines: number,
 *       newStart: number, newLines: number,
 *       lines: Array<{ type: ' ' | '+' | '-', content: string, oldLineNumber?: number, newLineNumber?: number }>
 *     }>
 *   }>,
 *   totalAdditions: number,
 *   totalDeletions: number,
 *   totalFiles: number
 * }}
 */
export function parseDiff(diffText) {
  const result = { files: [], totalAdditions: 0, totalDeletions: 0, totalFiles: 0 };
  if (!diffText || typeof diffText !== 'string') return result;

  const lines = diffText.split(/\r?\n/);
  let current = null;
  let hunk = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  const flushCurrent = () => {
    if (!current) return;
    result.files.push(current);
    result.totalAdditions += current.additions;
    result.totalDeletions += current.deletions;
    current = null;
    hunk = null;
  };

  for (const line of lines) {
    const header = line.match(HEADER_RE);
    if (header) {
      flushCurrent();
      current = {
        path: header[2],
        oldPath: header[1],
        status: 'modified',
        additions: 0,
        deletions: 0,
        binary: false,
        hunks: [],
      };
      hunk = null;
      continue;
    }
    if (!current) continue;

    if (line.startsWith('new file mode')) {
      current.status = 'added';
      continue;
    }
    if (line.startsWith('deleted file mode')) {
      current.status = 'deleted';
      continue;
    }
    if (line.startsWith('rename from ')) {
      current.oldPath = line.slice('rename from '.length);
      current.status = 'renamed';
      continue;
    }
    if (line.startsWith('rename to ')) {
      current.path = line.slice('rename to '.length);
      current.status = 'renamed';
      continue;
    }
    if (line.startsWith('Binary files') || line === 'GIT binary patch') {
      current.binary = true;
      current.status = 'binary';
      continue;
    }
    if (line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('index ')) {
      continue;
    }

    const hunkHead = line.match(HUNK_RE);
    if (hunkHead) {
      hunk = {
        oldStart: parseInt(hunkHead[1], 10),
        oldLines: hunkHead[2] ? parseInt(hunkHead[2], 10) : 1,
        newStart: parseInt(hunkHead[3], 10),
        newLines: hunkHead[4] ? parseInt(hunkHead[4], 10) : 1,
        lines: [],
      };
      current.hunks.push(hunk);
      oldLineNum = hunk.oldStart;
      newLineNum = hunk.newStart;
      continue;
    }
    if (!hunk) continue;

    if (line.startsWith('\\ No newline')) continue;
    if (line === '') {
      hunk.lines.push({ type: ' ', content: '' });
      oldLineNum++;
      newLineNum++;
      continue;
    }

    const type = line[0];
    const content = line.slice(1);
    if (type === '+') {
      hunk.lines.push({ type: '+', content, newLineNumber: newLineNum });
      newLineNum++;
      current.additions++;
    } else if (type === '-') {
      hunk.lines.push({ type: '-', content, oldLineNumber: oldLineNum });
      oldLineNum++;
      current.deletions++;
    } else if (type === ' ') {
      hunk.lines.push({ type: ' ', content, oldLineNumber: oldLineNum, newLineNumber: newLineNum });
      oldLineNum++;
      newLineNum++;
    }
  }

  flushCurrent();
  result.totalFiles = result.files.length;
  return result;
}

/**
 * Return every added (`+`) line across the parsed diff, with file path and
 * new line number attached. Convenient for regex/AST scanning where a finding
 * needs `file:line`.
 *
 * @param {ReturnType<typeof parseDiff>} parsed
 * @returns {Array<{ path: string, line: number, content: string }>}
 */
export function addedLines(parsed) {
  const out = [];
  for (const file of parsed.files || []) {
    if (file.binary) continue;
    for (const hunk of file.hunks || []) {
      for (const ln of hunk.lines) {
        if (ln.type === '+') {
          out.push({ path: file.path, line: ln.newLineNumber, content: ln.content });
        }
      }
    }
  }
  return out;
}

/**
 * Run `git diff` in `cwd` and return the parsed result.
 * Supports working tree (default), staged, or a range.
 *
 * @param {object} opts
 * @param {string} [opts.cwd]            git working directory
 * @param {'working' | 'staged' | 'range'} [opts.mode='working']
 * @param {string} [opts.range]          required when mode='range', e.g. 'main...HEAD'
 * @param {string[]} [opts.extraArgs]    extra args appended after the mode args
 */
export function getGitDiff(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const mode = opts.mode || 'working';
  const args = ['diff', '--no-color', '--no-ext-diff'];
  if (mode === 'staged') args.push('--cached');
  else if (mode === 'range') {
    if (!opts.range) throw new Error('getGitDiff: range mode requires opts.range');
    args.push(opts.range);
  }
  if (Array.isArray(opts.extraArgs)) args.push(...opts.extraArgs);

  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} exited ${result.status}: ${result.stderr || ''}`);
  }
  return parseDiff(result.stdout || '');
}

/**
 * Load a patch file from disk and parse it.
 * @param {string} filePath
 */
export function loadDiffFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`diff file not found: ${filePath}`);
  }
  return parseDiff(fs.readFileSync(filePath, 'utf8'));
}
