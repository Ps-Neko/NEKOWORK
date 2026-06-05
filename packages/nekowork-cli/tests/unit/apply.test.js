import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { applyCycle, _readApplyGitStatus } from '../../scripts/orchestrators/apply.js';
import { rmrf } from '../helpers/tmp.js';

function createGitProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-apply-project-'));
  git(root, ['init']);
  git(root, ['config', 'user.email', 'unit@example.invalid']);
  git(root, ['config', 'user.name', 'Unit Test']);
  fs.writeFileSync(path.join(root, 'README.md'), 'before\n');
  git(root, ['add', 'README.md']);
  git(root, ['commit', '-m', 'init']);
  return root;
}

function seedReadySession(projectRoot, sessionId, diff = readmeDiff()) {
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');
  const diffDir = path.join(sessionDir, 'diffs');
  fs.mkdirSync(handoffDir, { recursive: true });
  fs.mkdirSync(diffDir, { recursive: true });
  const diffPath = path.join(diffDir, '01-implement.diff');
  fs.writeFileSync(diffPath, diff);
  writeJson(path.join(handoffDir, '03-implement.json'), {
    stage: 'implement',
    agent: 'executor',
    round: 1,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: 1,
    provider: 'mock',
    model: 'sonnet',
    decided: 'implemented',
    files: ['README.md'],
    diffPath,
  });
  writeJson(path.join(handoffDir, '05-codex-review.json'), {
    stage: 'codex-review',
    agent: 'codex-reviewer',
    round: 1,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: 1,
    provider: 'mock',
    model: 'gpt-5-codex',
    decided: 'verified',
    files: ['README.md'],
    verdict: 'approve',
    issues: [],
  });
  fs.writeFileSync(path.join(sessionDir, 'SHIP_READY'), 'reason: ready\nat: 2026-05-06T00:00:00.000Z\n');
  return { sessionDir, handoffDir, diffPath };
}

test('apply ignores .harness state in clean-worktree checks', () => {
  const projectRoot = createGitProject();
  try {
    seedReadySession(projectRoot, 'unit-apply-status');
    const status = _readApplyGitStatus(projectRoot);
    assert.equal(status.dirty, false);
    fs.writeFileSync(path.join(projectRoot, 'DIRTY.md'), 'dirty\n');
    const dirty = _readApplyGitStatus(projectRoot);
    assert.equal(dirty.dirty, true);
    assert.match(dirty.relevantText, /DIRTY\.md/);
  } finally {
    rmrf(projectRoot);
  }
});

test('apply applies a verified SHIP_READY diff and records summary', () => {
  const projectRoot = createGitProject();
  try {
    const { sessionDir, diffPath } = seedReadySession(projectRoot, 'unit-apply');
    const r = applyCycle({ sessionId: 'unit-apply', projectRoot });

    assert.equal(r.applied, true);
    assert.equal(r.alreadyApplied, false);
    assert.equal(r.diffPath, diffPath);
    assert.equal(readLf(path.join(projectRoot, 'README.md')), 'after\n');
    assert.ok(fs.existsSync(path.join(sessionDir, 'APPLIED_DIFF')));
    const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'apply-summary.json'), 'utf8'));
    assert.equal(summary.applied, true);
    assert.equal(summary.target_project_mutated, true);
  } finally {
    rmrf(projectRoot);
  }
});

test('apply is idempotent after APPLIED_DIFF unless forced', () => {
  const projectRoot = createGitProject();
  try {
    seedReadySession(projectRoot, 'unit-apply-idempotent');
    const first = applyCycle({ sessionId: 'unit-apply-idempotent', projectRoot });
    assert.equal(first.applied, true);
    const second = applyCycle({ sessionId: 'unit-apply-idempotent', projectRoot });
    assert.equal(second.applied, false);
    assert.equal(second.alreadyApplied, true);
  } finally {
    rmrf(projectRoot);
  }
});

test('apply blocks when NO_SHIP is newer than SHIP_READY', () => {
  const projectRoot = createGitProject();
  try {
    const { sessionDir } = seedReadySession(projectRoot, 'unit-apply-noship');
    fs.writeFileSync(path.join(sessionDir, 'NO_SHIP'), 'reason: fix findings first\nat: 2026-05-07T00:00:00.000Z\n');
    const r = applyCycle({ sessionId: 'unit-apply-noship', projectRoot });
    assert.equal(r.applied, false);
    assert.equal(r.noShip, true);
    assert.match(r.reason, /fix findings/);
  } finally {
    rmrf(projectRoot);
  }
});

test('apply blocks on open human gate', () => {
  const projectRoot = createGitProject();
  try {
    const { sessionDir } = seedReadySession(projectRoot, 'unit-apply-gate');
    fs.writeFileSync(path.join(sessionDir, 'HUMAN_GATE'), 'reason: needs review\nat: 2026-05-07T00:00:00.000Z\n');
    const r = applyCycle({ sessionId: 'unit-apply-gate', projectRoot });
    assert.equal(r.applied, false);
    assert.equal(r.humanGate, true);
    assert.match(r.reason, /needs review/);
  } finally {
    rmrf(projectRoot);
  }
});

test('apply rejects dirty project files unless allowDirty is set', () => {
  const projectRoot = createGitProject();
  try {
    seedReadySession(projectRoot, 'unit-apply-dirty');
    fs.writeFileSync(path.join(projectRoot, 'DIRTY.md'), 'dirty\n');
    assert.throws(
      () => applyCycle({ sessionId: 'unit-apply-dirty', projectRoot }),
      /clean git worktree/
    );
  } finally {
    rmrf(projectRoot);
  }
});

function readmeDiff() {
  return [
    'diff --git a/README.md b/README.md',
    '--- a/README.md',
    '+++ b/README.md',
    '@@ -1 +1 @@',
    '-before',
    '+after',
    '',
  ].join('\n');
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function git(cwd, args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed\n${r.stderr || r.stdout}`);
}

function readLf(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
