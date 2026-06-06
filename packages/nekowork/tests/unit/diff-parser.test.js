// diff-parser: edge cases — empty input, binary files, malformed headers
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseDiff } from '../../scripts/lib/diff-parser.js';

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
