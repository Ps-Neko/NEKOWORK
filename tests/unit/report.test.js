import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { reportSession } from '../../scripts/orchestrators/report.js';

test('report writes a readable inspect-only session report', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-report-'));
  try {
    const sessionId = 'unit-report';
    const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
    const handoffDir = path.join(sessionDir, 'handoffs');
    fs.mkdirSync(handoffDir, { recursive: true });

    writeJson(path.join(sessionDir, 'acceptance-criteria.json'), {
      source: 'ask.json',
      required: true,
      criteria: [
        { id: 'AC-001', desc: 'Verification evidence is recorded before ship.', passes: false },
        { id: 'AC-002', desc: 'Target project is not mutated.', passes: false },
      ],
    });
    writeJson(path.join(sessionDir, 'verify-summary.json'), {
      sessionId,
      profile: 'quality',
      strict_quality: true,
      strict_quality_blocked: true,
      verdict: 'approve_with_fixes',
      quality_warnings: ['AC-002 lacks explicit verification evidence'],
      acceptance_coverage: [
        { id: 'AC-001', status: 'covered', evidence: 'Codex review references AC-001', source: 'codex-review' },
        { id: 'AC-002', status: 'missing', evidence: 'No explicit verification evidence found.', source: 'quality-warning' },
      ],
      target_project_mutated: false,
    });
    writeJson(path.join(sessionDir, 'ship-summary.json'), {
      sessionId,
      ship_ready: false,
      no_ship: true,
      human_gate: false,
      verdict: 'approve_with_fixes',
      target_project_mutated: false,
      next_step: 'resolve findings, rerun verify, then rerun ship',
    });
    writeJson(path.join(sessionDir, 'run-summary.json'), {
      sessionId,
      profile: 'quality',
      strict_quality: true,
      strict_quality_blocked: true,
      ship_ready: false,
      no_ship: true,
      human_gate: false,
      applied: false,
      verdict: 'approve_with_fixes',
      target_project_mutated: false,
    });
    writeJson(path.join(sessionDir, 'build-summary.json'), {
      sessionId,
      mode: 'safe',
      requested_mode: 'auto',
      auto_mode: true,
      build_intelligence: {
        version: 'build-intelligence-v0',
        task_type: 'security-sensitive',
        recommended_mode: 'safe',
        risk: 'high',
        tags: ['security'],
        workers: ['planner', 'security', 'test'],
        explanation: [
          'NEKOWORK selected safe mode because:',
          '- the task mentions auth, token, OAuth, JWT, secret, or session handling',
          '- Codex challenge is required by risk policy',
        ],
      },
      profile: 'quality',
      strict_quality: true,
      ship_ready: false,
      no_ship: true,
      human_gate: false,
      applied: false,
      verdict: 'approve_with_fixes',
      target_project_mutated: false,
    });
    writeJson(path.join(sessionDir, 'build-intelligence.json'), {
      version: 'build-intelligence-v0',
      taskType: 'security-sensitive',
      recommendedMode: 'safe',
      risk: 'high',
      tags: ['security'],
      workers: ['planner', 'security', 'test'],
      explanation: [
        'NEKOWORK selected safe mode because:',
        '- the task mentions auth, token, OAuth, JWT, secret, or session handling',
        '- Codex challenge is required by risk policy',
      ],
    });
    writeJson(path.join(sessionDir, 'build-plan.json'), {
      source: 'build-intelligence-v0',
      selected_mode: 'safe',
      requested_mode: 'auto',
      mini_plan: ['Use safe mode.'],
    });
    writeJson(path.join(handoffDir, '03-implement.json'), {
      stage: 'implement',
      agent: 'executor',
      provider: 'mock',
      model: 'sonnet',
      files: ['README.md'],
    });
    writeJson(path.join(handoffDir, '05-codex-review.json'), {
      stage: 'codex-review',
      agent: 'codex-reviewer',
      provider: 'mock',
      model: 'gpt-5-codex',
      verdict: 'approve_with_fixes',
      files: ['README.md'],
    });
    fs.writeFileSync(path.join(sessionDir, 'NO_SHIP'), `reason: verification verdict: approve_with_fixes\nat: ${new Date().toISOString()}\n`);

    const result = reportSession({ sessionId, projectRoot });
    assert.equal(result.status, 'no_ship');
    assert.equal(result.targetProjectMutated, false);
    assert.ok(fs.existsSync(result.reportPath));
    const report = fs.readFileSync(result.reportPath, 'utf8');
    assert.match(report, /NEKOWORK Session Report/);
    assert.match(report, /## Trust Card/);
    assert.match(report, /NEKOWORK blocked ship for this change\./);
    assert.match(report, /\| Final decision \| NO_SHIP \|/);
    assert.match(report, /\| Blocked \| yes \|/);
    assert.match(report, /\| Why \| verification verdict: approve_with_fixes \|/);
    assert.match(report, /\| Independent verification \| yes \|/);
    assert.match(report, /\| Human Gate \| clear \|/);
    assert.match(report, /\| Apply \| not applied \|/);
    assert.match(report, /\| Evidence \| .*verify-summary\.json.*NO_SHIP.*\|/);
    assert.match(report, /Decision: fix findings, rerun verify, then rerun ship/);
    assert.match(report, /Build Mode: safe/);
    assert.match(report, /Build Intelligence/);
    assert.match(report, /Requested mode: auto/);
    assert.match(report, /Selected mode: safe/);
    assert.match(report, /Task type: security-sensitive/);
    assert.match(report, /Workers: planner, security, test/);
    assert.match(report, /Codex challenge is required by risk policy/);
    assert.match(report, /AC-001/);
    assert.match(report, /Quality Warnings/);
    assert.match(report, /05-codex-review\.json/);
    const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'report-summary.json'), 'utf8'));
    assert.equal(summary.target_project_mutated, false);
    assert.equal(summary.mode, 'safe');
    assert.equal(summary.requestedMode, 'auto');
    assert.equal(summary.buildIntelligence.taskType, 'security-sensitive');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('report resolves --session latest to the newest session directory', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-report-latest-'));
  try {
    const oldDir = path.join(projectRoot, '.harness', 'state', 'sessions', 'old-session');
    const newDir = path.join(projectRoot, '.harness', 'state', 'sessions', 'new-session');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.mkdirSync(newDir, { recursive: true });
    writeJson(path.join(oldDir, 'run-summary.json'), { sessionId: 'old-session', verdict: 'approve' });
    writeJson(path.join(newDir, 'build-summary.json'), { sessionId: 'new-session', mode: 'fast', verdict: 'approve' });

    const oldTime = new Date('2026-05-01T00:00:00Z');
    const newTime = new Date('2026-05-02T00:00:00Z');
    fs.utimesSync(oldDir, oldTime, oldTime);
    fs.utimesSync(newDir, newTime, newTime);

    const result = reportSession({ sessionId: 'latest', projectRoot });
    assert.equal(result.sessionId, 'new-session');
    assert.equal(result.mode, 'fast');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
