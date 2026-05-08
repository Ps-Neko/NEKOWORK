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
    assert.match(result.stdout, /build workflow \.\.\. OK/);
    assert.match(result.stdout, /report \.\.\. OK/);
    assert.match(result.stdout, /gate status \.\.\. OK/);
    assert.ok(fs.existsSync(path.join(target, '.harness', 'state', 'sessions', 'e2e-quick-demo', 'build-summary.json')));
    assert.ok(fs.existsSync(path.join(target, '.harness', 'state', 'sessions', 'e2e-quick-demo', 'run-summary.json')));
    assert.ok(fs.existsSync(path.join(target, '.harness', 'state', 'sessions', 'e2e-quick-demo', 'REPORT.md')));
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('quick demo lets safe mode keep its security profile preset', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'nekowork-quick-demo-safe-test-'));
  try {
    const result = spawnSync(process.execPath, [
      'scripts/demo-quick-run.js',
      '--target',
      target,
      '--mode',
      'safe',
      '--session',
      'e2e-quick-demo-safe',
    ], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /profile: mode preset/);
    const summary = JSON.parse(fs.readFileSync(path.join(target, '.harness', 'state', 'sessions', 'e2e-quick-demo-safe', 'build-summary.json'), 'utf8'));
    assert.equal(summary.mode, 'safe');
    assert.equal(summary.profile, 'security');
    assert.equal(summary.strict_quality, true);
    assert.equal(summary.secure, true);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});
