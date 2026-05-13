import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const CLI = path.resolve('scripts/cli.js');
function runCli(args, env = {}) {
  return spawnSync('node', [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', ...env },
  });
}

test('nekowork (no args) shows short status + 3 recommendations', () => {
  const r = runCli([]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /NEKOWORK \d+\.\d+\.\d+/);
  assert.match(r.stdout, /처음이라면/);
  assert.match(r.stdout, /nekowork check/);
  assert.match(r.stdout, /nekowork init/);
  assert.match(r.stdout, /nekowork run/);
  assert.match(r.stdout, /자주 쓰는 흐름/);
  // flow line mentions all four verbs in order
  assert.match(r.stdout, /work[\s\S]*verify[\s\S]*ship[\s\S]*apply/);
});

test('nekowork help all shows full legacy help', () => {
  const r = runCli(['help', 'all']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Install \/ verify/);
  assert.match(r.stdout, /Review loop/);
  assert.match(r.stdout, /Sessions \/ cost \/ learning/);
});

test('nekowork help work shows verb-specific help', () => {
  const r = runCli(['help', 'work']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /nekowork work/);
  assert.match(r.stdout, /--profile/);
  assert.match(r.stdout, /예시:/);
});

test('nekowork help unknown-verb prints fallback notice', () => {
  const r = runCli(['help', 'nope']);
  const out = r.stdout + r.stderr;
  assert.match(out, /알 수 없는 동사|unknown verb/);
});

test('nekowork work outputs new format with session and Next block', () => {
  const r = runCli(['work', 'phase1a smoke test'], { NO_COLOR: '1' });
  assert.equal(r.status, 0, r.stderr);
  // new id form
  assert.match(r.stdout, /work-\d{4}-\d{2}-\d{2}-[0-9a-f]{4}/);
  // new status line
  assert.match(r.stdout, /work 완료/);
  // Next block
  assert.match(r.stdout, /Next →/);
  assert.match(r.stdout, /nekowork verify --session/);
  assert.match(r.stdout, /nekowork report --session/);
});

test('nekowork work --pack quality emits deprecation warning and still succeeds', () => {
  const r = runCli(['work', 'smoke pack', '--pack', 'quality']);
  assert.match(r.stderr, /--pack.*deprecated/);
  assert.equal(r.status, 0, `exit=${r.status} stderr=${r.stderr}`);
});

test('nekowork work without task shows 3-section error', () => {
  const r = runCli(['work']);
  assert.notEqual(r.status, 0);
  const out = r.stdout + r.stderr;
  assert.match(out, /✗.*task/);
  assert.match(out, /예시:/);
  assert.match(out, /nekowork work "/);
  assert.match(out, /도움말: nekowork help work/);
});

test('nekowork verify resolves --session by 4-char prefix', () => {
  // first run work to create a session
  const w = runCli(['work', 'phase1a verify prefix']);
  const idMatch = w.stdout.match(/work-\d{4}-\d{2}-\d{2}-[0-9a-f]{4}/);
  assert.ok(idMatch, `work did not emit new id: ${w.stdout}`);
  const id = idMatch[0];
  const shortId = id.split('-').pop();

  const r = runCli(['verify', 'phase1a verify prefix', '--session', shortId]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /verify 완료/);
  // resolver exposes the full id somewhere in output
  assert.match(r.stdout, new RegExp(id));
  assert.match(r.stdout, /Next →/);
});

test('nekowork verify without --session emits 3-section error', () => {
  const r = runCli(['verify', 'no session given']);
  assert.notEqual(r.status, 0);
  const out = r.stdout + r.stderr;
  assert.match(out, /✗.*--session/);
  assert.match(out, /예시:/);
});
