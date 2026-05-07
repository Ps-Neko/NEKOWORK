import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { shipCycle, _finalVerificationVerdict } from '../../scripts/orchestrators/ship.js';
import { approveGate } from '../../scripts/orchestrators/gate.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function writeHandoff(handoffDir, name, handoff) {
  fs.writeFileSync(path.join(handoffDir, name), JSON.stringify(handoff, null, 2));
}

function seedVerifiedSession(projectRoot, sessionId, codexReview = {}) {
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');
  fs.mkdirSync(handoffDir, { recursive: true });
  writeHandoff(handoffDir, '03-implement.json', {
    stage: 'implement',
    agent: 'executor',
    round: 1,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: 1,
    provider: 'mock',
    model: 'sonnet',
    decided: 'implemented',
    files: ['src/example.ts'],
    ...codexReview.implement,
  });
  writeHandoff(handoffDir, '05-codex-review.json', {
    stage: 'codex-review',
    agent: 'codex-reviewer',
    round: 1,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: 1,
    provider: 'mock',
    model: 'gpt-5-codex',
    decided: 'verified',
    files: ['src/example.ts'],
    verdict: 'approve',
    issues: [],
    ...codexReview.review,
  });
  if (codexReview.challenge) {
    writeHandoff(handoffDir, '06-codex-challenge.json', {
      stage: 'codex-challenge',
      agent: 'codex-challenger',
      round: 1,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      duration_ms: 1,
      provider: 'mock',
      model: 'gpt-5-codex',
      decided: 'challenged',
      files: [],
      verdict: 'approve',
      issues: [],
      ...codexReview.challenge,
    });
  }
  return { sessionDir, handoffDir };
}

test('finalVerificationVerdict keeps fix findings as no-ship input', () => {
  assert.equal(_finalVerificationVerdict([{ verdict: 'approve' }]), 'approve');
  assert.equal(_finalVerificationVerdict([{ verdict: 'approve' }, { verdict: 'approve_with_fixes' }]), 'approve_with_fixes');
  assert.equal(_finalVerificationVerdict([{ verdict: 'block' }, { verdict: 'approve' }]), 'block');
});

test('ship writes readiness handoff after Codex approval', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ship-ready-'));
  const calls = [];
  const dispatcher = async (args) => {
    calls.push(args);
    assert.equal(args.context.shipOnly, true);
    assert.equal(args.context.shipReady, true);
    assert.equal(args.context.noProjectMutation, true);
    assert.equal(args.sandboxOverride, 'read-only');
    return {
      stage: args.stage,
      agent: args.agent,
      round: args.context.round,
      session_id: args.sessionId,
      timestamp: new Date().toISOString(),
      duration_ms: 1,
      provider: 'mock',
      model: 'haiku',
      decided: 'PR body prepared',
      files: ['docs/CHANGELOG.md'],
    };
  };

  try {
    const { sessionDir, handoffDir } = seedVerifiedSession(projectRoot, 'unit-ship-ready');
    const r = await shipCycle({
      task: 'ship example',
      sessionId: 'unit-ship-ready',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher,
    });

    assert.equal(r.shipReady, true);
    assert.equal(r.noShip, false);
    assert.equal(r.humanGate, false);
    assert.equal(calls.length, 1);
    assert.ok(fs.existsSync(path.join(handoffDir, '07-ship.json')));
    assert.ok(fs.existsSync(path.join(sessionDir, 'SHIP_READY')));
    const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'ship-summary.json'), 'utf8'));
    assert.equal(summary.ship_ready, true);
    assert.equal(summary.target_project_mutated, false);
    assert.equal(summary.acceptance_required, true);
    assert.equal(summary.acceptance_count, 3);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('ship creates a no-ship handoff when Codex found fixable issues', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ship-hold-'));
  const dispatcher = async (args) => ({
    stage: args.stage,
    agent: args.agent,
    round: args.context.round,
    session_id: args.sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: 1,
    provider: 'mock',
    model: 'haiku',
    decided: 'no-ship summary prepared',
    files: [],
  });

  try {
    const { sessionDir, handoffDir } = seedVerifiedSession(projectRoot, 'unit-ship-hold', {
      review: {
        verdict: 'approve_with_fixes',
        issues: [{ severity: 'medium', category: 'correctness', file: 'src/example.ts', summary: 'needs timeout' }],
      },
    });
    const r = await shipCycle({
      task: 'ship with findings',
      sessionId: 'unit-ship-hold',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher,
    });

    assert.equal(r.shipReady, false);
    assert.equal(r.noShip, true);
    assert.equal(r.humanGate, false);
    assert.ok(fs.existsSync(path.join(handoffDir, '07-ship.json')));
    assert.ok(fs.existsSync(path.join(sessionDir, 'NO_SHIP')));
    const handoff = JSON.parse(fs.readFileSync(path.join(handoffDir, '07-ship.json'), 'utf8'));
    assert.equal(handoff.verdict, 'approve_with_fixes');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('ship is blocked by an existing human gate', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ship-gated-'));
  let dispatched = false;
  try {
    const { sessionDir, handoffDir } = seedVerifiedSession(projectRoot, 'unit-ship-gated');
    fs.writeFileSync(path.join(sessionDir, 'HUMAN_GATE'), 'reason: manual approval required\n');

    const r = await shipCycle({
      task: 'ship gated',
      sessionId: 'unit-ship-gated',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher: async () => { dispatched = true; },
    });

    assert.equal(dispatched, false);
    assert.equal(r.humanGate, true);
    assert.equal(r.shipReady, false);
    assert.equal(fs.existsSync(path.join(handoffDir, '07-ship.json')), false);
    const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'ship-summary.json'), 'utf8'));
    assert.equal(summary.human_gate, true);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('ship can continue after explicit gate approval', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ship-gate-approved-'));
  let dispatched = false;
  try {
    const { sessionDir, handoffDir } = seedVerifiedSession(projectRoot, 'unit-ship-gate-approved', {
      review: {
        verdict: 'block',
        issues: [{ severity: 'critical', category: 'security', file: 'src/example.ts', summary: 'manual review needed' }],
      },
    });
    fs.writeFileSync(path.join(sessionDir, 'HUMAN_GATE'), 'reason: codex-review returned block\nat: 2026-05-06T00:00:00.000Z\n');
    approveGate({
      sessionId: 'unit-ship-gate-approved',
      projectRoot,
      reason: 'Owner accepted this specific release risk.',
    });

    const r = await shipCycle({
      task: 'ship approved gate',
      sessionId: 'unit-ship-gate-approved',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher: async (args) => {
        dispatched = true;
        assert.equal(args.context.gateApproved, true);
        assert.equal(args.context.verificationVerdict, 'block');
        assert.equal(args.context.effectiveVerdict, 'approve');
        return {
          stage: args.stage,
          agent: args.agent,
          round: args.context.round,
          session_id: args.sessionId,
          timestamp: new Date().toISOString(),
          duration_ms: 1,
          provider: 'mock',
          model: 'haiku',
          decided: 'ship handoff after approval',
          files: [],
        };
      },
    });

    assert.equal(dispatched, true);
    assert.equal(r.shipReady, true);
    assert.equal(r.gateApproved, true);
    assert.ok(fs.existsSync(path.join(handoffDir, '07-ship.json')));
    assert.ok(fs.existsSync(path.join(sessionDir, 'SHIP_READY')));
    const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'ship-summary.json'), 'utf8'));
    assert.equal(summary.gate_approved, true);
    assert.equal(summary.verification_verdict, 'block');
    assert.equal(summary.verdict, 'approve');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('ship requires Codex verification first', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ship-missing-'));
  try {
    const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-ship-missing');
    const handoffDir = path.join(sessionDir, 'handoffs');
    fs.mkdirSync(handoffDir, { recursive: true });
    writeHandoff(handoffDir, '03-implement.json', {
      stage: 'implement',
      agent: 'executor',
      decided: 'implemented',
      files: [],
    });

    await assert.rejects(
      () => shipCycle({
        task: 'ship missing verify',
        sessionId: 'unit-ship-missing',
        harnessRoot: ROOT,
        projectRoot,
        dispatcher: async () => { throw new Error('should not dispatch'); },
      }),
      /requires Codex verification/
    );
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
