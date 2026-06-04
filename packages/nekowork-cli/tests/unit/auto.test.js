import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { autoCycle, autoPlan, normalizeAutoLevel } from '../../scripts/orchestrators/auto.js';
import { normalizeParallelCandidateCount } from '../../scripts/lib/parallel-candidates.js';
import { rmrf } from '../helpers/tmp.js';

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
    rmrf(projectRoot);
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
    rmrf(projectRoot);
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
    rmrf(projectRoot);
  }
});

test('auto promotes a clean parallel candidate into the canonical ship path', async () => {
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
    assert.equal(result.parallelCandidates.arbiter.status, 'selected');
    assert.equal(result.parallelCandidates.arbiter.selected_candidate, 'candidate-01');
    assert.equal(result.parallelCandidates.canonical.status, 'promoted_for_ship');
    assert.equal(result.parallelCandidates.canonical.ship_candidate, true);
    assert.equal(result.parallelCandidates.canonical.final_verification.verdict, 'approve');
    assert.equal(result.parallelCandidates.candidates.every(candidate => candidate.evidence_only), true);
    assert.equal(result.parallelCandidates.candidates[0].selected, true);
    assert.equal(result.shipReady, true);
    assert.equal(result.noShip, false);
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'parallel-candidates.json')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'candidate-verification.json')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'candidate-arbiter.json')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'canonical-candidate.json')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'canonical-verify-summary.json')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'handoffs', '03-implement.json')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'handoffs', '05-codex-review.json')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'SHIP_READY')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'parallel-candidates', 'candidate-01.json')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'parallel-candidates', 'candidate-02.md')));
    const summary = JSON.parse(fs.readFileSync(path.join(result.sessionDir, 'auto-summary.json'), 'utf8'));
    assert.equal(summary.parallel_candidates.count, 2);
    assert.equal(summary.parallel_candidates.arbiter.status, 'selected');
    assert.equal(summary.parallel_candidates.canonical.status, 'promoted_for_ship');
    assert.equal(summary.parallel_candidates.target_project_mutated, false);
    const report = fs.readFileSync(path.join(result.sessionDir, 'REPORT.md'), 'utf8');
    assert.match(report, /Parallel Candidates/);
    assert.match(report, /candidate-01/);
    assert.match(report, /Selected candidate: candidate-01/);
    assert.match(report, /Canonical artifact: promoted_for_ship/);
    assert.match(report, /Final verification: approve/);
    assert.equal(calls.filter(call => call.context?.parallelCandidate).length, 2);
    assert.equal(calls.filter(call => call.context?.parallelCandidateVerification).length, 2);
    assert.equal(calls.filter(call => call.context?.canonicalCandidateFinalVerification).length, 1);
    assert.equal(calls.filter(call => call.stage === 'ship').length, 1);
  } finally {
    rmrf(projectRoot);
  }
});

test('auto rejects dirty parallel candidates from canonical promotion evidence', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-auto-candidates-reject-'));
  try {
    const result = await autoCycle({
      task: 'refactor parser safely',
      level: 'cautious',
      parallelCandidates: 2,
      sessionId: 'unit-auto-candidates-reject',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher: dispatcher([], { reviewVerdicts: ['approve_with_fixes', 'block', 'approve'] }),
    });

    assert.equal(result.parallelCandidates.status, 'no_clean_candidate');
    assert.equal(result.parallelCandidates.arbiter.status, 'rejected');
    assert.equal(result.parallelCandidates.arbiter.selected_candidate, null);
    assert.equal(result.parallelCandidates.canonical.status, 'not_promoted');
    assert.equal(result.shipReady, false);
    assert.equal(result.noShip, true);
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'NO_SHIP')));
    const report = fs.readFileSync(path.join(result.sessionDir, 'REPORT.md'), 'utf8');
    assert.match(report, /Selected candidate: none/);
    assert.match(report, /Canonical artifact: not_promoted/);
  } finally {
    rmrf(projectRoot);
  }
});

test('auto blocks selected parallel candidate when final verification fails', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-auto-candidates-final-fail-'));
  try {
    const result = await autoCycle({
      task: 'refactor parser safely',
      level: 'cautious',
      parallelCandidates: 2,
      sessionId: 'unit-auto-candidates-final-fail',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher: dispatcher([], { reviewVerdicts: ['approve', 'approve', 'approve_with_fixes'] }),
    });

    assert.equal(result.parallelCandidates.arbiter.status, 'selected');
    assert.equal(result.parallelCandidates.canonical.status, 'final_verification_failed');
    assert.equal(result.parallelCandidates.canonical.ship_candidate, false);
    assert.equal(result.parallelCandidates.canonical.final_verification.verdict, 'approve_with_fixes');
    assert.equal(result.shipReady, false);
    assert.equal(result.noShip, true);
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'canonical-verify-summary.json')));
    assert.ok(!fs.existsSync(path.join(result.sessionDir, 'SHIP_READY')));
    assert.ok(fs.existsSync(path.join(result.sessionDir, 'NO_SHIP')));
    const report = fs.readFileSync(path.join(result.sessionDir, 'REPORT.md'), 'utf8');
    assert.match(report, /Canonical artifact: final_verification_failed/);
    assert.match(report, /Final verification: approve_with_fixes/);
  } finally {
    rmrf(projectRoot);
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
    rmrf(projectRoot);
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
    rmrf(projectRoot);
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
