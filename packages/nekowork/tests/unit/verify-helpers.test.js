// verify-helpers: DIRECT unit tests for the deterministic verdict core — the
// "LLM never decides" heart of verify-pr. deriveRiskVerdict / classifyChangedFiles /
// inputSourceForMode are exported, so they are imported and exercised directly
// (no subprocess, no git) with controlled inputs, asserting EACH branch in
// isolation plus the precedence between branches.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  deriveRiskVerdict,
  classifyChangedFiles,
  inputSourceForMode,
  VERDICT,
} from '../../scripts/lib/verify-helpers.js';

// ---- fixtures -------------------------------------------------------------

function finding(severity) {
  return { severity, title: `${severity} thing`, file: 'a.js', line: 1 };
}

// classified shape produced by classifyChangedFiles(): six string[] buckets.
function classified({ source = [], tests = [], docs = [], config = [], ci = [], binary = [] } = {}) {
  return { source, tests, docs, config, ci, binary };
}

const CHECKS_WITH_TEST = { test: true };
const CHECKS_NO_TEST = { test: false };

// ---- deriveRiskVerdict: each branch independently ------------------------

test('deriveRiskVerdict: any critical finding → BLOCK (highest precedence)', () => {
  const v = deriveRiskVerdict({
    findings: [finding('critical')],
    classified: classified({ source: ['a.js'] }),
    checksAvailable: CHECKS_NO_TEST,
  });
  assert.equal(v.verdict, VERDICT.BLOCK);
  assert.equal(v.apply_allowed, false);
});

test('deriveRiskVerdict: BLOCK reason names the first critical finding (file:line)', () => {
  const v = deriveRiskVerdict({
    findings: [{ severity: 'critical', title: 'leaked key', file: 'src/secret.js', line: 42 }],
    classified: classified({ source: ['src/secret.js'] }),
    checksAvailable: CHECKS_WITH_TEST,
  });
  assert.equal(v.verdict, VERDICT.BLOCK);
  assert.match(v.reason, /leaked key \(src\/secret\.js:42\)/);
});

test('deriveRiskVerdict: high (non-critical) finding → NEEDS_HUMAN_REVIEW', () => {
  const v = deriveRiskVerdict({
    findings: [finding('high')],
    classified: classified({ source: ['a.js'] }),
    checksAvailable: CHECKS_WITH_TEST,
  });
  assert.equal(v.verdict, VERDICT.NEEDS_HUMAN_REVIEW);
  assert.equal(v.apply_allowed, false);
});

test('deriveRiskVerdict: critical wins over a co-present high (precedence)', () => {
  const v = deriveRiskVerdict({
    findings: [finding('high'), finding('critical')],
    classified: classified({ source: ['a.js'] }),
    checksAvailable: CHECKS_WITH_TEST,
  });
  assert.equal(v.verdict, VERDICT.BLOCK);
});

test('deriveRiskVerdict: source change + no test command → INSUFFICIENT_EVIDENCE', () => {
  const v = deriveRiskVerdict({
    findings: [],
    classified: classified({ source: ['a.js'] }),
    checksAvailable: CHECKS_NO_TEST,
  });
  assert.equal(v.verdict, VERDICT.INSUFFICIENT_EVIDENCE);
  assert.equal(v.apply_allowed, false);
  assert.match(v.reason, /no test command/);
});

test('deriveRiskVerdict: source change WITH a test command → ALLOW (no findings)', () => {
  const v = deriveRiskVerdict({
    findings: [],
    classified: classified({ source: ['a.js'] }),
    checksAvailable: CHECKS_WITH_TEST,
  });
  assert.equal(v.verdict, VERDICT.ALLOW);
  assert.equal(v.apply_allowed, true);
});

test('deriveRiskVerdict: low/medium non-blocking findings → ALLOW_WITH_WARNINGS', () => {
  for (const sev of ['low', 'medium']) {
    const v = deriveRiskVerdict({
      // No source files → skip the INSUFFICIENT_EVIDENCE gate so the
      // medium/low branch is isolated.
      findings: [finding(sev)],
      classified: classified({ config: ['x.json'] }),
      checksAvailable: CHECKS_NO_TEST,
    });
    assert.equal(v.verdict, VERDICT.ALLOW_WITH_WARNINGS, `severity=${sev}`);
    assert.equal(v.apply_allowed, true, `severity=${sev} apply_allowed`);
  }
});

test('deriveRiskVerdict: clean change (no findings, no source) → ALLOW', () => {
  const v = deriveRiskVerdict({
    findings: [],
    classified: classified({}),
    checksAvailable: CHECKS_NO_TEST,
  });
  assert.equal(v.verdict, VERDICT.ALLOW);
  assert.equal(v.apply_allowed, true);
  assert.equal(v.reason, 'no findings');
});

test('deriveRiskVerdict: docs/config-only clean change → ALLOW with docs/config reason', () => {
  const v = deriveRiskVerdict({
    findings: [],
    classified: classified({ docs: ['README.md'], config: ['tsconfig.json'] }),
    checksAvailable: CHECKS_NO_TEST,
  });
  assert.equal(v.verdict, VERDICT.ALLOW);
  assert.match(v.reason, /docs\/config only/);
});

// ---- precedence: INSUFFICIENT_EVIDENCE vs ALLOW_WITH_WARNINGS ------------
// The order in deriveRiskVerdict places the source+no-test gate BEFORE the
// medium/low gate, so a source file with no test command short-circuits to
// INSUFFICIENT_EVIDENCE even when medium/low findings exist.

test('deriveRiskVerdict: source + no test + medium finding → INSUFFICIENT_EVIDENCE (not ALLOW_WITH_WARNINGS)', () => {
  const v = deriveRiskVerdict({
    findings: [finding('medium')],
    classified: classified({ source: ['a.js'] }),
    checksAvailable: CHECKS_NO_TEST,
  });
  assert.equal(v.verdict, VERDICT.INSUFFICIENT_EVIDENCE,
    'source-without-test precedence beats the medium/low warning branch');
});

test('deriveRiskVerdict: source + test available + medium finding → ALLOW_WITH_WARNINGS', () => {
  const v = deriveRiskVerdict({
    findings: [finding('medium')],
    classified: classified({ source: ['a.js'] }),
    checksAvailable: CHECKS_WITH_TEST,
  });
  assert.equal(v.verdict, VERDICT.ALLOW_WITH_WARNINGS,
    'with a test command the INSUFFICIENT gate is skipped and warnings win');
});

// ---- deriveRiskVerdict: checkExecution (slim --run-checks A+B gate) ----------
// `checkExecution` is an ADDITIVE optional param. OMITTED (heavy/legacy callers)
// → behaviour is exactly as the tests above (source+test → ALLOW). PROVIDED
// (slim) → a source change is only a clean pass when checks actually ran AND
// passed: a failed check (A) or unexecuted checks (B) escalate to
// NEEDS_HUMAN_REVIEW. A check failure never standalone-BLOCKs.

const RAN_PASS = { requested: true, ran: true, allPassed: true, failed: [] };
const RAN_FAIL = { requested: true, ran: true, allPassed: false, failed: ['test'] };
const NOT_RUN = { requested: false, ran: false, allPassed: false, failed: [] };

test('deriveRiskVerdict: source + test available + checks NOT run → NEEDS_HUMAN_REVIEW (B floor)', () => {
  const v = deriveRiskVerdict({
    findings: [],
    classified: classified({ source: ['a.js'] }),
    checksAvailable: CHECKS_WITH_TEST,
    checkExecution: NOT_RUN,
  });
  assert.equal(v.verdict, VERDICT.NEEDS_HUMAN_REVIEW);
  assert.equal(v.apply_allowed, false);
  assert.match(v.reason, /not run|--run-checks/i);
});

test('deriveRiskVerdict: source + checks ran and FAILED → NEEDS_HUMAN_REVIEW (A)', () => {
  const v = deriveRiskVerdict({
    findings: [],
    classified: classified({ source: ['a.js'] }),
    checksAvailable: CHECKS_WITH_TEST,
    checkExecution: RAN_FAIL,
  });
  assert.equal(v.verdict, VERDICT.NEEDS_HUMAN_REVIEW);
  assert.equal(v.apply_allowed, false);
  assert.match(v.reason, /failed: test/i);
});

test('deriveRiskVerdict: source + checks ran and PASSED → ALLOW (verified)', () => {
  const v = deriveRiskVerdict({
    findings: [],
    classified: classified({ source: ['a.js'] }),
    checksAvailable: CHECKS_WITH_TEST,
    checkExecution: RAN_PASS,
  });
  assert.equal(v.verdict, VERDICT.ALLOW);
  assert.equal(v.apply_allowed, true);
});

test('deriveRiskVerdict: checkExecution OMITTED preserves legacy ALLOW for source+test (heavy contract)', () => {
  const v = deriveRiskVerdict({
    findings: [],
    classified: classified({ source: ['a.js'] }),
    checksAvailable: CHECKS_WITH_TEST,
    // no checkExecution → unchanged behaviour for the heavy harness + any caller
    // that has not opted into the slim run-checks gate.
  });
  assert.equal(v.verdict, VERDICT.ALLOW);
});

test('deriveRiskVerdict: no test command still wins over checkExecution → INSUFFICIENT_EVIDENCE', () => {
  const v = deriveRiskVerdict({
    findings: [],
    classified: classified({ source: ['a.js'] }),
    checksAvailable: CHECKS_NO_TEST,
    checkExecution: NOT_RUN,
  });
  assert.equal(v.verdict, VERDICT.INSUFFICIENT_EVIDENCE);
});

test('deriveRiskVerdict: critical still BLOCKs regardless of checkExecution', () => {
  const v = deriveRiskVerdict({
    findings: [finding('critical')],
    classified: classified({ source: ['a.js'] }),
    checksAvailable: CHECKS_WITH_TEST,
    checkExecution: RAN_PASS,
  });
  assert.equal(v.verdict, VERDICT.BLOCK);
});

test('deriveRiskVerdict: ran+passed + medium finding → ALLOW_WITH_WARNINGS (verified, warnings remain)', () => {
  const v = deriveRiskVerdict({
    findings: [finding('medium')],
    classified: classified({ source: ['a.js'] }),
    checksAvailable: CHECKS_WITH_TEST,
    checkExecution: RAN_PASS,
  });
  assert.equal(v.verdict, VERDICT.ALLOW_WITH_WARNINGS);
});

test('deriveRiskVerdict: not-run + docs-only change → ALLOW (no source to verify)', () => {
  const v = deriveRiskVerdict({
    findings: [],
    classified: classified({ docs: ['README.md'] }),
    checksAvailable: CHECKS_WITH_TEST,
    checkExecution: NOT_RUN,
  });
  assert.equal(v.verdict, VERDICT.ALLOW);
});

test('deriveRiskVerdict: not-run + source + medium finding → NEEDS_HUMAN_REVIEW (unverified beats warning)', () => {
  // An unverified source change short-circuits to NEEDS_HUMAN_REVIEW BEFORE the
  // medium/low ALLOW_WITH_WARNINGS branch — "not verified" outranks a warning.
  const v = deriveRiskVerdict({
    findings: [finding('medium')],
    classified: classified({ source: ['a.js'] }),
    checksAvailable: CHECKS_WITH_TEST,
    checkExecution: NOT_RUN,
  });
  assert.equal(v.verdict, VERDICT.NEEDS_HUMAN_REVIEW);
});

// ---- classifyChangedFiles -------------------------------------------------

test('classifyChangedFiles: CI workflow yml classifies as ci, NOT config', () => {
  const { ci, config } = classifyChangedFiles({
    files: [{ path: '.github/workflows/ci.yml', binary: false }],
  });
  assert.deepEqual(ci, ['.github/workflows/ci.yml']);
  assert.deepEqual(config, [], 'CI must be checked before the generic config regex');
});

test('classifyChangedFiles: generic .yml outside CI is config', () => {
  const { config, ci } = classifyChangedFiles({
    files: [{ path: 'config/app.yml', binary: false }],
  });
  assert.deepEqual(config, ['config/app.yml']);
  assert.deepEqual(ci, []);
});

test('classifyChangedFiles: binary file → binary bucket, never source', () => {
  const c = classifyChangedFiles({
    files: [{ path: 'assets/logo.png', binary: true }],
  });
  assert.deepEqual(c.binary, ['assets/logo.png']);
  assert.deepEqual(c.source, [], 'binary must not count as source (else false INSUFFICIENT_EVIDENCE)');
});

test('classifyChangedFiles: tests / docs / source buckets', () => {
  const c = classifyChangedFiles({
    files: [
      { path: 'src/index.js', binary: false },
      { path: 'src/index.test.js', binary: false },
      { path: 'tests/helper.js', binary: false },
      { path: 'README.md', binary: false },
      { path: 'docs/guide.rst', binary: false },
    ],
  });
  assert.deepEqual(c.source, ['src/index.js']);
  assert.deepEqual(c.tests, ['src/index.test.js', 'tests/helper.js']);
  assert.deepEqual(c.docs, ['README.md', 'docs/guide.rst']);
});

test('classifyChangedFiles: empty diff → all buckets empty', () => {
  const c = classifyChangedFiles({ files: [] });
  assert.deepEqual(c, { source: [], tests: [], docs: [], config: [], ci: [], binary: [] });
});

// ---- inputSourceForMode ---------------------------------------------------

test('inputSourceForMode: maps each diff mode to its canonical input_source', () => {
  assert.equal(inputSourceForMode('staged'), 'staged');
  assert.equal(inputSourceForMode('range'), 'range');
  assert.equal(inputSourceForMode('patch'), 'patch');
  assert.equal(inputSourceForMode('full'), 'full_scan');
  assert.equal(inputSourceForMode('working'), 'working_tree');
});

test('inputSourceForMode: unknown / undefined mode falls back to working_tree', () => {
  assert.equal(inputSourceForMode('something-else'), 'working_tree');
  assert.equal(inputSourceForMode(undefined), 'working_tree');
});
