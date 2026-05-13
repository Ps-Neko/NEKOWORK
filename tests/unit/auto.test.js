import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { autoCycle, autoPlan, normalizeAutoLevel } from '../../scripts/orchestrators/auto.js';
import { normalizeParallelCandidateCount } from '../../scripts/lib/parallel-candidates.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('auto dry-run previews bounded autonomy without creating a session', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-auto-dry-run-'));
  try {
    const preview = autoPlan({
      task: 'add OAuth login with JWT refresh token support',
      sessionId: 'unit-auto-dry-run',
      harnessRoot: ROOT,
      projectRoot,
      dryRun: true,
    });

    assert.equal(preview.dryRun, true);
    assert.equal(preview.level, 'normal');
    assert.equal(preview.mode, 'safe');
    assert.equal(preview.applyRequested, false);
    assert.equal(preview.policy.stopBeforeApply, true);
    assert.equal(preview.stages.at(-1).stage, 'apply-boundary');
    assert.ok(preview.safetyInvariants.some(line => /never automatic/.test(line)));
    assert.ok(!fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-auto-dry-run')));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('auto dry-run previews isolated parallel candidates without creating a session', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-auto-candidates-dry-run-'));
  try {
    const preview = autoPlan({
      task: 'refactor auth parser safely',
      parallelCandidates: 3,
      sessionId: 'unit-auto-candidates-dry-run',
      harnessRoot: ROOT,
      projectRoot,
      dryRun: true,
    });

    assert.equal(preview.parallelCandidates.enabled, true);
    assert.equal(preview.parallelCandidates.count, 3);
    assert.equal(preview.parallelCandidates.arbiter.status, 'not_selected');
    assert.ok(preview.stages.some(stage => stage.stage === 'parallel-candidates' && stage.runs === true));
    assert.ok(!fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-auto-candidates-dry-run')));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('auto cautious runs one safe build and never applies', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-auto-cautious-'));
  const calls = [];
  try {
    const result = await autoCycle({
      task: 'fix README typo',
      level: 'cautious',
      sessionId: 'unit-auto-cautious',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher: dispatcher(calls, { reviewVerdicts: ['approve'] }),
    });

    assert.equal(result.level, 'cautious');
    assert.equal(result.rounds.length, 1);
    assert.equal(result.shipReady, true);
    assert.equal(result.applied, false);
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'auto-summary.json')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'REPORT.md')));
    const summary = JSON.parse(fs.readFileSync(path.join(result.sessionDir, 'auto-summary.json'), 'utf8'));
    assert.equal(summary.applied, false);
    assert.equal(summary.policy.repair, false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('auto captures parallel candidate evidence before canonical build', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-auto-candidates-'));
  const calls = [];
  try {
    const result = await autoCycle({
      task: 'refactor parser safely',
      level: 'cautious',
      parallelCandidates: 2,
      sessionId: 'unit-auto-candidates',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher: dispatcher(calls, { reviewVerdicts: ['approve'] }),
    });

    assert.equal(result.parallelCandidates.count, 2);
    assert.equal(result.parallelCandidates.arbiter.status, 'not_selected');
    assert.equal(result.parallelCandidates.candidates.every(candidate => candidate.evidence_only), true);
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'parallel-candidates.json')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'parallel-candidates', 'candidate-01.json')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'parallel-candidates', 'candidate-02.md')));
    const summary = JSON.parse(fs.readFileSync(path.join(result.sessionDir, 'auto-summary.json'), 'utf8'));
    assert.equal(summary.parallel_candidates.count, 2);
    assert.equal(summary.parallel_candidates.target_project_mutated, false);
    const report = fs.readFileSync(path.join(result.sessionDir, 'REPORT.md'), 'utf8');
    assert.match(report, /Parallel Candidates/);
    assert.match(report, /candidate-01/);
    assert.equal(calls.filter(call => call.context?.parallelCandidate).length, 2);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('auto normal repairs fixable no-ship findings within budget', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-auto-repair-'));
  const calls = [];
  try {
    const result = await autoCycle({
      task: 'fix parser regression and update coverage',
      mode: 'fast',
      level: 'normal',
      sessionId: 'unit-auto-repair',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher: dispatcher(calls, { reviewVerdicts: ['approve_with_fixes', 'approve'] }),
    });

    assert.equal(result.rounds.length, 2);
    assert.equal(result.rounds[0].no_ship, true);
    assert.equal(result.rounds[1].ship_ready, true);
    assert.equal(result.shipReady, true);
    assert.equal(result.noShip, false);
    assert.equal(result.applied, false);
    assert.equal(calls.filter(call => call.stage === 'implement').length, 2);
    const report = fs.readFileSync(path.join(result.sessionDir, 'REPORT.md'), 'utf8');
    assert.match(report, /Bounded Autonomy/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('auto stops repair loop when Human Gate is required', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-auto-human-gate-'));
  const calls = [];
  try {
    const result = await autoCycle({
      task: 'implement payment webhook and deploy workflow',
      level: 'aggressive',
      sessionId: 'unit-auto-human-gate',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher: dispatcher(calls, { reviewVerdicts: ['approve'], challengeVerdicts: ['approve'] }),
    });

    assert.equal(result.rounds.length, 1);
    assert.equal(result.humanGate, true);
    assert.equal(result.applied, false);
    assert.match(result.stopReason, /human gate/);
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'HUMAN_GATE')));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('auto level normalization rejects unknown levels', () => {
  assert.equal(normalizeAutoLevel(null), 'normal');
  assert.equal(normalizeAutoLevel('aggressive'), 'aggressive');
  assert.throws(() => normalizeAutoLevel('unsafe'), /unknown autonomy level/);
});

test('parallel candidate count normalization keeps the alpha preview bounded', () => {
  assert.equal(normalizeParallelCandidateCount(null), 0);
  assert.equal(normalizeParallelCandidateCount('2'), 2);
  assert.equal(normalizeParallelCandidateCount(4), 4);
  assert.throws(() => normalizeParallelCandidateCount(1), /between 2 and 4/);
  assert.throws(() => normalizeParallelCandidateCount(5), /between 2 and 4/);
});

function dispatcher(calls, options = {}) {
  let reviewIndex = 0;
  let challengeIndex = 0;
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

    if (args.executionMode === 'read-only') {
      return {
        ...base,
        rejected: 'project mutation',
        risks: 'read-only thinking only',
        remaining: 'single executor implementation',
        verdict: 'approve',
      };
    }

    if (args.stage === 'implement') {
      return { ...base, files: ['README.md'], remaining: 'verify' };
    }

    if (args.stage === 'codex-review') {
      const verdict = options.reviewVerdicts?.[reviewIndex++] || 'approve';
      return {
        ...base,
        files: ['README.md'],
        verdict,
        issues: verdict === 'approve_with_fixes'
          ? [{ severity: 'medium', category: 'correctness', summary: 'fixable regression evidence missing' }]
          : [],
      };
    }

    if (args.stage === 'codex-challenge') {
      const verdict = options.challengeVerdicts?.[challengeIndex++] || 'approve';
      return { ...base, verdict, issues: [] };
    }

    if (args.stage === 'ship') {
      return { ...base, files: ['docs/CHANGELOG.md'] };
    }

    throw new Error(`unexpected stage ${args.stage}`);
  };
}
