// git-mutation-guard: ASYNC review guard (withGitMutationGuard).
// The sync apply variant (withGitMutationGuardSync) is covered in
// git-mutation-guard.test.js. This mirrors those cases for the async guard,
// whose contract differs: it is a blunt before≠after check (any workspace
// mutation during a guarded read-only runner is unexpected) rather than the
// sync guard's expectedPaths allow-list.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withGitMutationGuard, readGitStatus } from '../../scripts/core/git-mutation-guard.js';

function run(bin, args, cwd) {
  const r = spawnSync(bin, args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`${bin} ${args.join(' ')} failed:\n${r.stderr || r.stdout}`);
}

function makeGitRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-git-guard-async-'));
  run('git', ['init', '-q'], root);
  run('git', ['config', 'user.email', 'test@test.local'], root);
  run('git', ['config', 'user.name', 'test'], root);
  run('git', ['config', 'commit.gpgsign', 'false'], root);
  fs.writeFileSync(path.join(root, 'base.txt'), 'base\n');
  run('git', ['add', 'base.txt'], root);
  run('git', ['commit', '-qm', 'baseline'], root);
  return root;
}

// Happy path: no mutation → fn() result returned unchanged.
test('withGitMutationGuard: returns fn result when the workspace is untouched', async () => {
  const root = makeGitRepo();
  try {
    const result = await withGitMutationGuard(root, async () => 'ok', { label: 'review' });
    assert.equal(result, 'ok');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// (a) unexpected mutation detected → rejects.
test('withGitMutationGuard: rejects when fn mutates the workspace', async () => {
  const root = makeGitRepo();
  try {
    await assert.rejects(
      withGitMutationGuard(
        root,
        async () => { fs.writeFileSync(path.join(root, 'stray.txt'), 'extra'); return 'leaked'; },
        { label: 'review' },
      ),
      (err) => {
        assert.match(err.message, /review changed the git workspace during guarded execution/);
        assert.match(err.message, /stray\.txt/);
        return true;
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// (b) env bypass: HARNESS_ALLOW_WORKSPACE_MUTATION=1 → no-op, any mutation allowed.
test('withGitMutationGuard: env bypass allows any mutation', async () => {
  const root = makeGitRepo();
  try {
    const result = await withGitMutationGuard(
      root,
      async () => { fs.writeFileSync(path.join(root, 'stray.txt'), 'extra'); return 'ok'; },
      { env: { HARNESS_ALLOW_WORKSPACE_MUTATION: '1' } },
    );
    assert.equal(result, 'ok');
    assert.match(readGitStatus(root).text, /stray\.txt/, 'mutation was not reverted, just un-guarded');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// (c1) no-op outside a git worktree (readGitStatus returns null → guard skips).
test('withGitMutationGuard: no-op outside a git worktree', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-not-git-async-'));
  try {
    // Even a mutation is tolerated because there is no git status to diff against.
    const result = await withGitMutationGuard(
      root,
      async () => { fs.writeFileSync(path.join(root, 'whatever.txt'), 'x'); return 'ok'; },
      {},
    );
    assert.equal(result, 'ok');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// (c2) no-op when root is falsy.
test('withGitMutationGuard: no-op when root is not provided', async () => {
  const result = await withGitMutationGuard(null, async () => 'ok', {});
  assert.equal(result, 'ok');
});

// (d) fn() error is re-thrown when there is NO mutation.
test('withGitMutationGuard: re-throws fn error when the workspace is untouched', async () => {
  const root = makeGitRepo();
  try {
    await assert.rejects(
      withGitMutationGuard(root, async () => { throw new Error('boom'); }, { label: 'review' }),
      (err) => {
        assert.equal(err.message, 'boom', 'original error surfaces verbatim, not the mutation message');
        return true;
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// (d') fn() error AND a mutation → mutation error is thrown, original attached as cause.
test('withGitMutationGuard: when fn both mutates and throws, the mutation error wins with cause set', async () => {
  const root = makeGitRepo();
  try {
    await assert.rejects(
      withGitMutationGuard(
        root,
        async () => { fs.writeFileSync(path.join(root, 'stray.txt'), 'x'); throw new Error('boom'); },
        { label: 'review' },
      ),
      (err) => {
        assert.match(err.message, /review changed the git workspace/);
        assert.match(err.message, /Original error:[\s\S]*boom/);
        assert.ok(err.cause instanceof Error && err.cause.message === 'boom',
          'original error is attached as .cause');
        return true;
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
