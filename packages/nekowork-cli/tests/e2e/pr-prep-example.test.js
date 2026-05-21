import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const EXAMPLE = path.join(ROOT, 'examples', 'pr-prep-smoke');

test('pr-prep smoke example is self-contained and passes local checks', () => {
  const required = [
    'README.md',
    'package.json',
    'scripts/check.mjs',
    'case-study/TASK.md',
    'case-study/PR_SUMMARY.md',
    'case-study/RISK_NOTES.md',
    'case-study/TEST_EVIDENCE.md',
    'case-study/CHANGELOG_DRAFT.md',
    'case-study/SHIP_DECISION.md',
    'case-study/REPORT.md',
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
  assert.match(result.stdout, /pr-prep-smoke checks passed/);
});
