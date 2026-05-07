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
    assert.match(report, /AC-001/);
    assert.match(report, /Quality Warnings/);
    assert.match(report, /05-codex-review\.json/);
    const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'report-summary.json'), 'utf8'));
    assert.equal(summary.target_project_mutated, false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
