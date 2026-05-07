import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { verifyCycle, _humanGateReason, _latestStageHandoff, _readDiffForHandoff } from '../../scripts/orchestrators/verify.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function seedImplementSession(projectRoot, sessionId, extra = {}) {
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');
  const diffDir = path.join(sessionDir, 'diffs');
  fs.mkdirSync(handoffDir, { recursive: true });
  fs.mkdirSync(diffDir, { recursive: true });
  const diffPath = path.join(diffDir, '01-implement.diff');
  fs.writeFileSync(diffPath, 'diff --git a/src/example.ts b/src/example.ts\n');
  fs.writeFileSync(path.join(handoffDir, '03-implement.json'), JSON.stringify({
    stage: 'implement',
    agent: 'executor',
    round: 1,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: 1,
    provider: 'mock',
    model: 'sonnet',
    decided: 'implemented',
    rejected: '',
    risks: '',
    files: ['src/example.ts'],
    remaining: 'verify',
    diffPath,
    ...extra,
  }, null, 2));
  return { sessionDir, handoffDir, diffPath };
}

test('latestStageHandoff and readDiffForHandoff find work output', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-verify-helpers-'));
  try {
    const { sessionDir, diffPath } = seedImplementSession(projectRoot, 'unit-verify-helpers');
    const handoffs = [
      { stage: 'implement', round: 1, diffPath },
      { stage: 'implement', round: 2 },
      { stage: 'plan', round: 1 },
    ];
    assert.equal(_latestStageHandoff(handoffs, 'implement').round, 2);
    assert.match(_readDiffForHandoff(sessionDir, handoffs[0]), /diff --git/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('verify runs Codex review only after work handoff', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-verify-project-root-'));
  const calls = [];
  const dispatcher = async (args) => {
    calls.push(args);
    assert.equal(args.context.verifyOnly, true);
    assert.match(args.context.diff, /diff --git/);
    return {
      stage: args.stage,
      agent: args.agent,
      round: args.context.round,
      session_id: args.sessionId,
      timestamp: new Date().toISOString(),
      duration_ms: 1,
      provider: 'mock',
      model: 'gpt-5-codex',
      decided: `${args.stage} ok`,
      rejected: '',
      risks: '',
      files: ['src/example.ts'],
      remaining: '',
      verdict: 'approve_with_fixes',
      issues: [{ severity: 'medium', category: 'correctness', file: 'src/example.ts', summary: 'needs timeout' }],
    };
  };

  try {
    const { sessionDir, handoffDir } = seedImplementSession(projectRoot, 'unit-verify');
    const r = await verifyCycle({
      task: 'verify example',
      sessionId: 'unit-verify',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher,
    });

    assert.equal(r.verdict, 'approve_with_fixes');
    assert.equal(r.humanGate, false);
    assert.equal(r.secureActive, false);
    assert.equal(r.codexChallenge, null);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].agent, 'codex-reviewer');
    assert.equal(calls[0].stage, 'codex-review');
    assert.ok(fs.existsSync(path.join(handoffDir, '05-codex-review.json')));
    const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'verify-summary.json'), 'utf8'));
    assert.equal(summary.codex_review_run, true);
    assert.equal(summary.codex_challenge_run, false);
    assert.equal(summary.ship_run, false);
    assert.equal(summary.target_project_mutated, false);
    assert.equal(summary.acceptance_required, true);
    assert.equal(summary.acceptance_count, 3);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('verify applies risk policy human gate for financial work even when Codex approves', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-verify-risk-policy-'));
  const dispatcher = async (args) => ({
    stage: args.stage,
    agent: args.agent,
    round: args.context.round,
    session_id: args.sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: 1,
    provider: 'mock',
    model: 'gpt-5-codex',
    decided: `${args.stage} ok`,
    files: ['src/dashboard.ts'],
    verdict: 'approve',
    issues: [],
  });

  try {
    const { sessionDir } = seedImplementSession(projectRoot, 'unit-verify-risk-policy', {
      files: ['src/dashboard.ts'],
    });
    const r = await verifyCycle({
      task: 'stock trading dashboard mockup with mock-only orders',
      sessionId: 'unit-verify-risk-policy',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher,
    });

    assert.equal(r.secureActive, true);
    assert.equal(r.humanGate, true);
    assert.match(r.reason, /risk policy/);
    assert.ok(fs.existsSync(path.join(sessionDir, 'HUMAN_GATE')));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('verify secure mode also runs Codex challenge', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-verify-secure-'));
  const calls = [];
  const dispatcher = async (args) => {
    calls.push(args);
    return {
      stage: args.stage,
      agent: args.agent,
      round: args.context.round,
      session_id: args.sessionId,
      timestamp: new Date().toISOString(),
      duration_ms: 1,
      provider: 'mock',
      model: 'gpt-5-codex',
      decided: `${args.stage} ok`,
      files: [],
      verdict: 'approve',
    };
  };

  try {
    seedImplementSession(projectRoot, 'unit-verify-secure');
    const r = await verifyCycle({
      task: 'verify auth token change',
      sessionId: 'unit-verify-secure',
      harnessRoot: ROOT,
      projectRoot,
      secure: true,
      dispatcher,
    });

    assert.equal(r.secureActive, true);
    assert.ok(r.codexChallenge);
    assert.deepEqual(calls.map(c => c.stage), ['codex-review', 'codex-challenge']);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('verify writes HUMAN_GATE for critical or block findings', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-verify-gate-'));
  const dispatcher = async (args) => ({
    stage: args.stage,
    agent: args.agent,
    round: args.context.round,
    session_id: args.sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: 1,
    provider: 'mock',
    model: 'gpt-5-codex',
    decided: 'blocked',
    files: ['src/example.ts'],
    verdict: 'block',
    issues: [{ severity: 'critical', category: 'security', file: 'src/example.ts', summary: 'secret leak' }],
  });

  try {
    const { sessionDir } = seedImplementSession(projectRoot, 'unit-verify-gate');
    const r = await verifyCycle({
      task: 'verify secret handling',
      sessionId: 'unit-verify-gate',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher,
    });

    assert.equal(r.humanGate, true);
    assert.match(r.reason, /block|critical/);
    assert.ok(fs.existsSync(path.join(sessionDir, 'HUMAN_GATE')));
    assert.match(_humanGateReason([r.codexReview]), /block|critical/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('verify fails clearly without prior implement handoff', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-verify-missing-'));
  const missingSessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-verify-missing');
  try {
    await assert.rejects(
      () => verifyCycle({
        task: 'verify missing work',
        sessionId: 'unit-verify-missing',
        harnessRoot: ROOT,
        projectRoot,
        dispatcher: async () => { throw new Error('should not dispatch'); },
      }),
      /requires an implement handoff/
    );
    assert.equal(fs.existsSync(missingSessionDir), false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
