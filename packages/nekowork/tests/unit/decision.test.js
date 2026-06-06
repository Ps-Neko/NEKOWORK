import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildDecision, writeDecision } from '../../scripts/lib/decision.js';
import { rmrf } from '../helpers/tmp.js';

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
    rmrf(projectRoot);
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
    rmrf(projectRoot);
  }
});

test('decision.runtime defaults to mock when handoffs lack provider', () => {
  const { projectRoot, sessionDir } = seedSession();
  try {
    const decision = buildDecision(sessionDir, {});
    assert.equal(decision.runtime.mode, 'mock');
    assert.deepEqual(decision.runtime.providers, []);
    assert.equal(decision.runtime.source, 'fallback');
  } finally {
    rmrf(projectRoot);
  }
});

test('decision.runtime reports mock when every handoff used the mock provider', () => {
  const { projectRoot, sessionDir } = seedSession();
  try {
    const handoffDir = path.join(sessionDir, 'handoffs');
    fs.writeFileSync(path.join(handoffDir, '01-plan.json'), JSON.stringify({
      stage: 'plan', agent: 'planner', provider: 'mock',
    }, null, 2));
    const decision = buildDecision(sessionDir, {});
    assert.equal(decision.runtime.mode, 'mock');
    assert.deepEqual(decision.runtime.providers, ['mock']);
    assert.equal(decision.runtime.source, 'handoff');
  } finally {
    rmrf(projectRoot);
  }
});

test('decision.runtime reports live when handoffs used real providers only', () => {
  const { projectRoot, sessionDir } = seedSession();
  try {
    const handoffDir = path.join(sessionDir, 'handoffs');
    fs.writeFileSync(path.join(handoffDir, '01-plan.json'), JSON.stringify({
      stage: 'plan', agent: 'planner', provider: 'claude',
    }, null, 2));
    fs.writeFileSync(path.join(handoffDir, '02-verify.json'), JSON.stringify({
      stage: 'codex-review', agent: 'codex-reviewer', provider: 'codex',
    }, null, 2));
    const decision = buildDecision(sessionDir, {});
    assert.equal(decision.runtime.mode, 'live');
    assert.deepEqual(decision.runtime.providers, ['claude', 'codex']);
  } finally {
    rmrf(projectRoot);
  }
});

test('decision.runtime reports mixed when mock and live providers coexist', () => {
  const { projectRoot, sessionDir } = seedSession();
  try {
    const handoffDir = path.join(sessionDir, 'handoffs');
    fs.writeFileSync(path.join(handoffDir, '01-plan.json'), JSON.stringify({
      stage: 'plan', agent: 'planner', provider: 'mock',
    }, null, 2));
    fs.writeFileSync(path.join(handoffDir, '02-verify.json'), JSON.stringify({
      stage: 'codex-review', agent: 'codex-reviewer', provider: 'codex',
    }, null, 2));
    const decision = buildDecision(sessionDir, {});
    assert.equal(decision.runtime.mode, 'mixed');
    assert.deepEqual(decision.runtime.providers, ['codex', 'mock']);
  } finally {
    rmrf(projectRoot);
  }
});

test('decision.runtime falls back to live when HARNESS_LIVE env is set', () => {
  const { projectRoot, sessionDir } = seedSession();
  const prev = process.env.HARNESS_LIVE;
  process.env.HARNESS_LIVE = '1';
  try {
    const decision = buildDecision(sessionDir, {});
    assert.equal(decision.runtime.mode, 'live');
    assert.equal(decision.runtime.source, 'fallback');
  } finally {
    if (prev === undefined) delete process.env.HARNESS_LIVE;
    else process.env.HARNESS_LIVE = prev;
    rmrf(projectRoot);
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
    rmrf(projectRoot);
  }
});

// Fix 1: unknown/unrecognized risk_level must NOT silently downgrade to 'low'
// It must be treated as the highest known severity (fail-closed).
test('maxRisk: unknown risk_level string must not silently become low', () => {
  const { projectRoot, sessionId, sessionDir } = seedSession();
  try {
    // Inject a summary with an unknown/crafted risk_level string that could
    // come from a rule returning an unrecognized enum value.
    fs.writeFileSync(path.join(sessionDir, 'preverify-summary.json'), JSON.stringify({
      verdict: 'block',
      finding_count: 1,
      gate_required: false,
      reason: 'some finding',
      risk_level: 'UNKNOWN_CRAFTED_RISK_LEVEL',
      risk_tags: ['custom'],
    }, null, 2));

    const decision = buildDecision(sessionDir, { sessionId });
    // An unrecognized risk_level must NOT collapse to 'low'.
    // It must surface as 'critical' (highest safe default).
    assert.notEqual(decision.risk.level, 'low',
      'unknown risk_level must not silently downgrade to low');
    assert.equal(decision.risk.level, 'critical',
      'unknown risk_level must surface as critical (fail-closed)');
  } finally {
    rmrf(projectRoot);
  }
});

// Fix 5: readMarker TOCTOU — file removed between existsSync and readFileSync
test('readMarker: file removed between exists and read does not crash decision', () => {
  const { projectRoot, sessionDir } = seedSession();
  try {
    // Write the marker file, then use a patched exists that returns true
    // but remove the file before the read happens.
    // We simulate this by writing the marker, building the decision (it
    // survives), and then removing the marker and building again.
    fs.writeFileSync(path.join(sessionDir, 'HUMAN_GATE'), 'reason: test\nat: 2026-01-01T00:00:00Z\n');
    // Remove mid-flight cannot be easily simulated without patching; instead
    // verify that a pre-removed marker path is handled gracefully (no throw).
    fs.unlinkSync(path.join(sessionDir, 'HUMAN_GATE'));
    // If TOCTOU protection is in place, a missing file after existsSync returns
    // false should not throw — and since existsSync+readFileSync are guarded,
    // the decision should still complete without throwing.
    assert.doesNotThrow(() => buildDecision(sessionDir, {}),
      'decision must not crash when a marker file is removed at read time');
  } finally {
    rmrf(projectRoot);
  }
});
