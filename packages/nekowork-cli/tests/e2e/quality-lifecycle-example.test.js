import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const EXAMPLE = path.join(ROOT, 'examples', 'quality-lifecycle-smoke');

test('quality lifecycle smoke example is self-contained and passes local checks', () => {
  const required = [
    'README.md',
    'package.json',
    'scripts/check.mjs',
    'case-study/TASK.md',
    'case-study/ASK.md',
    'case-study/PLAN.md',
    'case-study/TEAM_HANDOFFS.md',
    'case-study/WORK_SUMMARY.md',
    'case-study/VERIFY_SUMMARY.md',
    'case-study/GATE_STATUS.md',
    'case-study/SHIP_READY.md',
  ];

  for (const rel of required) {
    assert.ok(fs.existsSync(path.join(EXAMPLE, rel)), `${rel} exists`);
  }

  const result = spawnSync(process.execPath, ['scripts/check.mjs'], {
    cwd: EXAMPLE,
    encoding: 'utf8',
    windowsHide: true,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /quality-lifecycle-smoke checks passed/);
});
