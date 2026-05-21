import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withGitMutationGuard, readGitStatus } from '../../scripts/core/git-mutation-guard.js';

test('git mutation guard returns normally when workspace is unchanged', async () => {
  const root = makeGitRepo();
  const result = await withGitMutationGuard(root, async () => 'ok', { label: 'unit-test' });
  assert.equal(result, 'ok');
});

test('git mutation guard rejects when guarded code writes to the workspace', async () => {
  const root = makeGitRepo();
  await assert.rejects(
    () => withGitMutationGuard(root, async () => {
      fs.writeFileSync(path.join(root, 'mutated.txt'), 'changed');
    }, { label: 'codex', allowEnvKey: 'HARNESS_CODEX_ALLOW_WORKSPACE_MUTATION' }),
    /codex changed the git workspace[\s\S]*mutated.txt/
  );
});

test('git mutation guard can be explicitly bypassed by env', async () => {
  const root = makeGitRepo();
  await withGitMutationGuard(root, async () => {
    fs.writeFileSync(path.join(root, 'allowed.txt'), 'changed');
  }, {
    label: 'codex',
    allowEnvKey: 'HARNESS_CODEX_ALLOW_WORKSPACE_MUTATION',
    env: { HARNESS_CODEX_ALLOW_WORKSPACE_MUTATION: '1' },
  });

  assert.match(readGitStatus(root).text, /allowed\.txt/);
});

test('git mutation guard is a no-op outside git worktrees', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-not-git-'));
  const result = await withGitMutationGuard(root, async () => 'ok', { label: 'unit-test' });
  assert.equal(result, 'ok');
  assert.equal(readGitStatus(root), null);
});

function makeGitRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-git-guard-'));
  run('git', ['init', '-q'], root);
  fs.writeFileSync(path.join(root, 'base.txt'), 'base');
  run('git', ['add', 'base.txt'], root);
  return root;
}

function run(bin, args, cwd) {
  const r = spawnSync(bin, args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) {
    throw new Error(`${bin} ${args.join(' ')} failed:\n${r.stderr || r.stdout}`);
  }
}
