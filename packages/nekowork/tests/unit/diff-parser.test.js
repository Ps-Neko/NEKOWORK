// diff-parser: edge cases — empty input, binary files, malformed headers
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseDiff, getGitDiff } from '../../scripts/lib/diff-parser.js';

test('parseDiff: empty string returns zero-file result', () => {
  const result = parseDiff('');
  assert.equal(result.totalFiles, 0);
  assert.equal(result.totalAdditions, 0);
  assert.equal(result.totalDeletions, 0);
  assert.deepEqual(result.files, []);
});

test('parseDiff: null/undefined input returns zero-file result', () => {
  assert.equal(parseDiff(null).totalFiles, 0);
  assert.equal(parseDiff(undefined).totalFiles, 0);
});

test('parseDiff: binary file diff is marked as binary status', () => {
  const diff = [
    'diff --git a/img.png b/img.png',
    'index 0000000..1111111',
    'Binary files a/img.png and b/img.png differ',
  ].join('\n');
  const result = parseDiff(diff);
  assert.equal(result.totalFiles, 1);
  assert.equal(result.files[0].binary, true);
  assert.equal(result.files[0].status, 'binary');
  assert.equal(result.files[0].additions, 0);
  assert.equal(result.files[0].deletions, 0);
});

test('parseDiff: malformed diff header with no hunk is parsed without crash', () => {
  const diff = 'diff --git a/foo.js b/foo.js\nindex 0000000..1111111\n';
  const result = parseDiff(diff);
  assert.equal(result.totalFiles, 1);
  assert.equal(result.files[0].path, 'foo.js');
  assert.equal(result.files[0].hunks.length, 0);
});

test('parseDiff: new file mode sets status=added', () => {
  const diff = [
    'diff --git a/new.js b/new.js',
    'new file mode 100644',
    'index 0000000..1111111',
    '--- /dev/null',
    '+++ b/new.js',
    '@@ -0,0 +1,2 @@',
    '+line one',
    '+line two',
  ].join('\n');
  const result = parseDiff(diff);
  assert.equal(result.files[0].status, 'added');
  assert.equal(result.files[0].additions, 2);
  assert.equal(result.files[0].deletions, 0);
  assert.equal(result.totalAdditions, 2);
});

test('parseDiff: deleted file mode sets status=deleted', () => {
  const diff = [
    'diff --git a/old.js b/old.js',
    'deleted file mode 100644',
    'index 1111111..0000000',
    '--- a/old.js',
    '+++ /dev/null',
    '@@ -1,1 +0,0 @@',
    '-removed line',
  ].join('\n');
  const result = parseDiff(diff);
  assert.equal(result.files[0].status, 'deleted');
  assert.equal(result.files[0].deletions, 1);
});

test('parseDiff: renamed file sets status=renamed with correct paths', () => {
  const diff = [
    'diff --git a/old.js b/new.js',
    'rename from old.js',
    'rename to new.js',
    'index 1111111..2222222',
  ].join('\n');
  const result = parseDiff(diff);
  assert.equal(result.files[0].status, 'renamed');
  assert.equal(result.files[0].oldPath, 'old.js');
  assert.equal(result.files[0].path, 'new.js');
});

test('parseDiff: multiple files accumulate totalAdditions/totalDeletions', () => {
  const diff = [
    'diff --git a/a.js b/a.js',
    'index 0000000..1111111',
    '--- a/a.js',
    '+++ b/a.js',
    '@@ -1,1 +1,2 @@',
    ' context',
    '+added',
    'diff --git a/b.js b/b.js',
    'index 1111111..2222222',
    '--- a/b.js',
    '+++ b/b.js',
    '@@ -1,2 +1,1 @@',
    ' context',
    '-removed',
  ].join('\n');
  const result = parseDiff(diff);
  assert.equal(result.totalFiles, 2);
  assert.equal(result.totalAdditions, 1);
  assert.equal(result.totalDeletions, 1);
});

test('parseDiff: plain unified diff (no git header) is parsed', () => {
  // Some non-git patch tools emit `--- a/path` / `+++ b/path` with no
  // `diff --git` line. These must still produce a parsed file (regression).
  const diff = [
    '--- a/plain.js',
    '+++ b/plain.js',
    '@@ -1,1 +1,2 @@',
    ' context',
    '+added line',
  ].join('\n');
  const result = parseDiff(diff);
  assert.equal(result.totalFiles, 1);
  assert.equal(result.files[0].path, 'plain.js');
  assert.equal(result.files[0].oldPath, 'plain.js');
  assert.equal(result.files[0].additions, 1);
});

test('parseDiff: trailing newline does not inflate hunk line count', () => {
  // A trailing newline makes String.split produce a trailing empty element,
  // which must NOT be parsed as a phantom context line.
  const diff = [
    'diff --git a/a.js b/a.js',
    'index 0000000..1111111',
    '--- a/a.js',
    '+++ b/a.js',
    '@@ -1,1 +1,2 @@',
    ' context',
    '+added',
    '', // trailing newline → trailing empty element
  ].join('\n');
  const result = parseDiff(diff);
  assert.equal(result.files[0].hunks.length, 1);
  // exactly 2 real lines: one context + one addition. No phantom 3rd line.
  assert.equal(result.files[0].hunks[0].lines.length, 2);
  assert.equal(result.files[0].additions, 1);
  assert.equal(result.totalAdditions, 1);
});

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr || ''}`);
  return r.stdout;
}

test("getGitDiff: working mode excludes the tool's own output (.nekowork/ + REPORT.md)", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-selfscan-'));
  try {
    git(cwd, ['init', '-q']);
    git(cwd, ['config', 'user.email', 'test@test.local']);
    git(cwd, ['config', 'user.name', 'test']);
    git(cwd, ['config', 'commit.gpgsign', 'false']);
    fs.writeFileSync(path.join(cwd, 'README.md'), '# baseline\n');
    git(cwd, ['add', 'README.md']);
    git(cwd, ['commit', '-qm', 'baseline']);

    // a real AI change (untracked source file) — must be scanned
    fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'src', 'auth.ts'), 'export const k = process.env.X || "sk-fallback-123";\n');

    // the tool's own prior output (untracked, NOT gitignored) — must be excluded,
    // otherwise the secret text stored in its evidence is re-flagged next run.
    fs.mkdirSync(path.join(cwd, '.nekowork', 'evidence'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.nekowork', 'decision.json'), '{"verdict":"BLOCK","match":"process.env.X || \\"sk-fallback-123\\""}\n');
    fs.writeFileSync(path.join(cwd, '.nekowork', 'evidence', 'risk-findings.json'), '[{"match":"process.env.X || \\"sk-fallback-123\\""}]\n');
    fs.writeFileSync(path.join(cwd, 'REPORT.md'), '# report\n');

    const paths = getGitDiff({ cwd, mode: 'working' }).files.map(f => f.path);
    assert.ok(paths.includes('src/auth.ts'), 'real source change should be scanned');
    assert.ok(!paths.some(p => p.startsWith('.nekowork/')), '.nekowork/ output must be excluded');
    assert.ok(!paths.includes('REPORT.md'), 'REPORT.md output must be excluded');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("getGitDiff: range mode also excludes the tool's own output (committed .nekowork/ + REPORT.md)", () => {
  // Self-output filter must apply to the real git diff path (range/working/
  // staged), not just synthesized untracked diffs. A 2nd verify-pr run that
  // committed its own REPORT.md / .nekowork/evidence must not re-flag them.
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-selfscan-range-'));
  try {
    git(cwd, ['init', '-q']);
    git(cwd, ['config', 'user.email', 'test@test.local']);
    git(cwd, ['config', 'user.name', 'test']);
    git(cwd, ['config', 'commit.gpgsign', 'false']);
    fs.writeFileSync(path.join(cwd, 'base.txt'), 'base\n');
    git(cwd, ['add', 'base.txt']);
    git(cwd, ['commit', '-qm', 'baseline']);
    const baseSha = git(cwd, ['rev-parse', 'HEAD']).trim();

    // a real source change committed on top
    fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'src', 'app.ts'), 'export const x = 1;\n');
    // the tool's own output committed alongside it — must be excluded
    fs.mkdirSync(path.join(cwd, '.nekowork', 'evidence'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.nekowork', 'evidence', 'risk-findings.json'), '[{"match":"secret"}]\n');
    fs.writeFileSync(path.join(cwd, 'REPORT.md'), '# report\n');
    git(cwd, ['add', '-A']);
    git(cwd, ['commit', '-qm', 'change + tool output']);

    const paths = getGitDiff({ cwd, mode: 'range', range: `${baseSha}...HEAD` }).files.map(f => f.path);
    assert.ok(paths.includes('src/app.ts'), 'real source change should be scanned');
    assert.ok(!paths.some(p => p.startsWith('.nekowork/')), '.nekowork/ output must be excluded from range diff');
    assert.ok(!paths.includes('REPORT.md'), 'REPORT.md output must be excluded from range diff');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------- R2-12: isSelfOutput case-insensitivity ----------

import { _isSelfOutput } from '../../scripts/lib/diff-parser.js';

test('_isSelfOutput: REPORT.md and .nekowork/ excluded regardless of case', () => {
  assert.equal(_isSelfOutput('REPORT.md'), true);
  assert.equal(_isSelfOutput('REPORT.MD'), true);
  assert.equal(_isSelfOutput('report.md'), true);
  assert.equal(_isSelfOutput('.nekowork/decision.json'), true);
  assert.equal(_isSelfOutput('.NEKOWORK/evidence/x.json'), true);
});

test('_isSelfOutput: real source files are not excluded', () => {
  assert.equal(_isSelfOutput('src/index.js'), false);
  assert.equal(_isSelfOutput('REPORT.md.bak'), false);
  assert.equal(_isSelfOutput('docs/report.md.txt'), false);
});
