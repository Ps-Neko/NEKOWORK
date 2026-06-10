// printVerifyPrSummary: the INSUFFICIENT_EVIDENCE hint must match WHY the
// verdict fired. The slim gate never executes tests, so the verdict can fire
// even when a test command WAS detected (checks_available.test === true) —
// in that case telling the user to "add a test script" is a contradiction on
// the same screen as a reason that says a test command exists but wasn't run.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { printVerifyPrSummary, VERDICT } from '../../scripts/orchestrators/verify-pr.js';

// Minimal decision shape: only the fields printVerifyPrSummary reads.
function makeResult({ testAvailable }) {
  return {
    decision: {
      verdict: VERDICT.INSUFFICIENT_EVIDENCE,
      reason: 'r',
      risk_level: 'NONE',
      merge_allowed: false,
      apply_allowed: false,
      changed_files: { total: 1, additions: 1, deletions: 0 },
      finding_counts: { critical: 0, high: 0, medium: 0, low: 0 },
      project: { type: 'node', package_manager: 'npm', checks_available: { test: testAvailable } },
    },
    findings: [],
    writtenPaths: null,
  };
}

function captureSummary(result) {
  const lines = [];
  const orig = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  try {
    printVerifyPrSummary(result);
  } finally {
    console.log = orig;
  }
  return lines.join('\n');
}

test('INSUFFICIENT_EVIDENCE hint: no test command detected → suggests adding a test script', () => {
  const out = captureSummary(makeResult({ testAvailable: false }));
  assert.match(out, /add a test script/, 'missing-test hint suggests adding one');
  assert.doesNotMatch(out, /was detected/, 'must not claim a test command was detected');
});

test('INSUFFICIENT_EVIDENCE hint: test command detected → must NOT say to add a test script', () => {
  const out = captureSummary(makeResult({ testAvailable: true }));
  assert.doesNotMatch(out, /add a test script/, 'contradicts the detected test command');
  assert.doesNotMatch(out, /has no test command/, 'contradicts checks_available.test=true');
  assert.match(out, /does not run/, 'explains the gate detects but does not execute tests');
  assert.match(out, /--ci-exit-soft/, 'still offers the CI escape hatch');
});
