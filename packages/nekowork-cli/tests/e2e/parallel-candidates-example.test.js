import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const EXAMPLE = path.join(ROOT, 'examples', 'parallel-candidates-canonical');

test('parallel candidates canonical example is self-contained and passes local checks', () => {
  const required = [
    'README.md',
    'package.json',
    'src/parser.js',
    'scripts/check.mjs',
    'case-study/TASK.md',
    'case-study/PARALLEL_CANDIDATES.md',
    'case-study/CANONICAL_VERIFY.md',
    'case-study/REPORT.md',
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
  assert.match(result.stdout, /parallel-candidates-canonical checks passed/);
});
