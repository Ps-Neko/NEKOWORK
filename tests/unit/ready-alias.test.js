// `harness ready` is a docs-friendly alias for `harness ship`.
// We don't rename the underlying command, marker, schema, or summary -
// `ready` just dispatches to the same case branch and shares parseShipArgs.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CLI = path.join(ROOT, 'scripts', 'cli.js');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
}

test('ready alias mirrors ship missing-session usage error', () => {
  const shipResult = run(['ship']);
  const readyResult = run(['ready']);

  // Both verbs exit non-zero with the same usage hint about --session.
  assert.notEqual(shipResult.status, 0);
  assert.notEqual(readyResult.status, 0);
  assert.match(shipResult.stderr, /--session is required for ship/);
  assert.match(readyResult.stderr, /--session is required for ship/);
});

test('ready alias is documented in cli.js public verbs comment', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(CLI, 'utf8');
  assert.match(source, /ship \(alias: ready\)/);
});
