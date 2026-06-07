// git-mutation-guard: synchronous apply guard (withGitMutationGuardSync)
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withGitMutationGuardSync, readGitStatus } from '../../scripts/core/git-mutation-guard.js';

function run(bin, args, cwd) {
  const r = spawnSync(bin, args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`${bin} ${args.join(' ')} failed:\n${r.stderr || r.stdout}`);
}

function makeGitRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-git-guard-sync-'));
  run('git', ['init', '-q'], root);
  run('git', ['config', 'user.email', 'test@test.local'], root);
  run('git', ['config', 'user.name', 'test'], root);
  run('git', ['config', 'commit.gpgsign', 'false'], root);
  fs.writeFileSync(path.join(root, 'base.txt'), 'base\n');
  run('git', ['add', 'base.txt'], root);
  run('git', ['commit', '-qm', 'baseline'], root);
  return root;
}

test('withGitMutationGuardSync: returns fn result when only expected files change', () => {
  const root = makeGitRepo();
  try {
    const result = withGitMutationGuardSync(
      root,
      () => { fs.writeFileSync(path.join(root, 'expected.txt'), 'x'); return 'ok'; },
      { expectedPaths: ['expected.txt'] },
    );
    assert.equal(result, 'ok');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('withGitMutationGuardSync: rejects an unexpected extra mutation', () => {
  const root = makeGitRepo();
  try {
    assert.throws(
      () => withGitMutationGuardSync(
        root,
        () => {
          fs.writeFileSync(path.join(root, 'expected.txt'), 'x');
          fs.writeFileSync(path.join(root, 'stray.txt'), 'extra'); // not in expectedPaths
        },
        { label: 'apply', expectedPaths: ['expected.txt'] },
      ),
      /apply produced unexpected git changes[\s\S]*stray\.txt/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('withGitMutationGuardSync: env bypass allows any mutation', () => {
  const root = makeGitRepo();
  try {
    withGitMutationGuardSync(
      root,
      () => { fs.writeFileSync(path.join(root, 'stray.txt'), 'extra'); },
      { expectedPaths: [], env: { HARNESS_ALLOW_WORKSPACE_MUTATION: '1' } },
    );
    assert.match(readGitStatus(root).text, /stray\.txt/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('withGitMutationGuardSync: no-op outside a git worktree', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-not-git-sync-'));
  try {
    const result = withGitMutationGuardSync(root, () => 'ok', {});
    assert.equal(result, 'ok');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
