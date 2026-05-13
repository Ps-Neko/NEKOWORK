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

test('nekowork (no args) shows narrow safety-gate recommendations', () => {
  const r = runCli([]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /NEKOWORK \d+\.\d+\.\d+/);
  assert.match(r.stdout, /First run ->/);
  assert.match(r.stdout, /nekowork check/);
  assert.match(r.stdout, /nekowork init/);
  assert.match(r.stdout, /nekowork start/);
  assert.match(r.stdout, /Safety gate ->/);
  assert.match(r.stdout, /start[\s\S]*report[\s\S]*apply/);
  assert.doesNotMatch(r.stdout, /work[\s\S]*verify[\s\S]*ship[\s\S]*apply/);
});

test('nekowork help all shows full legacy help', () => {
  const r = runCli(['help', 'all']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Recommended safety gate/);
  assert.match(r.stdout, /start "<task>"/);
  assert.match(r.stdout, /Install \/ verify/);
  assert.match(r.stdout, /Review loop/);
  assert.match(r.stdout, /Sessions \/ cost \/ learning/);
  assert.match(r.stdout, /instincts adopt <id> --reviewed-by <name> --reason <text>/);
});

test('nekowork help work shows verb-specific help', () => {
  const r = runCli(['help', 'work']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /nekowork work/);
  assert.match(r.stdout, /--profile/);
  assert.match(r.stdout, /Options:/);
});

test('nekowork help unknown-verb prints fallback notice', () => {
  const r = runCli(['help', 'nope']);
  const out = r.stdout + r.stderr;
  assert.match(out, /unknown verb|nekowork help all/);
});

test('nekowork work outputs new format with session and Next block', () => {
  const r = runCli(['work', 'phase1a smoke test'], { NO_COLOR: '1' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /work-\d{4}-\d{2}-\d{2}-[0-9a-f]{4}/);
  assert.match(r.stdout, /Next/);
  assert.match(r.stdout, /nekowork verify --session/);
  assert.match(r.stdout, /nekowork report --session/);
});

test('nekowork start is a beginner alias for build and prints verdict-first output', () => {
  const r = runCli(['start', 'cli output start smoke']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Verdict:/);
  assert.match(r.stdout, /Human Gate:/);
  assert.match(r.stdout, /Apply allowed:/);
  assert.match(r.stdout, /=== build ===/);
});

test('nekowork work --pack quality emits deprecation warning and still succeeds', () => {
  const r = runCli(['work', 'smoke pack', '--pack', 'quality']);
  assert.match(r.stderr, /--pack.*deprecated/);
  assert.equal(r.status, 0, `exit=${r.status} stderr=${r.stderr}`);
});

test('nekowork work without task shows a helpful error', () => {
  const r = runCli(['work']);
  assert.notEqual(r.status, 0);
  const out = r.stdout + r.stderr;
  assert.match(out, /task/);
  assert.match(out, /nekowork work "/);
  assert.match(out, /nekowork help work/);
});

test('nekowork verify resolves --session by 4-char prefix', () => {
  const w = runCli(['work', 'phase1a verify prefix']);
  const idMatch = w.stdout.match(/work-\d{4}-\d{2}-\d{2}-[0-9a-f]{4}/);
  assert.ok(idMatch, `work did not emit new id: ${w.stdout}`);
  const id = idMatch[0];
  const shortId = id.split('-').pop();

  const r = runCli(['verify', 'phase1a verify prefix', '--session', shortId]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(id));
  assert.match(r.stdout, /Next/);
});

test('nekowork verify without --session emits a helpful error', () => {
  const r = runCli(['verify', 'no session given']);
  assert.notEqual(r.status, 0);
  const out = r.stdout + r.stderr;
  assert.match(out, /--session/);
  assert.match(out, /verify/);
});
