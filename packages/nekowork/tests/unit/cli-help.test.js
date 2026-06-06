// slim CLI: `<verb> --help` / `-h` prints usage and exits 0 without running the verb.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'cli.js');

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: os.tmpdir(), encoding: 'utf8', windowsHide: true });
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
