import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prPrepSession } from '../../scripts/orchestrators/pr-prep.js';

test('pr-prep turns ship-ready evidence into local review artifacts only', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-pr-prep-'));
  try {
    seedShipReadySession(projectRoot, 'unit-pr-prep');

    const result = prPrepSession({
      sessionId: 'unit-pr-prep',
      projectRoot,
      task: 'prepare parser fix for review',
    });

    assert.equal(result.sessionId, 'unit-pr-prep');
    assert.equal(result.readyForPr, true);
    assert.equal(result.shipReady, true);
    assert.equal(result.noShip, false);
    assert.equal(result.humanGate, false);
    assert.equal(result.targetProjectMutated, false);
    assert.equal(result.noRemoteMutation, true);

    const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-pr-prep');
    for (const rel of ['PR_SUMMARY.md', 'RISK_NOTES.md', 'TEST_EVIDENCE.md', 'CHANGELOG_DRAFT.md', 'SHIP_DECISION.md', 'pr-prep-summary.json', 'REPORT.md']) {
      assert.ok(fs.existsSync(path.join(sessionDir, rel)), `${rel} exists`);
    }

    const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'pr-prep-summary.json'), 'utf8'));
    assert.equal(summary.ready_for_pr, true);
    assert.equal(summary.no_remote_mutation, true);
    assert.deepEqual(summary.artifacts, ['PR_SUMMARY.md', 'RISK_NOTES.md', 'TEST_EVIDENCE.md', 'CHANGELOG_DRAFT.md', 'SHIP_DECISION.md']);

    const prSummary = fs.readFileSync(path.join(sessionDir, 'PR_SUMMARY.md'), 'utf8');
    assert.match(prSummary, /Ready for PR: yes/);
    assert.match(prSummary, /NEKOWORK did not create a branch, commit, push, open a PR, apply, publish, or deploy/);

    const report = fs.readFileSync(path.join(sessionDir, 'REPORT.md'), 'utf8');
    assert.match(report, /## PR Prep/);
    assert.match(report, /Ready for PR: yes/);
    assert.match(report, /PR_SUMMARY\.md/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('pr-prep records no-ship evidence without making PR-ready claims', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-pr-prep-noship-'));
  try {
    seedShipReadySession(projectRoot, 'unit-pr-prep-noship', { noShip: true });

    const result = prPrepSession({
      sessionId: 'unit-pr-prep-noship',
      projectRoot,
    });

    assert.equal(result.readyForPr, false);
    assert.equal(result.noShip, true);
    assert.equal(result.decision, 'NO_SHIP');

    const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-pr-prep-noship');
    const shipDecision = fs.readFileSync(path.join(sessionDir, 'SHIP_DECISION.md'), 'utf8');
    assert.match(shipDecision, /Ready for PR: no/);
    assert.match(shipDecision, /Resolve blockers or gates/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

function seedShipReadySession(projectRoot, sessionId, opts = {}) {
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');
  fs.mkdirSync(handoffDir, { recursive: true });

  writeJson(path.join(sessionDir, 'acceptance-criteria.json'), {
    source: 'unit',
    required: true,
    criteria: [
      { id: 'AC-001', desc: 'Parser keeps non-empty input stable.', passes: true },
    ],
  });
  writeJson(path.join(sessionDir, 'verify-summary.json'), {
    sessionId,
    profile: 'quality',
    verdict: opts.noShip ? 'approve_with_fixes' : 'approve',
    acceptance_coverage: [
      { id: 'AC-001', status: opts.noShip ? 'missing' : 'covered', evidence: opts.noShip ? 'No evidence recorded.' : 'Unit fixture passed.', source: 'unit' },
    ],
    quality_warnings: opts.noShip ? ['AC-001 lacks explicit verification evidence'] : [],
    target_project_mutated: false,
  });
  writeJson(path.join(sessionDir, 'ship-summary.json'), {
    sessionId,
    task: 'fix parser edge case',
    ship_ready: !opts.noShip,
    no_ship: Boolean(opts.noShip),
    human_gate: false,
    verdict: opts.noShip ? 'approve_with_fixes' : 'approve',
    classification: { risk: 'low', tags: [] },
    target_project_mutated: false,
  });
  writeJson(path.join(handoffDir, '03-implement.json'), {
    stage: 'implement',
    agent: 'executor',
    provider: 'mock',
    model: 'sonnet',
    round: 1,
    files: ['src/parser.js'],
  });
  writeJson(path.join(handoffDir, '05-codex-review.json'), {
    stage: 'codex-review',
    agent: 'codex-reviewer',
    provider: 'mock',
    model: 'gpt-5-codex',
    round: 1,
    verdict: opts.noShip ? 'approve_with_fixes' : 'approve',
    files: ['src/parser.js'],
    issues: opts.noShip ? [{ severity: 'medium', category: 'testing', summary: 'Missing test evidence', evidence: 'No AC coverage.', required_fix: 'Add test evidence.' }] : [],
  });
  fs.writeFileSync(path.join(sessionDir, opts.noShip ? 'NO_SHIP' : 'SHIP_READY'), `reason: ${opts.noShip ? 'missing test evidence' : 'ready'}\nat: ${new Date().toISOString()}\n`);
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
