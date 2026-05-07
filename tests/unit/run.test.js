import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { runCycle } from '../../scripts/orchestrators/run.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('run executes work, verify, and ship without apply by default', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-run-default-'));
  const calls = [];
  try {
    const r = await runCycle({
      task: 'run default',
      sessionId: 'unit-run-default',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher: dispatcher(calls, { reviewVerdict: 'approve_with_fixes' }),
    });

    assert.deepEqual(calls.map(c => c.stage), ['implement', 'codex-review', 'ship']);
    assert.equal(r.stoppedAt, 'ship');
    assert.equal(r.noShip, true);
    assert.equal(r.applied, false);
    assert.equal(r.applyRequested, false);
    assert.ok(fs.existsSync(path.join(r.sessionDir, 'run-summary.json')));
    const summary = JSON.parse(fs.readFileSync(path.join(r.sessionDir, 'run-summary.json'), 'utf8'));
    assert.equal(summary.acceptance_required, true);
    assert.equal(summary.acceptance_count, 3);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('run secure mode includes Codex challenge', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-run-secure-'));
  const calls = [];
  try {
    const r = await runCycle({
      task: 'run secure auth change',
      sessionId: 'unit-run-secure',
      harnessRoot: ROOT,
      projectRoot,
      secure: true,
      dispatcher: dispatcher(calls, { reviewVerdict: 'approve', challengeVerdict: 'approve' }),
    });

    assert.deepEqual(calls.map(c => c.stage), ['implement', 'codex-review', 'codex-challenge', 'ship']);
    assert.equal(r.shipReady, true);
    assert.equal(r.noShip, false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('run stops before ship when verify creates a human gate', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-run-gate-'));
  const calls = [];
  try {
    const r = await runCycle({
      task: 'run gated',
      sessionId: 'unit-run-gate',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher: dispatcher(calls, { reviewVerdict: 'block', critical: true }),
    });

    assert.deepEqual(calls.map(c => c.stage), ['implement', 'codex-review']);
    assert.equal(r.stoppedAt, 'verify');
    assert.equal(r.humanGate, true);
    assert.equal(r.ship, null);
    assert.ok(fs.existsSync(path.join(r.sessionDir, 'HUMAN_GATE')));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('run skips requested apply when ship is not ready', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-run-apply-skip-'));
  const calls = [];
  try {
    const r = await runCycle({
      task: 'run apply skip',
      sessionId: 'unit-run-apply-skip',
      harnessRoot: ROOT,
      projectRoot,
      apply: true,
      dispatcher: dispatcher(calls, { reviewVerdict: 'approve_with_fixes' }),
    });

    assert.equal(r.applyRequested, true);
    assert.equal(r.applied, false);
    assert.equal(r.applySkippedReason, 'verification verdict is approve_with_fixes');
    assert.equal(r.noShip, true);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('run applies when requested and ship is ready', async () => {
  const projectRoot = createGitProject();
  const calls = [];
  try {
    const r = await runCycle({
      task: 'run apply ready',
      sessionId: 'unit-run-apply',
      harnessRoot: ROOT,
      projectRoot,
      apply: true,
      dispatcher: dispatcher(calls, { reviewVerdict: 'approve', writeDiff: true }),
    });

    assert.equal(r.shipReady, true);
    assert.equal(r.applied, true);
    assert.equal(r.stoppedAt, 'apply');
    assert.equal(readLf(path.join(projectRoot, 'README.md')), 'after\n');
    assert.ok(fs.existsSync(path.join(r.sessionDir, 'APPLIED_DIFF')));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

function dispatcher(calls, options = {}) {
  return async (args) => {
    calls.push(args);
    const base = {
      stage: args.stage,
      agent: args.agent,
      round: args.context?.round || 1,
      session_id: args.sessionId,
      timestamp: new Date().toISOString(),
      duration_ms: 1,
      provider: 'mock',
      model: args.agent === 'codex-reviewer' || args.agent === 'codex-challenger' ? 'gpt-5-codex' : 'sonnet',
      decided: `${args.stage} done`,
      files: [],
    };

    if (args.stage === 'implement') {
      const h = {
        ...base,
        files: ['README.md'],
        remaining: 'verify',
      };
      if (options.writeDiff) {
        const diffDir = path.join(args.sessionDir, 'diffs');
        fs.mkdirSync(diffDir, { recursive: true });
        const diffPath = path.join(diffDir, '01-implement.diff');
        fs.writeFileSync(diffPath, readmeDiff());
        h.diffPath = diffPath;
      }
      return h;
    }

    if (args.stage === 'codex-review') {
      return {
        ...base,
        files: ['README.md'],
        verdict: options.reviewVerdict || 'approve',
        issues: options.critical
          ? [{ severity: 'critical', category: 'security', file: 'README.md', summary: 'critical finding' }]
          : options.reviewVerdict === 'approve_with_fixes'
            ? [{ severity: 'medium', category: 'correctness', file: 'README.md', summary: 'fix me' }]
            : [],
      };
    }

    if (args.stage === 'codex-challenge') {
      return {
        ...base,
        verdict: options.challengeVerdict || 'approve',
        issues: [],
      };
    }

    if (args.stage === 'ship') {
      return {
        ...base,
        model: 'haiku',
        files: ['docs/CHANGELOG.md'],
      };
    }

    throw new Error(`unexpected stage ${args.stage}`);
  };
}

function createGitProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-run-project-'));
  git(root, ['init']);
  git(root, ['config', 'user.email', 'unit@example.invalid']);
  git(root, ['config', 'user.name', 'Unit Test']);
  fs.writeFileSync(path.join(root, 'README.md'), 'before\n');
  git(root, ['add', 'README.md']);
  git(root, ['commit', '-m', 'init']);
  return root;
}

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

function git(cwd, args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed\n${r.stderr || r.stdout}`);
}

function readLf(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
