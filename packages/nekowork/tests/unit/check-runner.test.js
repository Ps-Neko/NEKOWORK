// check-runner: runs a project's verification commands (test/lint/typecheck)
// for `verify-pr --run-checks`. Tests use `node -e` so pass/fail/timeout are
// deterministic and dependency-free on every platform.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { runChecks } from '../../scripts/lib/check-runner.js';

const PASS = 'node -e "process.exit(0)"';
const FAIL = 'node -e "process.exit(1)"';

test('runChecks: a passing command → status pass, exitCode 0', async () => {
  const results = await runChecks({ test: PASS }, { only: ['test'] });
  assert.equal(results.length, 1);
  assert.equal(results[0].name, 'test');
  assert.equal(results[0].status, 'pass');
  assert.equal(results[0].exitCode, 0);
});

test('runChecks: a failing command → status fail, non-zero exitCode', async () => {
  const results = await runChecks({ test: FAIL }, { only: ['test'] });
  assert.equal(results[0].status, 'fail');
  assert.notEqual(results[0].exitCode, 0);
});

test('runChecks: a missing command → status skipped (not a failure)', async () => {
  const results = await runChecks({ test: null }, { only: ['test'] });
  assert.equal(results[0].status, 'skipped');
  assert.equal(results[0].command, null);
});

test('runChecks: runs only the requested checks, preserving order', async () => {
  const results = await runChecks(
    { test: PASS, lint: PASS, typecheck: null },
    { only: ['test', 'lint', 'typecheck'] },
  );
  assert.deepEqual(results.map((r) => r.name), ['test', 'lint', 'typecheck']);
  assert.equal(results[0].status, 'pass');
  assert.equal(results[1].status, 'pass');
  assert.equal(results[2].status, 'skipped');
});

test('runChecks: captures an output tail on failure', async () => {
  const results = await runChecks(
    { test: "node -e \"require('nope_xyz_123')\"" },
    { only: ['test'] },
  );
  assert.equal(results[0].status, 'fail');
  assert.match(results[0].outputTail, /nope_xyz_123|Cannot find module/i);
});

test('runChecks: a command exceeding the timeout → status timeout', async () => {
  const results = await runChecks(
    { test: 'node -e "setTimeout(() => {}, 10000)"' },
    { only: ['test'], timeoutMs: 500 },
  );
  assert.equal(results[0].status, 'timeout');
});

test('runChecks: default check set is test/lint/typecheck', async () => {
  const results = await runChecks({ test: PASS });
  assert.deepEqual(results.map((r) => r.name), ['test', 'lint', 'typecheck']);
});
