import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { runChecks } from '../../scripts/lib/check-runner.js';

const PASS = 'node -e ""';
const FAIL = 'node -e "process.exit(1)"';

test('runChecks: passing command → status pass', async () => {
  const results = await runChecks({ test: PASS }, { only: ['test'] });
  assert.equal(results.length, 1);
  assert.equal(results[0].name, 'test');
  assert.equal(results[0].status, 'pass');
  assert.equal(results[0].exitCode, 0);
});

test('runChecks: failing command → status fail', async () => {
  const results = await runChecks({ test: FAIL }, { only: ['test'] });
  assert.equal(results[0].status, 'fail');
  assert.equal(results[0].exitCode, 1);
});

test('runChecks: null command → status skipped', async () => {
  const results = await runChecks({ test: null }, { only: ['test'] });
  assert.equal(results[0].status, 'skipped');
});

test('runChecks: nonexistent binary → status unavailable', async () => {
  const results = await runChecks({ lint: 'definitely-not-a-real-bin-xyz' }, { only: ['lint'] });
  assert.equal(results[0].status, 'unavailable');
});

test('runChecks: timeout → status timeout', async () => {
  const results = await runChecks(
    { test: 'node -e "setTimeout(()=>{}, 10000)"' },
    { only: ['test'], timeoutMs: 300 },
  );
  assert.equal(results[0].status, 'timeout');
});

test('runChecks: default only = test, lint, typecheck (build/audit excluded)', async () => {
  const results = await runChecks(
    { test: PASS, lint: PASS, typecheck: PASS, build: PASS, audit: PASS },
  );
  const names = results.map(r => r.name);
  assert.deepEqual(names, ['test', 'lint', 'typecheck']);
});

test('runChecks: outputTail captures command output', async () => {
  const results = await runChecks(
    { test: 'node -e "console.log(\'hello-from-check\')"' },
    { only: ['test'] },
  );
  assert.match(results[0].outputTail, /hello-from-check/);
});
