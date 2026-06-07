// slim CLI: `<verb> --help` / `-h` prints usage and exits 0 without running the verb.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'cli.js');

function run(args, cwd = os.tmpdir()) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', windowsHide: true });
}

for (const verb of ['check', 'verify-pr', 'report', 'apply']) {
  test(`${verb} --help prints usage and exits 0 without running the verb`, () => {
    const r = run([verb, '--help']);
    assert.equal(r.status, 0, `exit code should be 0 (stderr: ${r.stderr})`);
    assert.match(r.stdout, /Usage:/);
    assert.match(r.stdout, /nekowork verify-pr/);
    // help must short-circuit before the verb executes or errors
    assert.doesNotMatch(r.stdout, /verdict\s+:/);
    assert.doesNotMatch(r.stdout, /=== (verify-pr|report|apply|nekowork check) ===/);
    assert.doesNotMatch(r.stderr, /requires --session/);
  });

  test(`${verb} -h prints usage and exits 0`, () => {
    const r = run([verb, '-h']);
    assert.equal(r.status, 0, `exit code should be 0 (stderr: ${r.stderr})`);
    assert.match(r.stdout, /Usage:/);
  });
}

// Fix 15: --help documents --full-scan
test('verify-pr --help lists --full-scan', () => {
  const r = run(['verify-pr', '--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--full-scan/);
});

// Fix 9: verify-pr outside a git repo prints a friendly message + hint, exits non-zero
test('verify-pr outside a git repo prints a friendly hint and exits non-zero', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-nogit-'));
  try {
    const r = run(['verify-pr'], dir);
    assert.notEqual(r.status, 0, 'should exit non-zero');
    assert.doesNotMatch(r.stderr, /at \w+ \(.*diff-parser\.js/, 'should not dump a raw stack trace');
    assert.match(r.stderr, /git repository/i);
    assert.match(r.stderr, /--from-patch/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
