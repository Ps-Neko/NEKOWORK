import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { approveGate, blockGate, gateStatus } from '../../scripts/orchestrators/gate.js';

function seedSession(projectRoot, sessionId) {
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  fs.mkdirSync(path.join(sessionDir, 'handoffs'), { recursive: true });
  return sessionDir;
}

test('gate status reports missing and clear sessions', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-status-'));
  try {
    const missing = gateStatus({ sessionId: 'missing', projectRoot });
    assert.equal(missing.status, 'missing');

    seedSession(projectRoot, 'clear');
    const clear = gateStatus({ sessionId: 'clear', projectRoot });
    assert.equal(clear.status, 'clear');
    assert.equal(clear.humanGate, false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('gate approve records approval for an open HUMAN_GATE', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-approve-'));
  try {
    const sessionDir = seedSession(projectRoot, 'open');
    fs.writeFileSync(path.join(sessionDir, 'HUMAN_GATE'), 'reason: codex-review returned block\nat: 2026-05-06T00:00:00.000Z\n');

    const before = gateStatus({ sessionId: 'open', projectRoot });
    assert.equal(before.status, 'open');

    const after = approveGate({
      sessionId: 'open',
      projectRoot,
      reason: 'Reviewed the finding and accepted the release risk.',
    });
    assert.equal(after.status, 'approved');
    assert.equal(after.approved, true);
    assert.equal(after.humanGate, false);
    assert.ok(fs.existsSync(path.join(sessionDir, 'GATE_APPROVED')));
    assert.ok(fs.existsSync(path.join(sessionDir, 'gate-events.jsonl')));
    const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'gate-summary.json'), 'utf8'));
    assert.equal(summary.status, 'approved');
    assert.equal(summary.target_project_mutated, false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('gate approve requires an open gate and a reason', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-approve-reject-'));
  try {
    seedSession(projectRoot, 'clear');
    assert.throws(
      () => approveGate({ sessionId: 'clear', projectRoot, reason: 'ok' }),
      /requires an open HUMAN_GATE/
    );

    const sessionDir = seedSession(projectRoot, 'open');
    fs.writeFileSync(path.join(sessionDir, 'HUMAN_GATE'), 'reason: needs human\nat: 2026-05-06T00:00:00.000Z\n');
    assert.throws(
      () => approveGate({ sessionId: 'open', projectRoot, reason: '' }),
      /requires --reason/
    );
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('gate block creates an explicit block and keeps ship gated', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-block-'));
  try {
    const sessionDir = seedSession(projectRoot, 'blocked');
    const result = blockGate({
      sessionId: 'blocked',
      projectRoot,
      reason: 'Owner rejected release risk.',
    });
    assert.equal(result.status, 'blocked');
    assert.equal(result.blocked, true);
    assert.ok(fs.existsSync(path.join(sessionDir, 'HUMAN_GATE')));
    assert.ok(fs.existsSync(path.join(sessionDir, 'GATE_BLOCKED')));

    assert.throws(
      () => approveGate({ sessionId: 'blocked', projectRoot, reason: 'changed mind' }),
      /cannot override/
    );
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
