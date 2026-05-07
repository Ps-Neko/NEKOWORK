import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CLI = path.join(ROOT, 'scripts', 'cli.js');

test('CLI accepts explicit safety alias flags for team and work', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-options-'));
  try {
    const ask = runCli(['ask', 'product scope smoke', '--profile', 'product', '--session', 'unit-cli-ask-profile', '--project-root', projectRoot, '--json']);
    assert.equal(ask.status, 0, ask.stderr || ask.stdout);
    assert.match(ask.stdout, /"profile": "product"/);

    const team = runCli(['team', 'read-only planning smoke', '--no-write', '--workers', 'planner', '--session', 'unit-cli-team', '--project-root', projectRoot, '--json']);
    assert.equal(team.status, 0, team.stderr || team.stdout);
    assert.match(team.stdout, /"workers"/);

    const work = runCli(['work', 'single executor smoke', '--profile', 'quality', '--single-executor', '--session', 'unit-cli-work', '--project-root', projectRoot, '--json']);
    assert.equal(work.status, 0, work.stderr || work.stdout);
    assert.match(work.stdout, /"stage": "implement"/);
    const workSummary = JSON.parse(fs.readFileSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-cli-work', 'work-summary.json'), 'utf8'));
    assert.equal(workSummary.profile, 'quality');

    const verify = runCli(['verify', 'strict quality smoke', '--profile', 'quality', '--strict-quality', '--session', 'unit-cli-work', '--project-root', projectRoot, '--json']);
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);
    assert.match(verify.stdout, /"strictQuality": true/);
    assert.match(verify.stdout, /"strictQualityBlocked": true/);

    const report = runCli(['report', '--session', 'unit-cli-work', '--project-root', projectRoot, '--json']);
    assert.equal(report.status, 0, report.stderr || report.stdout);
    assert.match(report.stdout, /"status"/);
    assert.match(report.stdout, /"reportPath"/);
    assert.ok(fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-cli-work', 'REPORT.md')));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('CLI accepts ship --require-clean-gates as an explicit no-bypass marker', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-ship-'));
  try {
    seedVerifiedSession(projectRoot, 'unit-cli-ship');
    const ship = runCli(['ship', 'ship readiness smoke', '--require-clean-gates', '--session', 'unit-cli-ship', '--project-root', projectRoot, '--json']);
    assert.equal(ship.status, 0, ship.stderr || ship.stdout);
    assert.match(ship.stdout, /"shipReady": true/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
}

function seedVerifiedSession(projectRoot, sessionId) {
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');
  fs.mkdirSync(handoffDir, { recursive: true });
  writeJson(path.join(handoffDir, '03-implement.json'), {
    stage: 'implement',
    agent: 'executor',
    round: 1,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: 1,
    provider: 'mock',
    model: 'sonnet',
    decided: 'implemented',
    files: ['README.md'],
  });
  writeJson(path.join(handoffDir, '05-codex-review.json'), {
    stage: 'codex-review',
    agent: 'codex-reviewer',
    round: 1,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: 1,
    provider: 'mock',
    model: 'gpt-5-codex',
    decided: 'verified',
    files: ['README.md'],
    verdict: 'approve',
    issues: [],
  });
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
