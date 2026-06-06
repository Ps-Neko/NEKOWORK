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
