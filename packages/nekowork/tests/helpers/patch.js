// Shared test helper: synthesize unified .patch text for verify-pr `mode:'patch'`.
//
// verify-pr's patch mode parses a unified diff with `loadDiffFile` → `parseDiff`,
// so a synthetic all-added file (every line prefixed `+`, `--- /dev/null`) is the
// minimal valid input. This mirrors the shape `diff-parser.js` emits for new
// files, so integration tests can drive each verdict without a real git repo.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Build an all-added unified diff for a single new file.
 * @param {string} file repo-relative path (e.g. 'src/app.js')
 * @param {string[]} lines added file content, one entry per line
 * @returns {string} unified diff text
 */
export function newFilePatch(file, lines) {
  const body = lines.map((l) => `+${l}`).join('\n');
  return (
    `diff --git a/${file} b/${file}\n` +
    `new file mode 100644\n` +
    `index 0000000..1111111\n` +
    `--- /dev/null\n` +
    `+++ b/${file}\n` +
    `@@ -0,0 +1,${lines.length} @@\n` +
    `${body}\n`
  );
}

/**
 * Concatenate several single-file patches into one multi-file patch.
 * @param {Array<{ file: string, lines: string[] }>} files
 * @returns {string}
 */
export function multiFilePatch(files) {
  return files.map(({ file, lines }) => newFilePatch(file, lines)).join('');
}

/**
 * Write `content` to a fresh temp dir and return the file path. Caller removes
 * the dir (returned as `.dir`) in a finally block.
 * @param {string} content patch text
 * @param {string} [prefix]
 * @returns {{ path: string, dir: string }}
 */
export function writePatchFile(content, prefix = 'harness-patch-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const p = path.join(dir, 'change.patch');
  fs.writeFileSync(p, content);
  return { path: p, dir };
}

/**
 * Create a temp project root, seeding `files` (relative path → content).
 * @param {Record<string, string>} [files]
 * @param {string} [prefix]
 * @returns {string} absolute path to the project root
 */
export function makeProjectRoot(files = {}, prefix = 'harness-proot-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

/** A package.json whose scripts make test/lint/typecheck all "available". */
export const PKG_WITH_CHECKS = JSON.stringify(
  { name: 'fixture', version: '0.0.0', scripts: { test: 'node --test', lint: 'eslint .', typecheck: 'tsc --noEmit' } },
  null,
  2,
);
