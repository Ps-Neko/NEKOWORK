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

test('CLI pr-prep writes review artifacts without remote mutation', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-pr-prep-'));
  try {
    seedVerifiedSession(projectRoot, 'unit-cli-pr-prep');
    const ship = runCli(['ship', 'ship readiness smoke', '--session', 'unit-cli-pr-prep', '--project-root', projectRoot, '--json']);
    assert.equal(ship.status, 0, ship.stderr || ship.stdout);

    const prep = runCli(['pr-prep', 'prepare branch for review', '--session', 'unit-cli-pr-prep', '--project-root', projectRoot, '--json']);
    assert.equal(prep.status, 0, prep.stderr || prep.stdout);
    const json = JSON.parse(prep.stdout);
    assert.equal(json.readyForPr, true);
    assert.equal(json.noRemoteMutation, true);
    assert.ok(json.artifacts.includes('PR_SUMMARY.md'));

    const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-cli-pr-prep');
    assert.ok(fs.existsSync(path.join(sessionDir, 'PR_SUMMARY.md')));
    assert.ok(fs.existsSync(path.join(sessionDir, 'RISK_NOTES.md')));
    assert.ok(fs.existsSync(path.join(sessionDir, 'TEST_EVIDENCE.md')));
    assert.ok(fs.existsSync(path.join(sessionDir, 'CHANGELOG_DRAFT.md')));
    assert.ok(fs.existsSync(path.join(sessionDir, 'SHIP_DECISION.md')));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('CLI accepts build modes as the one-command safe builder entry', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-build-'));
  try {
    const build = runCli(['build', 'safe builder smoke', '--mode', 'safe', '--session', 'unit-cli-build', '--project-root', projectRoot, '--json']);
    assert.equal(build.status, 0, build.stderr || build.stdout);
    assert.match(build.stdout, /"mode": "safe"/);
    assert.match(build.stdout, /"profile": "security"/);
    assert.match(build.stdout, /"secure": true/);
    assert.ok(fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-cli-build', 'build-summary.json')));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('CLI build --dry-run previews plan without creating a session', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-build-dry-run-'));
  try {
    const build = runCli(['build', 'safe builder preview', '--mode', 'safe', '--dry-run', '--session', 'unit-cli-build-dry-run', '--project-root', projectRoot, '--json']);
    assert.equal(build.status, 0, build.stderr || build.stdout);
    const preview = JSON.parse(build.stdout);
    assert.equal(preview.dryRun, true);
    assert.equal(preview.mode, 'safe');
    assert.equal(preview.profile, 'security');
    assert.equal(preview.secure, true);
    assert.equal(preview.stages.find(s => s.stage === 'verify').challenge, true);
    assert.ok(!fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-cli-build-dry-run')));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('CLI build defaults to auto mode and reports selected safe preset', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-build-auto-'));
  try {
    const build = runCli(['build', 'add OAuth login safely', '--dry-run', '--session', 'unit-cli-build-auto', '--project-root', projectRoot, '--json']);
    assert.equal(build.status, 0, build.stderr || build.stdout);
    const preview = JSON.parse(build.stdout);
    assert.equal(preview.requestedMode, 'auto');
    assert.equal(preview.autoMode, true);
    assert.equal(preview.mode, 'safe');
    assert.equal(preview.profile, 'security');
    assert.equal(preview.secure, true);
    assert.equal(preview.teamRun, true);
    assert.deepEqual(preview.teamWorkers, ['planner', 'security', 'test']);
    assert.equal(preview.intelligence.taskType, 'security-sensitive');
    assert.ok(!fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-cli-build-auto')));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('CLI build --mode auto routes release work to release preset', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-build-auto-release-'));
  try {
    const build = runCli(['build', 'prepare changelog and npm package release notes', '--mode', 'auto', '--dry-run', '--session', 'unit-cli-build-auto-release', '--project-root', projectRoot, '--json']);
    assert.equal(build.status, 0, build.stderr || build.stdout);
    const preview = JSON.parse(build.stdout);
    assert.equal(preview.mode, 'release');
    assert.equal(preview.profile, 'quality');
    assert.equal(preview.intelligence.taskType, 'release-readiness');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('CLI build blocks unsafe explicit fast override unless --force-mode is present', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-build-override-'));
  try {
    const blocked = runCli(['build', 'change OAuth token validation', '--mode', 'fast', '--dry-run', '--session', 'unit-cli-build-override-blocked', '--project-root', projectRoot, '--json']);
    assert.equal(blocked.status, 2, blocked.stdout || blocked.stderr);
    assert.match(blocked.stderr, /recommended mode is safe/);
    assert.ok(!fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-cli-build-override-blocked')));

    const forced = runCli(['build', 'change OAuth token validation', '--mode', 'fast', '--force-mode', '--dry-run', '--session', 'unit-cli-build-override-forced', '--project-root', projectRoot, '--json']);
    assert.equal(forced.status, 0, forced.stderr || forced.stdout);
    const preview = JSON.parse(forced.stdout);
    assert.equal(preview.mode, 'fast');
    assert.equal(preview.modeOverride.forced, true);
    assert.equal(preview.modeOverride.recommendedMode, 'safe');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('CLI build blocks high-risk release downgrade unless --force-mode is present', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-build-release-override-'));
  try {
    const blocked = runCli(['build', 'prepare npm package publish release notes', '--mode', 'fast', '--dry-run', '--session', 'unit-cli-build-release-override-blocked', '--project-root', projectRoot, '--json']);
    assert.equal(blocked.status, 2, blocked.stdout || blocked.stderr);
    assert.match(blocked.stderr, /recommended mode is release/);
    assert.ok(!fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-cli-build-release-override-blocked')));

    const forced = runCli(['build', 'prepare npm package publish release notes', '--mode', 'fast', '--force-mode', '--dry-run', '--session', 'unit-cli-build-release-override-forced', '--project-root', projectRoot, '--json']);
    assert.equal(forced.status, 0, forced.stderr || forced.stdout);
    const preview = JSON.parse(forced.stdout);
    assert.equal(preview.mode, 'fast');
    assert.equal(preview.modeOverride.forced, true);
    assert.equal(preview.modeOverride.recommendedMode, 'release');
    assert.ok(preview.modeOverride.tags.includes('deploy'));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('CLI auto dry-run previews bounded autonomy without creating a session', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-auto-dry-run-'));
  try {
    const auto = runCli(['auto', 'add OAuth login safely', '--dry-run', '--session', 'unit-cli-auto-dry-run', '--project-root', projectRoot, '--json']);
    assert.equal(auto.status, 0, auto.stderr || auto.stdout);
    const preview = JSON.parse(auto.stdout);
    assert.equal(preview.dryRun, true);
    assert.equal(preview.level, 'normal');
    assert.equal(preview.mode, 'safe');
    assert.equal(preview.applyRequested, false);
    assert.equal(preview.policy.stopBeforeApply, true);
    assert.ok(!fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-cli-auto-dry-run')));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('CLI auto dry-run previews parallel candidates without creating a session', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-auto-candidates-'));
  try {
    const auto = runCli(['auto', 'refactor parser safely', '--parallel-candidates', '2', '--dry-run', '--session', 'unit-cli-auto-candidates', '--project-root', projectRoot, '--json']);
    assert.equal(auto.status, 0, auto.stderr || auto.stdout);
    const preview = JSON.parse(auto.stdout);
    assert.equal(preview.parallelCandidates.enabled, true);
    assert.equal(preview.parallelCandidates.count, 2);
    assert.ok(preview.stages.some(stage => stage.stage === 'parallel-candidates' && stage.runs === true));
    assert.ok(!fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-cli-auto-candidates')));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('CLI auto rejects invalid parallel candidate counts', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-auto-candidates-invalid-'));
  try {
    const auto = runCli(['auto', 'refactor parser safely', '--parallel-candidates', '5', '--dry-run', '--session', 'unit-cli-auto-candidates-invalid', '--project-root', projectRoot, '--json']);
    assert.equal(auto.status, 2, auto.stdout || auto.stderr);
    assert.match(auto.stderr, /--parallel-candidates requires an integer between 2 and 4/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('CLI auto rejects --apply because apply is explicit', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-auto-apply-'));
  try {
    const auto = runCli(['auto', 'fix safely', '--apply', '--session', 'unit-cli-auto-apply', '--project-root', projectRoot, '--json']);
    assert.equal(auto.status, 2, auto.stdout || auto.stderr);
    assert.match(auto.stderr, /auto never accepts --apply/);
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
