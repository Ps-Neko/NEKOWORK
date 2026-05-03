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
  for (const verb of ['install', 'review', 'plan', 'doctor', 'ralph', 'wait', 'sessions', 'costs', 'instincts', 'version']) {
    assert.match(out, new RegExp(verb), `verb "${verb}" not shown`);
  }
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
