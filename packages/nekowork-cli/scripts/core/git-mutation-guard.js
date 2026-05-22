import { spawnSync } from 'node:child_process';

export async function withGitMutationGuard(root, fn, options = {}) {
  const label = options.label || 'process';
  const allowEnvKey = options.allowEnvKey || 'HARNESS_ALLOW_WORKSPACE_MUTATION';
  const env = options.env || process.env;

  if (!root || env[allowEnvKey] === '1') {
    return await fn();
  }

  const before = readGitStatus(root);
  if (!before) {
    return await fn();
  }

  let result;
  let originalError;
  try {
    result = await fn();
  } catch (e) {
    originalError = e;
  }

  const after = readGitStatus(root);
  if (after && before.raw !== after.raw) {
    const msg = [
      `${label} changed the git workspace during guarded execution.`,
      'This usually means a read-only review runner wrote files despite sandbox settings.',
      `Set ${allowEnvKey}=1 only when this mutation is intentional.`,
      '',
      'Before:',
      before.text || '(clean)',
      '',
      'After:',
      after.text || '(clean)',
    ];
    if (originalError) {
      msg.push('', 'Original error:', originalError.message || String(originalError));
    }
    const mutationError = new Error(msg.join('\n'));
    if (originalError) mutationError.cause = originalError;
    throw mutationError;
  }

  if (originalError) throw originalError;
  return result;
}

export function readGitStatus(root) {
  if (!isGitWorkTree(root)) return null;

  const raw = runGit(root, ['status', '--porcelain=v1', '-z']);
  const text = runGit(root, ['status', '--short']);
  return { raw, text };
}

function isGitWorkTree(root) {
  try {
    const r = spawnSync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    return r.status === 0 && r.stdout.trim() === 'true';
  } catch {
    return false;
  }
}

function runGit(root, args) {
  const r = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}
