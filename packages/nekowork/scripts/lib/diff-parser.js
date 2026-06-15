// Unified diff parser for verify-pr.
//
// Parses `git diff` output (or any unified patch) into a structured shape that
// downstream risk rules can scan. Preserves per-file additions/deletions plus
// per-line numbers so a finding can be reported with file:line precision.
//
// Out of scope: rename similarity, color codes, three-way merge markers.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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
  // A trailing newline makes `split` produce a trailing empty element, which
  // would otherwise be parsed as a phantom context line (inflating hunk.lines
  // and line counts by 1). Drop it before the loop.
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  let current = null;
  let hunk = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  const flushCurrent = () => {
    if (!current) return;
    // `_fromGitHeader` is an internal parse hint; do not leak it to callers.
    delete current._fromGitHeader;
    result.files.push(current);
    result.totalAdditions += current.additions;
    result.totalDeletions += current.deletions;
    current = null;
    hunk = null;
  };

  // Strip the `a/` or `b/` prefix git adds to `--- ` / `+++ ` paths; pass
  // through `/dev/null` and prefix-less paths unchanged.
  const stripPrefix = (p) => {
    if (p === '/dev/null') return p;
    if (p.startsWith('a/') || p.startsWith('b/')) return p.slice(2);
    return p;
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
        _fromGitHeader: true,
      };
      hunk = null;
      continue;
    }

    // Fallback: a plain unified diff (no `diff --git` line) starts a file at
    // its `--- a/path` marker. Only triggered when no git header preceded a
    // hunk-bearing block, so `--from-patch` on non-git patches still parses.
    if (line.startsWith('--- ') && (!current || current.hunks.length > 0 || current.binary)) {
      flushCurrent();
      const oldPath = stripPrefix(line.slice('--- '.length).split('\t')[0].trim());
      current = {
        path: oldPath === '/dev/null' ? '' : oldPath,
        oldPath: oldPath === '/dev/null' ? '' : oldPath,
        status: 'modified',
        additions: 0,
        deletions: 0,
        binary: false,
        hunks: [],
        _fromGitHeader: false,
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
    if (line.startsWith('+++ ')) {
      // For a plain (non-git-header) file, the `+++ b/path` line carries the
      // authoritative new path. For git-header files the header already set it.
      if (!current._fromGitHeader) {
        const newPath = stripPrefix(line.slice('+++ '.length).split('\t')[0].trim());
        if (newPath === '/dev/null') {
          current.status = 'deleted';
        } else {
          current.path = newPath;
          if (!current.oldPath) current.oldPath = newPath;
        }
      }
      continue;
    }
    if (line.startsWith('--- ') || line.startsWith('index ')) {
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
 * For mode='working' (the common dev case where AI just wrote files), this
 * also synthesizes diffs for untracked files so `verify-pr` can see brand-new
 * files the AI created. Without this, `git diff` reports nothing for new
 * files until they are staged.
 *
 * @param {object} opts
 * @param {string} [opts.cwd]            git working directory
 * @param {'working' | 'staged' | 'range' | 'full'} [opts.mode='working']
 * @param {string} [opts.range]          required when mode='range', e.g. 'main...HEAD'
 * @param {string[]} [opts.extraArgs]    extra args appended after the mode args
 * @param {boolean} [opts.includeUntracked=true]  for mode='working', synthesize
 *                                                untracked files as added.
 */
export function getGitDiff(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const mode = opts.mode || 'working';
  const includeUntracked = opts.includeUntracked !== false;

  // include: append explicitly named paths as an all-added diff, ignoring
  // .gitignore. `git diff` / `ls-files --exclude-standard` skip gitignored
  // build/codegen output; this force-scans the paths the caller names.
  const appendIncluded = (stdout) => {
    if (!Array.isArray(opts.includePaths) || opts.includePaths.length === 0) return stdout;
    return stdout + synthesizeFilesAsDiff(cwd, collectIncludeFiles(cwd, opts.includePaths));
  };

  // Centrally drop the tool's own output (REPORT.md + .nekowork/**) from EVERY
  // diff source — working, staged, range, full, and synthesized. Without this,
  // a 2nd verify-pr run scans its own prior evidence (which stores the secret
  // text it flagged) and can force a FALSE BLOCK. Applied after parseDiff so it
  // covers the real `git diff` path, not only synthesized diffs.
  //
  // `rawText` is the exact unified-diff string fed to parseDiff. We attach a
  // self-output-FILTERED copy as `parsed.rawDiff` so the evidence package can
  // record the precise patch text the rules saw (patch↔verdict binding for the
  // "same diff → same verdict" audit), not the unfiltered git stdout.
  const dropSelfOutput = (parsed, rawText) => {
    const kept = (parsed.files || []).filter(f => !isSelfOutput(f.path));
    const dropped = kept.length !== (parsed.files || []).length;
    const rawDiff = dropped ? filterSelfOutputRaw(rawText) : (rawText || '');
    if (!dropped) {
      parsed.rawDiff = rawDiff;
      return parsed;
    }
    let totalAdditions = 0;
    let totalDeletions = 0;
    for (const f of kept) { totalAdditions += f.additions; totalDeletions += f.deletions; }
    return { files: kept, totalAdditions, totalDeletions, totalFiles: kept.length, rawDiff };
  };

  // full-scan: treat the entire tracked file set (plus untracked, unless
  // disabled) as an all-added diff, so risk rules see every line rather than
  // only a git delta. This is the onboarding path — run verify-pr on a repo
  // that has no PR/diff yet, without fabricating a fake change.
  if (mode === 'full') {
    const ls = spawnSync('git', ['ls-files'], { cwd, encoding: 'utf8', windowsHide: true });
    if (ls.error) throw ls.error;
    if (ls.status !== 0) {
      throw new Error(`git ls-files exited ${ls.status}: ${ls.stderr || ''}`);
    }
    const tracked = (ls.stdout || '').split('\n').map(s => s.trim()).filter(Boolean).filter(p => !isSelfOutput(p));
    let stdout = synthesizeFilesAsDiff(cwd, tracked);
    if (includeUntracked) stdout += synthesizeUntrackedDiff(cwd);
    const raw = appendIncluded(stdout);
    return dropSelfOutput(parseDiff(raw), raw);
  }

  const args = ['diff', '--no-color', '--no-ext-diff'];
  if (mode === 'staged') args.push('--cached');
  else if (mode === 'range') {
    if (!opts.range) throw new Error('getGitDiff: range mode requires opts.range');
    if (!isSafeGitRange(opts.range)) {
      throw new Error(`getGitDiff: unsafe range '${opts.range}' — git refspec 문자만 허용하고 선행 '-' 는 거부합니다(인자 인젝션 방지)`);
    }
    args.push(opts.range);
  } else if (mode === 'working') {
    args.push('HEAD');
  }
  if (Array.isArray(opts.extraArgs)) args.push(...opts.extraArgs);

  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  let stdout = result.stdout || '';
  if (result.status !== 0) {
    // `git diff HEAD` fails in a repo with no commits yet. Fall back to plain
    // `git diff` (which compares working tree to index) in that case.
    if (mode === 'working' && /unknown revision|bad revision|ambiguous argument 'HEAD'/i.test(result.stderr || '')) {
      const fallback = spawnSync('git', ['diff', '--no-color', '--no-ext-diff'], { cwd, encoding: 'utf8', windowsHide: true });
      if (fallback.status !== 0) {
        throw new Error(`git diff fallback exited ${fallback.status}: ${fallback.stderr || ''}`);
      }
      stdout = fallback.stdout || '';
    } else {
      throw new Error(`git ${args.join(' ')} exited ${result.status}: ${result.stderr || ''}`);
    }
  }

  if (mode === 'working' && includeUntracked) {
    stdout += synthesizeUntrackedDiff(cwd);
  }

  const raw = appendIncluded(stdout);
  return dropSelfOutput(parseDiff(raw), raw);
}

/**
 * verify-pr writes its own output to `REPORT.md` and `.nekowork/**`. Those are
 * the tool's product, not "changes to verify" — scanning them would re-flag the
 * secret/risk text stored in its own evidence on the next run (self-
 * contamination). Exclude them from every synthesized diff.
 */
function isSelfOutput(relPath) {
  // Case-insensitive: on case-insensitive filesystems (Windows, macOS default)
  // `REPORT.MD` / `.NEKOWORK/` resolve to the same files as the tool's own
  // output, so they must be excluded too — otherwise the tool re-scans its own
  // evidence on the next run (self-contamination / false BLOCK).
  const lower = String(relPath).toLowerCase();
  return lower === 'report.md' || lower.startsWith('.nekowork/');
}

/**
 * Drop the tool's own-output file blocks from a RAW unified-diff string, so the
 * recorded `rawDiff` evidence matches the parsed (post-filter) diff the rules
 * actually scanned. Splits on `diff --git a/<path> b/<path>` headers and keeps
 * each block unless its path is self-output. Blocks with no parseable git header
 * (e.g. a leading plain `--- a/path` patch) are kept conservatively.
 *
 * @param {string} rawText
 * @returns {string}
 */
function filterSelfOutputRaw(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  // Split keeping the `diff --git` delimiter at the head of each block.
  const blocks = rawText.split(/(?=^diff --git )/m);
  const kept = [];
  for (const block of blocks) {
    const m = block.match(/^diff --git a\/(.+?) b\/(.+?)\s*$/m);
    // No git header → not a per-file block we can attribute; keep it (e.g. any
    // preamble before the first file). A header whose new path is self-output
    // is dropped.
    if (m && isSelfOutput(m[2])) continue;
    kept.push(block);
  }
  return kept.join('');
}

function synthesizeUntrackedDiff(cwd) {
  const ls = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd, encoding: 'utf8', windowsHide: true });
  if (ls.status !== 0 || !ls.stdout) return '';
  const files = ls.stdout.split('\n').map(s => s.trim()).filter(Boolean).filter(p => !isSelfOutput(p));
  return synthesizeFilesAsDiff(cwd, files);
}

/**
 * Render a list of repo-relative file paths as an all-added unified diff
 * (every line prefixed `+`). Shared by untracked-file synthesis (working mode)
 * and whole-tree synthesis (full-scan mode). Non-files and unreadable paths
 * are skipped silently.
 *
 * @param {string} cwd
 * @param {string[]} relPaths  repo-relative paths
 * @returns {string} concatenated unified-diff chunks
 */
const SYNTH_FILE_SIZE_LIMIT = 2 * 1024 * 1024; // 2 MB per file
const SYNTH_TOTAL_SIZE_LIMIT = 64 * 1024 * 1024; // 64 MB aggregate (guards full-scan OOM)

function synthesizeFilesAsDiff(cwd, relPaths) {
  let chunks = '';
  let truncated = false;
  for (const rel of relPaths) {
    // Aggregate cap: stop accumulating once the synthesized diff is very large,
    // so a huge full-scan / untracked tree cannot exhaust memory.
    if (chunks.length >= SYNTH_TOTAL_SIZE_LIMIT) { truncated = true; break; }
    const full = path.join(cwd, rel);
    let content;
    try {
      const stat = fs.statSync(full);
      if (!stat.isFile()) continue;
      // Skip files over the size limit to avoid OOM on huge files.
      if (stat.size > SYNTH_FILE_SIZE_LIMIT) continue;
      content = fs.readFileSync(full, 'utf8');
    } catch { continue; }
    const lines = content.split('\n');
    // strip trailing empty entry if file ends with newline (split adds one).
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    chunks += `diff --git a/${rel} b/${rel}\n`;
    chunks += `new file mode 100644\n`;
    chunks += `index 0000000..1111111\n`;
    chunks += `--- /dev/null\n`;
    chunks += `+++ b/${rel}\n`;
    chunks += `@@ -0,0 +1,${lines.length} @@\n`;
    for (const line of lines) chunks += `+${line}\n`;
  }
  if (truncated) {
    process.stderr.write(
      `warning: diff synthesis truncated at ${Math.round(SYNTH_TOTAL_SIZE_LIMIT / (1024 * 1024))}MB; some files were not scanned. Narrow the scope (avoid --full-scan on very large trees).\n`,
    );
  }
  return chunks;
}

/**
 * Resolve `--include` paths (files or directories) into repo-relative file
 * paths, ignoring .gitignore. Directories are walked recursively; node_modules
 * and .git are skipped. This is how gitignored build/codegen output gets
 * force-scanned. Paths outside `cwd` are dropped.
 *
 * @param {string} cwd
 * @param {string[]} includePaths
 * @returns {string[]} repo-relative file paths (deduped)
 */
function collectIncludeFiles(cwd, includePaths) {
  const out = [];
  const seen = new Set();
  const add = (full) => {
    const rel = path.relative(cwd, full).split(path.sep).join('/');
    if (rel && !rel.startsWith('..') && !seen.has(rel)) { seen.add(rel); out.push(rel); }
  };
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        walk(path.join(dir, e.name));
      } else if (e.isFile()) {
        add(path.join(dir, e.name));
      }
    }
  };
  for (const inc of includePaths) {
    const full = path.resolve(cwd, inc);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (stat.isFile()) add(full);
    else if (stat.isDirectory()) walk(full);
  }
  return out;
}

/**
 * Load a patch file from disk and parse it.
 * @param {string} filePath
 */
export function loadDiffFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`diff file not found: ${filePath}`);
  }
  const rawDiff = fs.readFileSync(filePath, 'utf8');
  // Patch mode does not run through dropSelfOutput (no working copy to compare),
  // so the patch file content IS the exact text the parser saw — record it as-is
  // for the evidence package's patch↔verdict binding.
  const parsed = parseDiff(rawDiff);
  parsed.rawDiff = rawDiff;
  return parsed;
}

// Exposed for unit testing the case-insensitive self-output exclusion.
export { isSelfOutput as _isSelfOutput };

// git refspec 안전 문자만 허용(선행 '-' 거부). --range 값이 git diff argv 로 흘러
// `--output=` 같은 인자 인젝션(임의 파일 쓰기)되던 것을 입구에서 차단한다.
export function isSafeGitRange(range) {
  if (typeof range !== 'string' || range.length === 0 || range.length > 200) return false;
  if (range.startsWith('-')) return false;
  return /^[A-Za-z0-9_.\/~^@{}-]+(\.\.\.?[A-Za-z0-9_.\/~^@{}-]+)?$/.test(range);
}

// range 의 head(RHS) ref 추출 — AST 가 'diff 의 post-change 내용'을 git show 로 읽을 때 사용.
// 3-dot/2-dot 우변, 빈 우변은 HEAD, 단일 ref 는 null(RHS=working tree=disk).
export function rangeHeadRef(range) {
  if (typeof range !== 'string') return null;
  const i3 = range.indexOf('...');
  if (i3 >= 0) return range.slice(i3 + 3) || 'HEAD';
  const i2 = range.indexOf('..');
  if (i2 >= 0) return range.slice(i2 + 2) || 'HEAD';
  return null;
}
