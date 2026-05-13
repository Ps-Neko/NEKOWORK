import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildDecision, writeDecision } from '../../scripts/lib/decision.js';

function seedSession() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-decision-'));
  const sessionId = 'unit-decision';
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');
  const diffDir = path.join(sessionDir, 'diffs');
  fs.mkdirSync(handoffDir, { recursive: true });
  fs.mkdirSync(diffDir, { recursive: true });
  const diffPath = path.join(diffDir, '01-implement.diff');
  fs.writeFileSync(diffPath, 'diff --git a/src/auth/login.ts b/src/auth/login.ts\n+const token = process.env.AUTH_TOKEN || "dev-token-123";\n');
  fs.writeFileSync(path.join(handoffDir, '03-implement.json'), JSON.stringify({
    stage: 'implement',
    agent: 'executor',
    decided: 'implemented',
    files: ['src/auth/login.ts'],
    diffPath,
  }, null, 2));
  return { projectRoot, sessionId, sessionDir };
}

test('decision.json consolidates blocked gate state and evidence', () => {
  const { projectRoot, sessionId, sessionDir } = seedSession();
  try {
    fs.writeFileSync(path.join(sessionDir, 'preverify-summary.json'), JSON.stringify({
      verdict: 'block',
      finding_count: 1,
      gate_required: true,
      reason: 'preverify requires human gate (secret)',
      risk_level: 'critical',
      risk_tags: ['secret'],
    }, null, 2));
    fs.writeFileSync(path.join(sessionDir, 'verify-summary.json'), JSON.stringify({
      sessionId,
      verdict: 'approve',
      human_gate: true,
      risk_level: 'high',
      risk_tags: ['security'],
    }, null, 2));
    fs.writeFileSync(path.join(sessionDir, 'HUMAN_GATE'), 'reason: preverify requires human gate (secret)\nat: 2026-05-13T00:00:00.000Z\n');

    const decision = writeDecision(sessionDir, { sessionId, stage: 'test' });
    assert.equal(decision.verdict, 'blocked');
    assert.equal(decision.human_gate, 'required');
    assert.equal(decision.ship_ready, false);
    assert.equal(decision.apply_allowed, false);
    assert.equal(decision.risk.level, 'critical');
    assert.ok(decision.risk.tags.includes('secret'));
    assert.ok(decision.evidence.includes('preverify-summary.json'));
    assert.ok(decision.evidence.includes('decision.json'));
    assert.match(decision.diff_hash, /^[a-f0-9]{64}$/);

    const persisted = JSON.parse(fs.readFileSync(path.join(sessionDir, 'decision.json'), 'utf8'));
    assert.equal(persisted.session_id, sessionId);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('decision permits apply only for clear ship-ready sessions', () => {
  const { projectRoot, sessionId, sessionDir } = seedSession();
  try {
    fs.writeFileSync(path.join(sessionDir, 'verify-summary.json'), JSON.stringify({
      sessionId,
      verdict: 'approve',
      human_gate: false,
    }, null, 2));
    fs.writeFileSync(path.join(sessionDir, 'ship-summary.json'), JSON.stringify({
      sessionId,
      verdict: 'approve',
      ship_ready: true,
      no_ship: false,
      human_gate: false,
    }, null, 2));
    fs.writeFileSync(path.join(sessionDir, 'SHIP_READY'), 'reason: ready\nat: 2026-05-13T00:00:00.000Z\n');

    const decision = buildDecision(sessionDir, { sessionId });
    assert.equal(decision.verdict, 'ship_ready');
    assert.equal(decision.human_gate, 'clear');
    assert.equal(decision.apply_allowed, true);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('decision reads approval actor from gate marker when summary is absent', () => {
  const { projectRoot, sessionId, sessionDir } = seedSession();
  try {
    fs.writeFileSync(path.join(sessionDir, 'verify-summary.json'), JSON.stringify({
      sessionId,
      verdict: 'approve',
      human_gate: false,
    }, null, 2));
    fs.writeFileSync(path.join(sessionDir, 'ship-summary.json'), JSON.stringify({
      sessionId,
      verdict: 'approve',
      ship_ready: true,
      no_ship: false,
      human_gate: false,
    }, null, 2));
    fs.writeFileSync(path.join(sessionDir, 'HUMAN_GATE'), 'reason: needs human\nat: 2026-05-13T00:00:00.000Z\n');
    fs.writeFileSync(path.join(sessionDir, 'GATE_APPROVED'), 'reason: reviewed\nactor: marker-reviewer\nat: 2026-05-13T00:01:00.000Z\n');
    fs.writeFileSync(path.join(sessionDir, 'SHIP_READY'), 'reason: ready\nat: 2026-05-13T00:02:00.000Z\n');

    const decision = buildDecision(sessionDir, { sessionId });
    assert.equal(decision.human_gate, 'approved');
    assert.equal(decision.approval.actor, 'marker-reviewer');
    assert.equal(decision.apply_allowed, true);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
