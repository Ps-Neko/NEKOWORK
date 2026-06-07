// gate orchestrator: status / approve / block, including the time-ordering rule
// that GATE_APPROVED must be newer than HUMAN_GATE to clear an open gate.
//
// gateStatus reads marker files directly from the session dir, so the tests seed
// HUMAN_GATE / GATE_APPROVED / GATE_BLOCKED files with explicit `at:` timestamps
// for deterministic ordering. All work happens under os.tmpdir(); nothing is
// written into the repo working tree.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gateStatus, approveGate, blockGate } from '../../scripts/orchestrators/gate.js';
import { rmrf } from '../helpers/tmp.js';

// Build a temp projectRoot containing one session dir. Returns { projectRoot,
// sessionId, sessionDir }.
function makeSession(sessionId = 'sess-001') {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-'));
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  return { projectRoot, sessionId, sessionDir };
}

// Write a marker file with an explicit ISO timestamp so ordering is deterministic.
function writeMarker(sessionDir, name, { reason = 'r', at, actor } = {}) {
  const lines = [`reason: ${reason}`];
  if (actor) lines.push(`actor: ${actor}`);
  if (at) lines.push(`at: ${at}`);
  fs.writeFileSync(path.join(sessionDir, name), lines.join('\n') + '\n');
}

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-01-01T01:00:00.000Z';
const T2 = '2026-01-01T02:00:00.000Z';

test('gateStatus: missing session → status "missing"', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-'));
  try {
    const s = gateStatus({ projectRoot, sessionId: 'does-not-exist' });
    assert.equal(s.status, 'missing');
    assert.equal(s.approved, false);
    assert.equal(s.blocked, false);
    assert.equal(s.humanGate, false);
  } finally {
    rmrf(projectRoot);
  }
});

test('gateStatus: no markers → status "clear"', () => {
  const { projectRoot, sessionId } = makeSession();
  try {
    const s = gateStatus({ projectRoot, sessionId });
    assert.equal(s.status, 'clear');
    assert.equal(s.humanGate, false);
    assert.equal(s.approved, false);
    assert.equal(s.blocked, false);
  } finally {
    rmrf(projectRoot);
  }
});

test('gateStatus: HUMAN_GATE only → status "open", humanGate true', () => {
  const { projectRoot, sessionId, sessionDir } = makeSession();
  try {
    writeMarker(sessionDir, 'HUMAN_GATE', { reason: 'needs review', at: T0 });
    const s = gateStatus({ projectRoot, sessionId });
    assert.equal(s.status, 'open');
    assert.equal(s.humanGate, true);
    assert.equal(s.approved, false);
    assert.equal(s.reason, 'needs review');
  } finally {
    rmrf(projectRoot);
  }
});

test('gateStatus: GATE_APPROVED newer than HUMAN_GATE → status "approved"', () => {
  const { projectRoot, sessionId, sessionDir } = makeSession();
  try {
    writeMarker(sessionDir, 'HUMAN_GATE', { reason: 'needs review', at: T0 });
    writeMarker(sessionDir, 'GATE_APPROVED', { reason: 'looks good', at: T1 });
    const s = gateStatus({ projectRoot, sessionId });
    assert.equal(s.status, 'approved');
    assert.equal(s.approved, true);
    assert.equal(s.humanGate, false, 'an approved gate is no longer "open"');
    assert.equal(s.reason, 'looks good');
  } finally {
    rmrf(projectRoot);
  }
});

test('gateStatus: stale GATE_APPROVED older than HUMAN_GATE → stays "open" (re-gated)', () => {
  // The time-ordering rule: an approval from a PRIOR cycle does not clear a
  // newer HUMAN_GATE. Approval must be newer than the human gate to count.
  const { projectRoot, sessionId, sessionDir } = makeSession();
  try {
    writeMarker(sessionDir, 'GATE_APPROVED', { reason: 'old approval', at: T0 });
    writeMarker(sessionDir, 'HUMAN_GATE', { reason: 're-gated', at: T1 });
    const s = gateStatus({ projectRoot, sessionId });
    assert.equal(s.status, 'open', 'newer HUMAN_GATE re-opens the gate');
    assert.equal(s.approved, false);
    assert.equal(s.humanGate, true);
  } finally {
    rmrf(projectRoot);
  }
});

test('gateStatus: GATE_BLOCKED wins over everything → status "blocked"', () => {
  const { projectRoot, sessionId, sessionDir } = makeSession();
  try {
    writeMarker(sessionDir, 'HUMAN_GATE', { reason: 'needs review', at: T0 });
    writeMarker(sessionDir, 'GATE_APPROVED', { reason: 'approved', at: T1 });
    writeMarker(sessionDir, 'GATE_BLOCKED', { reason: 'security risk', at: T2 });
    const s = gateStatus({ projectRoot, sessionId });
    assert.equal(s.status, 'blocked');
    assert.equal(s.blocked, true);
    assert.equal(s.approved, false);
    assert.equal(s.reason, 'security risk');
  } finally {
    rmrf(projectRoot);
  }
});

test('approveGate: writes GATE_APPROVED and flips an open gate to approved', () => {
  const { projectRoot, sessionId, sessionDir } = makeSession();
  try {
    writeMarker(sessionDir, 'HUMAN_GATE', { reason: 'needs review', at: T0 });
    const result = approveGate({ projectRoot, sessionId, reason: 'reviewed and safe', actor: 'alice' });
    assert.equal(result.status, 'approved');
    assert.equal(result.approved, true);
    assert.ok(fs.existsSync(path.join(sessionDir, 'GATE_APPROVED')), 'GATE_APPROVED marker written');
    assert.equal(result.approvalReason, 'reviewed and safe');
  } finally {
    rmrf(projectRoot);
  }
});

test('approveGate: refuses when there is no open HUMAN_GATE', () => {
  const { projectRoot, sessionId } = makeSession();
  try {
    assert.throws(
      () => approveGate({ projectRoot, sessionId, reason: 'x' }),
      /requires an open HUMAN_GATE/i,
    );
  } finally {
    rmrf(projectRoot);
  }
});

test('approveGate: refuses without a --reason', () => {
  const { projectRoot, sessionId, sessionDir } = makeSession();
  try {
    writeMarker(sessionDir, 'HUMAN_GATE', { reason: 'needs review', at: T0 });
    assert.throws(
      () => approveGate({ projectRoot, sessionId, reason: '   ' }),
      /requires --reason/i,
    );
  } finally {
    rmrf(projectRoot);
  }
});

test('approveGate: cannot override an explicit GATE_BLOCKED', () => {
  const { projectRoot, sessionId, sessionDir } = makeSession();
  try {
    writeMarker(sessionDir, 'HUMAN_GATE', { reason: 'needs review', at: T0 });
    writeMarker(sessionDir, 'GATE_BLOCKED', { reason: 'blocked', at: T1 });
    assert.throws(
      () => approveGate({ projectRoot, sessionId, reason: 'try anyway' }),
      /cannot override an explicit gate block/i,
    );
  } finally {
    rmrf(projectRoot);
  }
});

test('blockGate: writes GATE_BLOCKED and reports status "blocked"', () => {
  const { projectRoot, sessionId, sessionDir } = makeSession();
  try {
    const result = blockGate({ projectRoot, sessionId, reason: 'leaks a secret', actor: 'bob' });
    assert.equal(result.status, 'blocked');
    assert.equal(result.blocked, true);
    assert.ok(fs.existsSync(path.join(sessionDir, 'GATE_BLOCKED')), 'GATE_BLOCKED marker written');
    assert.equal(result.blockReason, 'leaks a secret');
  } finally {
    rmrf(projectRoot);
  }
});

test('blockGate: refuses without a --reason', () => {
  const { projectRoot, sessionId } = makeSession();
  try {
    assert.throws(
      () => blockGate({ projectRoot, sessionId, reason: '' }),
      /requires --reason/i,
    );
  } finally {
    rmrf(projectRoot);
  }
});

test('gateStatus: throws without a session id', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-'));
  try {
    assert.throws(() => gateStatus({ projectRoot }), /requires --session/i);
  } finally {
    rmrf(projectRoot);
  }
});
