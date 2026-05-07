// E2E smoke tests for the deterministic mock review flow.

import { strict as assert } from 'node:assert';
import { test, before, after } from 'node:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
let SANDBOX;

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === '.harness') continue;
    if (e.name.startsWith('.') && !['.gitignore', '.mcp.json'].includes(e.name)) continue;
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

before(() => {
  SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-e2e-'));
  copyDir(ROOT, SANDBOX);
  try {
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(SANDBOX, 'node_modules'), 'junction');
  } catch {
    copyDir(path.join(ROOT, 'node_modules'), path.join(SANDBOX, 'node_modules'));
  }
});

after(() => {
  if (SANDBOX && fs.existsSync(SANDBOX)) {
    fs.rmSync(SANDBOX, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

function run(scriptArgs, opts = {}) {
  return spawnSync(process.execPath, scriptArgs, {
    cwd: SANDBOX,
    env: { ...process.env, FORCE_COLOR: '0' },
    encoding: 'utf8',
    ...opts,
  });
}

test('demo-review --no-ship writes all expected handoffs', () => {
  const sessionId = 'e2e-jwt-no-ship';
  const r = run(['scripts/demo-review.js', 'add JWT validation middleware', sessionId, '--no-ship']);
  assert.equal(r.status, 0, `demo failed: ${r.stderr}\n${r.stdout}`);

  const sessionDir = path.join(SANDBOX, '.harness', 'state', 'sessions', sessionId);
  assert.ok(fs.existsSync(sessionDir), 'session directory was not created');

  const prd = JSON.parse(fs.readFileSync(path.join(sessionDir, 'prd.json'), 'utf8'));
  assert.equal(prd.task, 'add JWT validation middleware');
  assert.equal(prd.acceptance.length, 3);

  const handoffs = fs.readdirSync(path.join(sessionDir, 'handoffs')).filter(f => f.endsWith('.md')).sort();
  assert.equal(handoffs.length, 8);
  const stages = handoffs.map(stageFromHandoffFile);
  assert.ok(stages.includes('ideate'));
  assert.ok(stages.includes('plan'));
  assert.ok(stages.includes('implement'));
  assert.ok(stages.includes('self-review'));
  assert.ok(stages.includes('codex-review'));
  assert.ok(stages.includes('codex-challenge'));
  assert.ok(!stages.includes('ship'), 'ship should be skipped with --no-ship');
});

test('handoff markdown files include required five-field markers', () => {
  const sessionDir = path.join(SANDBOX, '.harness', 'state', 'sessions', 'e2e-jwt-no-ship');
  const handoffs = fs.readdirSync(path.join(sessionDir, 'handoffs')).filter(f => f.endsWith('.md'));
  for (const f of handoffs) {
    const content = fs.readFileSync(path.join(sessionDir, 'handoffs', f), 'utf8');
    assert.match(content, /\*\*Decided\*\*:/, `${f}: missing Decided`);
    assert.match(content, /\*\*Files\*\*:/, `${f}: missing Files`);
  }
});

test('demo-review --secure forces codex-challenge', () => {
  const sessionId = 'e2e-secure';
  const r = run(['scripts/demo-review.js', 'validate auth headers', sessionId, '--secure', '--no-ship']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /codex-challenge/);
  const handoffDir = path.join(SANDBOX, '.harness', 'state', 'sessions', sessionId, 'handoffs');
  const files = fs.readdirSync(handoffDir);
  assert.ok(files.some(s => /codex-challenge\.md$/.test(s)), 'challenge markdown was not created');
});

test('round counter proceeds to round 2 after high self-review findings', () => {
  const sessionDir = path.join(SANDBOX, '.harness', 'state', 'sessions', 'e2e-jwt-no-ship');
  const reviews = fs.readdirSync(path.join(sessionDir, 'handoffs'))
    .filter(f => /self-review(?:-r\d+)?\.json$/.test(f));
  assert.deepEqual(reviews.sort(), ['04-self-review-r2.json', '04-self-review.json'].sort());
  const final = JSON.parse(fs.readFileSync(path.join(sessionDir, 'handoffs', '04-self-review-r2.json'), 'utf8'));
  assert.equal(final.verdict, 'approve');
  assert.equal(final.round, 2);
});

test('demo-review currently challenges by default for compatibility', () => {
  const sessionId = 'e2e-non-auth';
  const r = run(['scripts/demo-review.js', 'fix docs typo', sessionId, '--no-ship']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /codex-challenge/);
});

test('CLI version matches package.json', () => {
  const r = run(['scripts/cli.js', 'version']);
  assert.equal(r.status, 0);
  const pkg = JSON.parse(fs.readFileSync(path.join(SANDBOX, 'package.json'), 'utf8'));
  assert.match(r.stdout, new RegExp(pkg.version));
});

test('CLI help exposes public and advanced verbs', () => {
  const r = run(['scripts/cli.js']);
  const out = r.stdout + r.stderr;
  for (const verb of ['check', 'init', 'install', 'ask', 'team', 'work', 'verify', 'gate', 'ship', 'apply', 'run', 'review', 'review-cycle', 'plan', 'doctor', 'ralph', 'wait', 'sessions', 'costs', 'instincts', 'version']) {
    assert.match(out, new RegExp(verb), `verb "${verb}" not shown`);
  }
});

test('CLI check alias returns a quick health report by default', () => {
  const r = run(['scripts/cli.js', 'check', '--json']);
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(r.stdout);
  assert.equal(report.name, 'NEKOWORK doctor');
  assert.ok(report.checks.some((check) => check.name === 'node'));
  assert.ok(report.checks.some((check) => check.name === 'package metadata'));
});

test('CLI doctor quick mode returns a health report', () => {
  const r = run(['scripts/cli.js', 'doctor', '--quick', '--json']);
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(r.stdout);
  assert.equal(report.name, 'NEKOWORK doctor');
  assert.ok(report.checks.some((check) => check.name === 'node'));
});

test('CLI plan stops before implement', () => {
  const sessionId = 'e2e-cli-plan';
  const r = run(['scripts/cli.js', 'plan', 'plan only', '--session', sessionId]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /handoffs: ideate .*plan/);
  const handoffDir = path.join(SANDBOX, '.harness', 'state', 'sessions', sessionId, 'handoffs');
  const stages = fs.readdirSync(handoffDir).filter(f => f.endsWith('.md')).join('\n');
  assert.match(stages, /01-ideate\.md/);
  assert.match(stages, /02-plan\.md/);
  assert.doesNotMatch(stages, /03-implement\.md/);
});

test('CLI decomposed work verify ship path writes no-ship readiness', () => {
  const sessionId = 'e2e-cli-work-verify-ship';
  const work = run(['scripts/cli.js', 'work', 'implement one thing', '--session', sessionId, '--json']);
  assert.equal(work.status, 0, work.stderr);

  const verify = run(['scripts/cli.js', 'verify', 'verify one thing', '--session', sessionId, '--json']);
  assert.equal(verify.status, 0, verify.stderr);

  const gate = run(['scripts/cli.js', 'gate', 'status', '--session', sessionId, '--json']);
  assert.equal(gate.status, 0, gate.stderr);
  assert.equal(JSON.parse(gate.stdout).status, 'clear');

  const ship = run(['scripts/cli.js', 'ship', 'prepare ship readiness', '--session', sessionId, '--json']);
  assert.equal(ship.status, 0, ship.stderr);
  const result = JSON.parse(ship.stdout);
  assert.equal(result.shipReady, false);
  assert.equal(result.noShip, true);
  assert.equal(result.humanGate, false);

  const sessionDir = path.join(SANDBOX, '.harness', 'state', 'sessions', sessionId);
  assert.ok(fs.existsSync(path.join(sessionDir, 'handoffs', '07-ship.json')));
  assert.ok(fs.existsSync(path.join(sessionDir, 'ship-summary.json')));
  assert.ok(fs.existsSync(path.join(sessionDir, 'NO_SHIP')));
});

test('CLI run wrapper writes run summary', () => {
  const sessionId = 'e2e-cli-run';
  const r = run(['scripts/cli.js', 'run', 'run wrapper smoke', '--session', sessionId, '--json']);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(result.stoppedAt, 'ship');
  assert.equal(result.noShip, true);
  assert.equal(result.applied, false);

  const sessionDir = path.join(SANDBOX, '.harness', 'state', 'sessions', sessionId);
  assert.ok(fs.existsSync(path.join(sessionDir, 'run-summary.json')));
  assert.ok(fs.existsSync(path.join(sessionDir, 'ship-summary.json')));
});

test('CLI review-cycle alias writes legacy review summary', () => {
  const sessionId = 'e2e-cli-review-cycle';
  const r = run(['scripts/cli.js', 'review-cycle', 'legacy alias smoke', '--session', sessionId, '--fast', '--no-ship', '--no-codex']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /legacy-full-review-cycle/);

  const sessionDir = path.join(SANDBOX, '.harness', 'state', 'sessions', sessionId);
  const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'review-summary.json'), 'utf8'));
  assert.equal(summary.mode, 'legacy-full-review-cycle');
  assert.equal(summary.compatibility_command, 'review-cycle');
  assert.equal(summary.recommended_wrapper, 'run');
  assert.equal(summary.no_ship, true);
});

test('CLI ralph can use the decomposed run engine', () => {
  const sessionId = 'e2e-cli-ralph-run';
  const r = run(['scripts/cli.js', 'ralph', 'ralph run engine smoke', '--session', sessionId, '--engine', 'run', '--max-iter', '1']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /"engine": "run"/);

  const sessionDir = path.join(SANDBOX, '.harness', 'state', 'sessions', sessionId);
  const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'ralph-summary.json'), 'utf8'));
  assert.equal(summary.engine, 'run');
  assert.equal(summary.reason, 'max_iter');
  assert.ok(fs.existsSync(path.join(SANDBOX, '.harness', 'state', 'sessions', `${sessionId}-i1`, 'run-summary.json')));
});

test('CLI --project-root writes session state to external project root', () => {
  const sessionId = 'e2e-cli-project-root';
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-project-root-'));
  const harnessSessionDir = path.join(SANDBOX, '.harness', 'state', 'sessions', sessionId);

  try {
    const r = run(['scripts/cli.js', 'plan', 'external project plan', '--session', sessionId, '--project-root', projectRoot]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /project root:/);
    assert.ok(fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', sessionId, 'handoffs', '02-plan.json')));
    assert.equal(fs.existsSync(harnessSessionDir), false, 'session state should not be written to the harness root');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('CLI review unknown flags fail as usage errors', () => {
  const r = run(['scripts/cli.js', 'review', 'docs edit', '--unknown-flag']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown flag/);
  assert.doesNotMatch(r.stderr, /UNEXPECTED/);
});

function stageFromHandoffFile(file) {
  return file
    .replace(/^\d+-/, '')
    .replace(/-r\d+(?=\.md$)/, '')
    .replace(/\.md$/, '');
}
