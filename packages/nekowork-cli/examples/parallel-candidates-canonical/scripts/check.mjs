import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeCommand } from '../src/parser.js';

const root = path.resolve(import.meta.dirname, '..');

assert.equal(normalizeCommand('  Ship Ready  '), 'ship-ready');
assert.equal(normalizeCommand('VERIFY   NOW'), 'verify-now');
assert.throws(() => normalizeCommand(null), /command must be a string/);

const required = [
  'case-study/TASK.md',
  'case-study/PARALLEL_CANDIDATES.md',
  'case-study/CANONICAL_VERIFY.md',
  'case-study/REPORT.md',
  'case-study/SHIP_READY.md',
];

for (const rel of required) {
  assert.ok(fs.existsSync(path.join(root, rel)), `${rel} exists`);
}

const report = fs.readFileSync(path.join(root, 'case-study', 'REPORT.md'), 'utf8');
assert.match(report, /Parallel Candidates/);
assert.match(report, /Selected candidate: candidate-01/);
assert.match(report, /Final verification: approve/);
assert.match(report, /Ship ready: true/);
assert.match(report, /Applied: false/);

console.log('parallel-candidates-canonical checks passed');
