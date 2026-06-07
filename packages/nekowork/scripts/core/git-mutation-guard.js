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

/**
 * Synchronous mutation guard for `apply`: the apply step DOES legitimately
 * mutate the working tree, so a blunt before≠after check is wrong here. Instead
 * we sanction the EXPECTED files (the diff's own files) and reject only changes
 * to git-tracked paths OUTSIDE that set — i.e. an unexpected EXTRA mutation
 * (a stray commit/checkout/branch op or an edit to an unrelated file the apply
 * was not supposed to touch).
 *
 * Behavior-preserving: when only the expected files changed (the normal case)
 * this returns fn()'s result unchanged. No-op outside a git worktree or when
 * `allowEnvKey` is set to '1'.
 *
 * @param {string} root
 * @param {() => T} fn  synchronous function performing the apply
 * @param {object} [options]
 * @param {string[]} [options.expectedPaths]  repo-relative paths the apply may touch
 * @param {string} [options.label]
 * @param {string} [options.allowEnvKey]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @returns {T}
 * @template T
 */
export function withGitMutationGuardSync(root, fn, options = {}) {
  const label = options.label || 'apply';
  const allowEnvKey = options.allowEnvKey || 'HARNESS_ALLOW_WORKSPACE_MUTATION';
  const env = options.env || process.env;
  const expected = new Set((options.expectedPaths || []).map(p => String(p).split('\\').join('/')));

  if (!root || env[allowEnvKey] === '1' || !isGitWorkTree(root)) {
    return fn();
  }

  const beforeSet = changedPathSet(root);
  const result = fn();
  const afterSet = changedPathSet(root);

  const unexpected = [...afterSet].filter(p => !beforeSet.has(p) && !expected.has(p));
  if (unexpected.length) {
    throw new Error([
      `${label} produced unexpected git changes outside the applied diff.`,
      `Set ${allowEnvKey}=1 only when these extra mutations are intentional.`,
      '',
      'Unexpected paths:',
      ...unexpected.map(p => `  ${p}`),
    ].join('\n'));
  }
  return result;
}

function changedPathSet(root) {
  const text = runGit(root, ['status', '--porcelain=v1']);
  const set = new Set();
  for (const line of (text || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    // porcelain v1: "XY <path>" (and "XY <old> -> <new>" for renames).
    let p = line.slice(3).trim();
    const arrow = p.indexOf(' -> ');
    if (arrow !== -1) p = p.slice(arrow + 4);
    // strip optional surrounding quotes git adds for unusual paths
    p = p.replace(/^"(.*)"$/, '$1').split('\\').join('/');
    set.add(p);
  }
  return set;
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
