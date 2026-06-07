// report orchestrator: reportSession reads a session dir's summary/marker/
// evidence files, derives a status, and renders REPORT.md with a Trust Card and
// the expected sections. Everything runs under os.tmpdir(); the repo working
// tree is never written.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { reportSession } from '../../scripts/orchestrators/report.js';
import { rmrf } from '../helpers/tmp.js';

// Build a temp projectRoot with one session dir; seed `files` (relative-to-
// session path → string content). Returns { projectRoot, sessionId, sessionDir }.
function makeSession(files = {}, sessionId = 'sess-report') {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-report-'));
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(sessionDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return { projectRoot, sessionId, sessionDir };
}

function marker(reason, at = '2026-01-01T00:00:00.000Z') {
  return `reason: ${reason}\nat: ${at}\n`;
}

test('reportSession: throws on a missing session', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-report-'));
  try {
    assert.throws(
      () => reportSession({ projectRoot, sessionId: 'nope' }),
      /requires an existing session/i,
    );
  } finally {
    rmrf(projectRoot);
  }
});

test('reportSession: throws without a session id', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-report-'));
  try {
    assert.throws(() => reportSession({ projectRoot }), /requires --session/i);
  } finally {
    rmrf(projectRoot);
  }
});

test('reportSession: writes REPORT.md with the verdict and core sections', () => {
  const { projectRoot, sessionId, sessionDir } = makeSession({
    'verify-summary.json': JSON.stringify({ verdict: 'approve', profile: 'core' }),
    'SHIP_READY': marker('verification passed'),
  });
  try {
    const result = reportSession({ projectRoot, sessionId });
    assert.ok(result.reportPath, 'reportPath should be returned');
    assert.equal(result.reportPath, path.join(sessionDir, 'REPORT.md'));
    assert.ok(fs.existsSync(result.reportPath), 'REPORT.md written to disk');

    const md = fs.readFileSync(result.reportPath, 'utf8');
    assert.match(md, /# NEKOWORK Session Report/, 'has report title');
    assert.match(md, /## Trust Card/, 'has Trust Card section');
    assert.match(md, /## Summary/, 'has Summary section');
    assert.match(md, /## Evidence Files/, 'has Evidence Files section');
    // ship-ready session with no gate / no-ship → SHIP_READY decision
    assert.match(md, /SHIP_READY/, 'verdict/decision surfaced');
    assert.equal(result.status, 'ship_ready');
    assert.equal(result.shipReady, true);
  } finally {
    rmrf(projectRoot);
  }
});

test('reportSession: a GATE_BLOCKED session reports gate_blocked + blocked Trust Card', () => {
  const { projectRoot, sessionId } = makeSession({
    'GATE_BLOCKED': marker('hardcoded secret detected'),
    'gate-summary.json': JSON.stringify({ status: 'blocked', blocked: true, block_reason: 'hardcoded secret detected' }),
  });
  try {
    const result = reportSession({ projectRoot, sessionId });
    assert.equal(result.status, 'gate_blocked');
    const md = result.markdown;
    assert.match(md, /GATE_BLOCKED/, 'final decision is GATE_BLOCKED');
    assert.match(md, /blocked this change/i, 'blocked headline present');
    assert.match(md, /hardcoded secret detected/, 'block reason surfaced in the report');
  } finally {
    rmrf(projectRoot);
  }
});

test('reportSession: an open HUMAN_GATE session reports human_gate status', () => {
  const { projectRoot, sessionId } = makeSession({
    'HUMAN_GATE': marker('needs a human to review the diff'),
  });
  try {
    const result = reportSession({ projectRoot, sessionId });
    assert.equal(result.status, 'human_gate');
    assert.equal(result.humanGate, true);
    assert.match(result.markdown, /Human Gate/, 'Trust Card shows Human Gate');
  } finally {
    rmrf(projectRoot);
  }
});

test('reportSession: --stdout-only returns markdown without writing a file', () => {
  const { projectRoot, sessionId, sessionDir } = makeSession({
    'verify-summary.json': JSON.stringify({ verdict: 'approve' }),
  });
  try {
    const result = reportSession({ projectRoot, sessionId, stdoutOnly: true });
    assert.equal(result.reportPath, null, 'no report path when stdout-only');
    assert.ok(result.markdown.includes('# NEKOWORK Session Report'), 'markdown still produced');
    assert.ok(!fs.existsSync(path.join(sessionDir, 'REPORT.md')), 'REPORT.md not written in stdout-only mode');
  } finally {
    rmrf(projectRoot);
  }
});

test('reportSession: includes handoffs and acceptance criteria when present', () => {
  const { projectRoot, sessionId } = makeSession({
    'verify-summary.json': JSON.stringify({ verdict: 'approve' }),
    'acceptance-criteria.json': JSON.stringify({ criteria: [{ id: 'AC1', desc: 'returns 200', passes: true }] }),
    'handoffs/01-implement.json': JSON.stringify({ stage: 'implement', agent: 'executor', files: ['src/a.js'] }),
  });
  try {
    const result = reportSession({ projectRoot, sessionId });
    const md = result.markdown;
    assert.match(md, /## Acceptance Criteria/);
    assert.match(md, /AC1/, 'acceptance criterion id rendered');
    assert.match(md, /## Handoffs/);
    assert.match(md, /implement/, 'handoff stage rendered');
    assert.equal(result.handoffs, 1, 'one handoff counted');
  } finally {
    rmrf(projectRoot);
  }
});
