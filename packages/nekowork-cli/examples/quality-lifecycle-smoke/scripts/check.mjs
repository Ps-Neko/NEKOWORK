import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const caseStudy = path.join(root, 'case-study');

const required = [
  'TASK.md',
  'ASK.md',
  'PLAN.md',
  'TEAM_HANDOFFS.md',
  'WORK_SUMMARY.md',
  'VERIFY_SUMMARY.md',
  'GATE_STATUS.md',
  'SHIP_READY.md',
];

for (const rel of required) {
  assert(fs.existsSync(path.join(caseStudy, rel)), `${rel} must exist`);
}

const ask = read('ASK.md');
const verify = read('VERIFY_SUMMARY.md');
const ship = read('SHIP_READY.md');

assert(ask.includes('profile: quality'), 'ASK must record the quality profile');
assert(ask.includes('test-first plan'), 'ASK must include the test-first question');
assert(verify.includes('claim:'), 'VERIFY must include evidence claim fields');
assert(verify.includes('evidence:'), 'VERIFY must include evidence details');
assert(verify.includes('required_fix:'), 'VERIFY must include required fixes');
assert(verify.includes('acceptance_coverage:'), 'VERIFY must include structured acceptance coverage');
assert(verify.includes('strict_quality_blocked: false'), 'VERIFY must record strict quality status');
assert(ship.includes('SHIP_READY'), 'SHIP must record readiness');

console.log('quality-lifecycle-smoke checks passed');

function read(rel) {
  return fs.readFileSync(path.join(caseStudy, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
