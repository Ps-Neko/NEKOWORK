import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('external project demo creates target harness outputs', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'nekowork-external-demo-test-'));

  try {
    const result = spawnSync(process.execPath, [
      path.join(ROOT, 'scripts', 'demo-external-project.js'),
      '--target',
      target,
      '--session',
      'e2e-external-demo',
      '--task',
      'demo external project smoke',
      '--force',
    ], {
      cwd: ROOT,
      env: { ...process.env, FORCE_COLOR: '0' },
      encoding: 'utf8',
      timeout: 120000,
    });

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /Demo completed/);

    for (const file of [
      '.harness/install-state.json',
      '.harness/state/sessions/e2e-external-demo/handoffs/02-plan.json',
      '.claude/CLAUDE.md',
      '.codex/config.toml',
      '.cursor/hooks.json',
      '.gemini/GEMINI.md',
      '.opencode/config.json',
    ]) {
      assert.ok(fs.existsSync(path.join(target, file)), `${file} should exist`);
    }
  } finally {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
