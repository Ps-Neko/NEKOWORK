// apply: session-id path-traversal guard + git-mutation guard wiring
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { applyCycle } from '../../scripts/orchestrators/apply.js';

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr || ''}`);
  return r.stdout;
}

// --- Fix 12: session-id path-traversal sanitization ---
test('applyCycle: rejects a session id containing ..', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-apply-'));
  try {
    assert.throws(
      () => applyCycle({ projectRoot: root, sessionId: '../../etc' }),
      /invalid session id/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('applyCycle: rejects an absolute session id', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-apply-'));
  try {
    const abs = process.platform === 'win32' ? 'C:\\evil' : '/evil';
    assert.throws(
      () => applyCycle({ projectRoot: root, sessionId: abs }),
      /invalid session id/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- Fix 13: the git-mutation guard is wired around the apply ---
// A SHIP_READY session whose captured diff edits a file NOT in the implement
// handoff's `files` set must be rejected as an unexpected extra mutation,
// proving withGitMutationGuardSync runs in the shipped apply path.
test('applyCycle: guard rejects a diff that touches files outside the implement set', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-apply-guard-'));
  try {
    // git repo with a clean baseline (apply requires a clean worktree)
    git(root, ['init', '-q']);
    git(root, ['config', 'user.email', 'test@test.local']);
    git(root, ['config', 'user.name', 'test']);
    git(root, ['config', 'commit.gpgsign', 'false']);
    fs.writeFileSync(path.join(root, 'README.md'), '# base\n');
    git(root, ['add', 'README.md']);
    git(root, ['commit', '-qm', 'baseline']);

    const sessionId = 'sess-1';
    const sessionDir = path.join(root, '.harness', 'state', 'sessions', sessionId);
    const handoffDir = path.join(sessionDir, 'handoffs');
    const diffDir = path.join(sessionDir, 'diffs');
    fs.mkdirSync(handoffDir, { recursive: true });
    fs.mkdirSync(diffDir, { recursive: true });

    // implement handoff declares it only touches expected.txt ...
    fs.writeFileSync(path.join(handoffDir, '01-implement.json'), JSON.stringify({
      stage: 'implement', round: 1, files: ['expected.txt'], diffPath: path.join(diffDir, '01-implement.diff'),
    }));
    // codex-review handoff (apply requires verification)
    fs.writeFileSync(path.join(handoffDir, '02-codex-review.json'), JSON.stringify({
      stage: 'codex-review', round: 1, verdict: 'approve',
    }));

    // ... but the captured diff ALSO creates stray.txt (an extra mutation)
    const diff = [
      'diff --git a/expected.txt b/expected.txt',
      'new file mode 100644',
      'index 0000000..1111111',
      '--- /dev/null',
      '+++ b/expected.txt',
      '@@ -0,0 +1,1 @@',
      '+ok',
      'diff --git a/stray.txt b/stray.txt',
      'new file mode 100644',
      'index 0000000..2222222',
      '--- /dev/null',
      '+++ b/stray.txt',
      '@@ -0,0 +1,1 @@',
      '+extra',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(diffDir, '01-implement.diff'), diff);

    // gate clear + SHIP_READY so we reach the guarded apply
    fs.writeFileSync(path.join(sessionDir, 'SHIP_READY'), 'reason: ready\nat: 2026-01-01T00:00:00.000Z\n');

    assert.throws(
      () => applyCycle({ projectRoot: root, sessionId }),
      /unexpected git changes[\s\S]*stray\.txt/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- R2-16: gate approval is bound to the diff content (forge resistance) ---

import { applyCycle as _applyCycle2 } from '../../scripts/orchestrators/apply.js';
import { approveGate } from '../../scripts/orchestrators/gate.js';
import { computeSessionDiffHash } from '../../scripts/orchestrators/_handoff-utils.js';

function makeApprovedSession(root, diffText) {
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@test.local']);
  git(root, ['config', 'user.name', 'test']);
  git(root, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(root, 'README.md'), '# base\n');
  git(root, ['add', 'README.md']);
  git(root, ['commit', '-qm', 'baseline']);

  const sessionId = 'sess-approve';
  const sessionDir = path.join(root, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');
  const diffDir = path.join(sessionDir, 'diffs');
  fs.mkdirSync(handoffDir, { recursive: true });
  fs.mkdirSync(diffDir, { recursive: true });
  fs.writeFileSync(path.join(handoffDir, '01-implement.json'), JSON.stringify({
    stage: 'implement', round: 1, files: ['feature.txt'], diffPath: path.join(diffDir, '01-implement.diff'),
  }));
  fs.writeFileSync(path.join(handoffDir, '02-codex-review.json'), JSON.stringify({
    stage: 'codex-review', round: 1, verdict: 'approve',
  }));
  fs.writeFileSync(path.join(diffDir, '01-implement.diff'), diffText);
  // Open the human gate, then approve it (records the diff hash).
  fs.writeFileSync(path.join(sessionDir, 'HUMAN_GATE'), 'reason: review needed\nat: 2026-01-01T00:00:00.000Z\n');
  approveGate({ projectRoot: root, sessionId, reason: 'looks good', actor: 'tester' });
  fs.writeFileSync(path.join(sessionDir, 'SHIP_READY'), 'reason: ready\nat: 2026-01-02T00:00:00.000Z\n');
  return { sessionId, sessionDir, diffDir };
}

const featureDiff = [
  'diff --git a/feature.txt b/feature.txt',
  'new file mode 100644',
  'index 0000000..1111111',
  '--- /dev/null',
  '+++ b/feature.txt',
  '@@ -0,0 +1,1 @@',
  '+approved content',
  '',
].join('\n');

test('approveGate records the diff hash into GATE_APPROVED', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-apply-bind-'));
  try {
    const { sessionDir } = makeApprovedSession(root, featureDiff);
    const approved = fs.readFileSync(path.join(sessionDir, 'GATE_APPROVED'), 'utf8');
    assert.match(approved, /diff_hash: [0-9a-f]{64}/);
    const expected = computeSessionDiffHash(sessionDir);
    assert.ok(approved.includes(`diff_hash: ${expected}`));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('applyCycle: applies when the diff matches the approved hash', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-apply-match-'));
  try {
    const { sessionId } = makeApprovedSession(root, featureDiff);
    const result = _applyCycle2({ projectRoot: root, sessionId });
    assert.equal(result.applied, true);
    assert.ok(fs.existsSync(path.join(root, 'feature.txt')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('applyCycle: refuses when the diff changed after approval (forge guard)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-apply-mismatch-'));
  try {
    const { sessionId, diffDir } = makeApprovedSession(root, featureDiff);
    // Tamper: replace the captured diff with DIFFERENT content after approval.
    const tampered = featureDiff.replace('+approved content', '+TAMPERED content');
    fs.writeFileSync(path.join(diffDir, '01-implement.diff'), tampered);
    assert.throws(
      () => _applyCycle2({ projectRoot: root, sessionId }),
      /approval does not match current diff/,
    );
    // and nothing was applied
    assert.ok(!fs.existsSync(path.join(root, 'feature.txt')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- Gate-binding bypass: an approval recorded BEFORE a diff existed carries no
// diff_hash. apply's binding check used to be `if (approval?.diffHash)`, so an
// unbound approval was honored for an arbitrary diff added later — defeating the
// "approval is bound to the exact content approved" guarantee. apply must now
// fail closed when a non-empty diff is applied under an approval with no bound
// hash.
test('applyCycle: refuses an unbound approval (gate approved before a diff was captured)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-apply-unbound-'));
  try {
    git(root, ['init', '-q']);
    git(root, ['config', 'user.email', 'test@test.local']);
    git(root, ['config', 'user.name', 'test']);
    git(root, ['config', 'commit.gpgsign', 'false']);
    fs.writeFileSync(path.join(root, 'README.md'), '# base\n');
    git(root, ['add', 'README.md']);
    git(root, ['commit', '-qm', 'baseline']);

    const sessionId = 'sess-unbound';
    const sessionDir = path.join(root, '.harness', 'state', 'sessions', sessionId);
    const handoffDir = path.join(sessionDir, 'handoffs');
    const diffDir = path.join(sessionDir, 'diffs');
    fs.mkdirSync(handoffDir, { recursive: true });
    fs.mkdirSync(diffDir, { recursive: true });
    fs.writeFileSync(path.join(handoffDir, '01-implement.json'), JSON.stringify({
      stage: 'implement', round: 1, files: ['feature.txt'], diffPath: path.join(diffDir, '01-implement.diff'),
    }));
    fs.writeFileSync(path.join(handoffDir, '02-codex-review.json'), JSON.stringify({
      stage: 'codex-review', round: 1, verdict: 'approve',
    }));
    // Approve while NO diff file exists yet → GATE_APPROVED carries no diff_hash.
    fs.writeFileSync(path.join(sessionDir, 'HUMAN_GATE'), 'reason: review needed\nat: 2026-01-01T00:00:00.000Z\n');
    approveGate({ projectRoot: root, sessionId, reason: 'pre-approved', actor: 'tester' });
    const approved = fs.readFileSync(path.join(sessionDir, 'GATE_APPROVED'), 'utf8');
    assert.ok(!/diff_hash:/.test(approved), 'precondition: approval is unbound (no diff_hash)');

    // Now an arbitrary, never-reviewed diff appears and ship is marked ready.
    fs.writeFileSync(path.join(diffDir, '01-implement.diff'), featureDiff);
    fs.writeFileSync(path.join(sessionDir, 'SHIP_READY'), 'reason: ready\nat: 2026-01-02T00:00:00.000Z\n');

    assert.throws(
      () => _applyCycle2({ projectRoot: root, sessionId }),
      /not bound|re-approve/i,
    );
    assert.ok(!fs.existsSync(path.join(root, 'feature.txt')), 'unbound approval must not apply anything');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
