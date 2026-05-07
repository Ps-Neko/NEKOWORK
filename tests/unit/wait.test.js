import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseActiveFile, buildResumePlan, processWakeups } from '../../scripts/daemon/wait.js';

test('wait parses active key-value files with JSON task values', () => {
  const active = parseActiveFile([
    'mode: ralph',
    'engine: run',
    'task: "finish the dashboard"',
    'max_iter: 4',
    'live: false',
    'secure: true',
    '',
  ].join('\n'));

  assert.equal(active.mode, 'ralph');
  assert.equal(active.engine, 'run');
  assert.equal(active.task, 'finish the dashboard');
  assert.equal(active.max_iter, 4);
  assert.equal(active.live, false);
  assert.equal(active.secure, true);
});

test('wait builds ralph run resume command from active state', () => {
  const plan = buildResumePlan({
    root: '/repo',
    sessionId: 'ralph-session',
    active: {
      mode: 'ralph',
      engine: 'run',
      task: 'resume me',
      max_iter: 2,
      secure: true,
    },
  });

  assert.equal(plan.ok, true);
  assert.deepEqual(plan.args, [
    path.join('scripts', 'cli.js'),
    'ralph',
    'resume me',
    '--session',
    'ralph-session',
    '--engine',
    'run',
    '--max-iter',
    '2',
    '--secure',
  ]);
});

test('wait clears wakeup for inactive sessions', () => {
  const root = createRoot();
  try {
    const sessionDir = seedSession(root, 'inactive', {
      wakeup: true,
      active: null,
    });

    const decisions = processWakeups({ root, runner: okRunner(), now: new Date('2026-05-07T00:00:00Z') });

    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].action, 'cleared-inactive');
    assert.equal(fs.existsSync(path.join(sessionDir, 'wakeup.json')), false);
    assert.ok(fs.existsSync(path.join(sessionDir, 'wait-summary.json')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('wait blocks human-gated sessions without resuming', () => {
  const root = createRoot();
  const calls = [];
  try {
    const sessionDir = seedSession(root, 'gated', {
      wakeup: true,
      active: { mode: 'ralph', engine: 'run', task: 'blocked' },
      humanGate: true,
    });

    const decisions = processWakeups({ root, runner: recordingRunner(calls), now: new Date('2026-05-07T00:00:00Z') });

    assert.equal(decisions[0].action, 'blocked-human-gate');
    assert.equal(calls.length, 0);
    assert.equal(fs.existsSync(path.join(sessionDir, 'wakeup.json')), false);
    const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'wait-summary.json'), 'utf8'));
    assert.equal(summary.action, 'blocked-human-gate');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('wait resumes supported sessions and clears wakeup', () => {
  const root = createRoot();
  const calls = [];
  try {
    const sessionDir = seedSession(root, 'resume-ralph', {
      wakeup: true,
      active: { mode: 'ralph', engine: 'run', task: 'resume task', max_iter: 3 },
    });

    const decisions = processWakeups({ root, runner: recordingRunner(calls), now: new Date('2026-05-07T00:00:00Z') });

    assert.equal(decisions[0].action, 'resumed');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args.slice(0, 8), [
      path.join('scripts', 'cli.js'),
      'ralph',
      'resume task',
      '--session',
      'resume-ralph',
      '--engine',
      'run',
      '--max-iter',
    ]);
    assert.equal(fs.existsSync(path.join(sessionDir, 'wakeup.json')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('wait backs off failed resume attempts', () => {
  const root = createRoot();
  try {
    const sessionDir = seedSession(root, 'fail-resume', {
      wakeup: true,
      active: { mode: 'run', task: 'try later' },
    });

    const decisions = processWakeups({
      root,
      runner: () => ({ status: 1, stdout: '', stderr: 'temporary failure' }),
      now: new Date('2026-05-07T00:00:00Z'),
    });

    assert.equal(decisions[0].action, 'backoff');
    const wakeup = JSON.parse(fs.readFileSync(path.join(sessionDir, 'wakeup.json'), 'utf8'));
    assert.equal(wakeup.last_error, 'temporary failure');
    assert.ok(wakeup.not_before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function createRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'harness-wait-'));
}

function seedSession(root, sessionId, { wakeup, active, humanGate }) {
  const sessionDir = path.join(root, '.harness', 'state', 'sessions', sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  if (wakeup) {
    fs.writeFileSync(path.join(sessionDir, 'wakeup.json'), JSON.stringify({
      session_id: sessionId,
      scheduled_at: '2026-05-07T00:00:00Z',
    }, null, 2));
  }
  if (active) fs.writeFileSync(path.join(sessionDir, 'active'), renderActive(active));
  if (humanGate) fs.writeFileSync(path.join(sessionDir, 'HUMAN_GATE'), 'reason: test\n');
  return sessionDir;
}

function renderActive(active) {
  return Object.entries(active)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? JSON.stringify(value) : value}`)
    .join('\n') + '\n';
}

function okRunner() {
  return () => ({ status: 0, stdout: '', stderr: '' });
}

function recordingRunner(calls) {
  return (command, args, options) => {
    calls.push({ command, args, options });
    return { status: 0, stdout: 'ok', stderr: '' };
  };
}
