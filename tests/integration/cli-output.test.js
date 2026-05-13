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
