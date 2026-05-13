import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'case-study/TASK.md',
  'case-study/PR_SUMMARY.md',
  'case-study/RISK_NOTES.md',
  'case-study/TEST_EVIDENCE.md',
  'case-study/CHANGELOG_DRAFT.md',
  'case-study/SHIP_DECISION.md',
  'case-study/REPORT.md',
];

for (const rel of required) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error(`${rel} missing`);
}

const decision = fs.readFileSync(path.join(root, 'case-study', 'SHIP_DECISION.md'), 'utf8');
if (!/Ready for PR: yes/.test(decision)) {
  throw new Error('SHIP_DECISION.md must record PR readiness');
}
if (!/did not create a branch/.test(decision)) {
  throw new Error('SHIP_DECISION.md must preserve explicit PR boundary');
}

const report = fs.readFileSync(path.join(root, 'case-study', 'REPORT.md'), 'utf8');
if (!/## PR Prep/.test(report)) {
  throw new Error('REPORT.md must include PR Prep section');
}

console.log('pr-prep-smoke checks passed');
