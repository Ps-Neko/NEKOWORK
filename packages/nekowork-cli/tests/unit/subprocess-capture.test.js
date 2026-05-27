import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { spawnCapture } from '../../scripts/core/subprocess.js';

test('spawnCapture: exit 0 → code 0, no reject', async () => {
  const r = await spawnCapture('node -e "process.stdout.write(\'ok\')"', {});
  assert.equal(r.code, 0);
  assert.equal(r.timedOut, false);
  assert.match(r.stdout, /ok/);
});

test('spawnCapture: non-zero exit is resolved (not rejected)', async () => {
  const r = await spawnCapture('node -e "process.exit(3)"', {});
  assert.equal(r.code, 3);
  assert.equal(r.timedOut, false);
});

test('spawnCapture: timeout → timedOut true', async () => {
  const r = await spawnCapture('node -e "setTimeout(()=>{}, 10000)"', { timeoutMs: 300 });
  assert.equal(r.timedOut, true);
});

test('spawnCapture: reports durationMs', async () => {
  const r = await spawnCapture('node -e ""', {});
  assert.equal(typeof r.durationMs, 'number');
});
