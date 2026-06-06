import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseDiff, addedLines } from '@ps-neko/nekowork/scripts/lib/diff-parser.js';

const SIMPLE_DIFF = `diff --git a/src/auth.ts b/src/auth.ts
index 1111111..2222222 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -40,3 +40,4 @@ export function getApiKey() {
   if (process.env.API_KEY) {
     return process.env.API_KEY;
   }
+  return "fallback-secret";
 }
`;

const MULTI_FILE_DIFF = `diff --git a/a.ts b/a.ts
index 1111111..2222222 100644
--- a/a.ts
+++ b/a.ts
@@ -1,2 +1,3 @@
 line1
+added
 line2
diff --git a/b.ts b/b.ts
index 3333333..4444444 100644
--- a/b.ts
+++ b/b.ts
@@ -1,3 +1,2 @@
 line1
-deleted
 line2
`;

const NEW_FILE_DIFF = `diff --git a/new.ts b/new.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,2 @@
+first line
+second line
`;

const DELETED_FILE_DIFF = `diff --git a/old.ts b/old.ts
deleted file mode 100644
index 1111111..0000000
--- a/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-line1
-line2
`;

const RENAME_DIFF = `diff --git a/old.ts b/new.ts
similarity index 90%
rename from old.ts
rename to new.ts
index 1111111..2222222 100644
--- a/old.ts
+++ b/new.ts
@@ -1,3 +1,3 @@
 keep1
-old line
+new line
 keep2
`;

const BINARY_DIFF = `diff --git a/img.png b/img.png
index 1111111..2222222 100644
Binary files a/img.png and b/img.png differ
`;

test('단일 파일 modified diff 파싱', () => {
  const r = parseDiff(SIMPLE_DIFF);
  assert.equal(r.totalFiles, 1);
  assert.equal(r.files[0].path, 'src/auth.ts');
  assert.equal(r.files[0].status, 'modified');
  assert.equal(r.files[0].additions, 1);
  assert.equal(r.files[0].deletions, 0);
});

test('added line 의 newLineNumber 보존', () => {
  const r = parseDiff(SIMPLE_DIFF);
  const added = r.files[0].hunks[0].lines.find(l => l.type === '+');
  assert.equal(added.content, '  return "fallback-secret";');
  assert.equal(added.newLineNumber, 43);
});

test('multi-file diff: 파일 2개, 추가/삭제 분리 카운트', () => {
  const r = parseDiff(MULTI_FILE_DIFF);
  assert.equal(r.totalFiles, 2);
  assert.equal(r.totalAdditions, 1);
  assert.equal(r.totalDeletions, 1);
  assert.equal(r.files[0].path, 'a.ts');
  assert.equal(r.files[0].additions, 1);
  assert.equal(r.files[1].path, 'b.ts');
  assert.equal(r.files[1].deletions, 1);
});

test('new file mode → status=added', () => {
  const r = parseDiff(NEW_FILE_DIFF);
  assert.equal(r.files[0].status, 'added');
  assert.equal(r.files[0].additions, 2);
});

test('deleted file mode → status=deleted', () => {
  const r = parseDiff(DELETED_FILE_DIFF);
  assert.equal(r.files[0].status, 'deleted');
  assert.equal(r.files[0].deletions, 2);
});

test('rename → status=renamed, path/oldPath 분리', () => {
  const r = parseDiff(RENAME_DIFF);
  assert.equal(r.files[0].status, 'renamed');
  assert.equal(r.files[0].oldPath, 'old.ts');
  assert.equal(r.files[0].path, 'new.ts');
});

test('Binary file → binary=true, hunks 없음', () => {
  const r = parseDiff(BINARY_DIFF);
  assert.equal(r.files[0].binary, true);
  assert.equal(r.files[0].status, 'binary');
  assert.equal(r.files[0].hunks.length, 0);
});

test('빈 입력 → 파일 0개', () => {
  assert.deepEqual(parseDiff('').files, []);
  assert.deepEqual(parseDiff(null).files, []);
  assert.deepEqual(parseDiff(undefined).files, []);
});

test('addedLines: 파일+라인+content 추출, binary 는 제외', () => {
  const combined = SIMPLE_DIFF + BINARY_DIFF;
  const r = parseDiff(combined);
  const added = addedLines(r);
  assert.equal(added.length, 1);
  assert.equal(added[0].path, 'src/auth.ts');
  assert.equal(added[0].line, 43);
  assert.match(added[0].content, /fallback-secret/);
});

test('hunk 헤더의 single-line count (@@ -1 +1 @@) 처리', () => {
  const singleLineHunk = `diff --git a/x.ts b/x.ts
index 1111111..2222222 100644
--- a/x.ts
+++ b/x.ts
@@ -1 +1 @@
-old
+new
`;
  const r = parseDiff(singleLineHunk);
  assert.equal(r.files[0].hunks[0].oldLines, 1);
  assert.equal(r.files[0].hunks[0].newLines, 1);
  assert.equal(r.files[0].additions, 1);
  assert.equal(r.files[0].deletions, 1);
});
