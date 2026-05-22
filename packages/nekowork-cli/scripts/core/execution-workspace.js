import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export async function withExecutionWorkspace(root, sessionDir, fn, options = {}) {
  const worktreeRoot = fs.mkdtempSync(path.join(os.tmpdir(), `harness-exec-${options.sessionId || 'session'}-`));
  const keep = process.env.HARNESS_KEEP_EXECUTION_WORKTREE === '1';

  runGit(root, ['worktree', 'add', '--detach', worktreeRoot, 'HEAD']);

  try {
    if (options.baseDiff) applyExecutionDiff(worktreeRoot, options.baseDiff);
    const result = await fn(worktreeRoot);
    const diff = captureExecutionDiff(worktreeRoot);
    const files = changedFiles(worktreeRoot);
    const diffPath = persistDiff(sessionDir, options.stage || 'implement', options.round || 1, diff);

    return {
      result,
      worktreeRoot: keep ? worktreeRoot : null,
      diff,
      diffPath,
      files,
    };
  } finally {
    if (!keep) {
      removeWorktree(root, worktreeRoot);
      removeDir(worktreeRoot);
    }
  }
}

export function applyExecutionDiff(root, diff) {
  if (!String(diff || '').trim()) return false;
  const r = spawnSync('git', ['-C', root, 'apply', '--3way', '--whitespace=nowarn'], {
    input: diff,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.status !== 0) {
    throw new Error(`git apply failed in ${root}\n${r.stderr || r.stdout}`);
  }
  return true;
}

export function captureExecutionDiff(worktreeRoot) {
  // Intent-to-add makes untracked files visible in the captured patch.
  runGit(worktreeRoot, ['add', '-N', '.'], { allowFailure: true });
  return runGit(worktreeRoot, ['diff', '--binary', 'HEAD']).stdout;
}

export function changedFiles(worktreeRoot) {
  const out = runGit(worktreeRoot, ['diff', '--name-only', 'HEAD']).stdout.trim();
  return out ? out.split(/\r?\n/).filter(Boolean) : [];
}

function persistDiff(sessionDir, stage, round, diff) {
  if (!sessionDir || !diff) return null;
  const dir = path.join(sessionDir, 'diffs');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${String(round).padStart(2, '0')}-${stage}.diff`);
  fs.writeFileSync(f, diff);
  return f;
}

function removeWorktree(root, worktreeRoot) {
  runGit(root, ['worktree', 'remove', '--force', worktreeRoot], { allowFailure: true });
}

function removeDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function runGit(cwd, args, options = {}) {
  const r = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.status !== 0 && !options.allowFailure) {
    throw new Error(`git ${args.join(' ')} failed in ${cwd}\n${r.stderr || r.stdout}`);
  }
  return { stdout: r.stdout || '', stderr: r.stderr || '', status: r.status ?? 1 };
}
