import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { applyExecutionDiff, withExecutionWorkspace } from '../../scripts/core/execution-workspace.js';

test('execution workspace captures tracked and untracked changes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-exec-root-'));
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-exec-session-'));
  git(root, ['init']);
  git(root, ['config', 'user.email', 'unit@example.invalid']);
  git(root, ['config', 'user.name', 'Unit Test']);
  fs.writeFileSync(path.join(root, 'README.md'), 'before\n');
  git(root, ['add', 'README.md']);
  git(root, ['commit', '-m', 'init']);

  const result = await withExecutionWorkspace(root, sessionDir, async (workspaceRoot) => {
    fs.writeFileSync(path.join(workspaceRoot, 'README.md'), 'after\n');
    fs.writeFileSync(path.join(workspaceRoot, 'NEW.md'), 'new\n');
    return { ok: true };
  }, { sessionId: 'unit', stage: 'implement', round: 2 });

  assert.equal(result.result.ok, true);
  assert.match(result.diff, /README.md/);
  assert.match(result.diff, /NEW.md/);
  assert.deepEqual(result.files.sort(), ['NEW.md', 'README.md']);
  assert.ok(fs.existsSync(result.diffPath));
  assert.equal(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), 'before\n');

  assert.equal(applyExecutionDiff(root, result.diff), true);
  assert.equal(readLf(path.join(root, 'README.md')), 'after\n');
  assert.equal(readLf(path.join(root, 'NEW.md')), 'new\n');
});

test('execution workspace can start from a base diff', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-exec-root-'));
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-exec-session-'));
  git(root, ['init']);
  git(root, ['config', 'user.email', 'unit@example.invalid']);
  git(root, ['config', 'user.name', 'Unit Test']);
  fs.writeFileSync(path.join(root, 'README.md'), 'base\n');
  git(root, ['add', 'README.md']);
  git(root, ['commit', '-m', 'init']);

  const baseDiff = [
    'diff --git a/README.md b/README.md',
    'index df967b9..cb70148 100644',
    '--- a/README.md',
    '+++ b/README.md',
    '@@ -1 +1 @@',
    '-base',
    '+first',
    '',
  ].join('\n');

  const result = await withExecutionWorkspace(root, sessionDir, async (workspaceRoot) => {
    assert.equal(readLf(path.join(workspaceRoot, 'README.md')), 'first\n');
    fs.writeFileSync(path.join(workspaceRoot, 'README.md'), 'second\n');
    return { ok: true };
  }, { sessionId: 'unit', stage: 'implement', round: 1, baseDiff });

  assert.match(result.diff, /\+second/);
  assert.doesNotMatch(result.diff, /\+first/);
});

function git(cwd, args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed\n${r.stderr || r.stdout}`);
}

function readLf(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
