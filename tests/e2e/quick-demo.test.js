import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('quick demo runs the shortest no-api workflow against a disposable target', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'nekowork-quick-demo-test-'));
  try {
    const result = spawnSync(process.execPath, [
      'scripts/demo-quick-run.js',
      '--target',
      target,
      '--session',
      'e2e-quick-demo',
    ], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /doctor \.\.\. OK/);
    assert.match(result.stdout, /run workflow \.\.\. OK/);
    assert.match(result.stdout, /gate status \.\.\. OK/);
    assert.ok(fs.existsSync(path.join(target, '.harness', 'state', 'sessions', 'e2e-quick-demo', 'run-summary.json')));
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});
