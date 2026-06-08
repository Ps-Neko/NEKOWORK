// verify-pr END-TO-END integration: drive verifyPrCycle() through all five
// verdicts and assert both decision.verdict AND exitCode.
//
// Patch mode (mode:'patch') feeds synthetic .patch files so no real git history
// is needed, and write:false keeps every run from touching the repo working
// tree. detectProject() still runs against a temp projectRoot, so test-command
// availability (which flips ALLOW ↔ INSUFFICIENT_EVIDENCE) is controlled by what
// we seed into that root.
//
// The one verdict path that needs a real git repo is the self-output exclusion
// assertion: dropSelfOutput() lives in getGitDiff (working/full mode), not in
// the patch-mode loadDiffFile path. So that case uses a throwaway git repo.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyPrCycle, VERDICT } from '../../scripts/orchestrators/verify-pr.js';
import { newFilePatch, multiFilePatch, writePatchFile, makeProjectRoot, PKG_WITH_CHECKS } from '../helpers/patch.js';
import { rmrf } from '../helpers/tmp.js';

// package.json fixtures whose `npm test` is deterministic and dependency-free.
const PKG_TEST_PASS = JSON.stringify({ name: 'fx', version: '0.0.0', scripts: { test: 'node -e "process.exit(0)"' } });
const PKG_TEST_FAIL = JSON.stringify({ name: 'fx', version: '0.0.0', scripts: { test: 'node -e "process.exit(1)"' } });

// Run verifyPrCycle in patch mode against a fresh temp projectRoot + patch file.
// Always write:false. Cleans up both temp dirs before returning.
async function runPatch({ patch, projectFiles = {}, opts = {} }) {
  const root = makeProjectRoot(projectFiles);
  const { path: patchPath, dir: patchDir } = writePatchFile(patch);
  try {
    return await verifyPrCycle({ projectRoot: root, mode: 'patch', patchPath, write: false, ...opts });
  } finally {
    rmrf(root);
    rmrf(patchDir);
  }
}

// ── ALLOW: clean benign docs-only diff ──────────────────────────────────────
test('verifyPrCycle: clean docs-only diff → ALLOW, exit 0', async () => {
  const res = await runPatch({
    patch: newFilePatch('docs/guide.md', ['# Guide', '', 'Some helpful documentation.']),
  });
  assert.equal(res.decision.verdict, VERDICT.ALLOW);
  assert.equal(res.exitCode, 0);
  assert.equal(res.findings.length, 0, 'benign docs change should have no findings');
});

// ── source change WITHOUT --run-checks: not verified → NEEDS_HUMAN_REVIEW (B) ─
// The slim gate no longer hands out a clean ALLOW for an UNVERIFIED source change
// just because a test command exists. Without --run-checks the change was never
// actually run, so it is "not verified", not a pass.
test('verifyPrCycle: source change, test available, NO --run-checks → NEEDS_HUMAN_REVIEW, exit 1', async () => {
  const res = await runPatch({
    projectFiles: { 'package.json': PKG_WITH_CHECKS },
    patch: newFilePatch('src/util.js', ['// adds a pure helper', 'export const add = (a, b) => a + b;']),
  });
  assert.equal(res.decision.verdict, VERDICT.NEEDS_HUMAN_REVIEW);
  assert.equal(res.exitCode, 1);
  assert.match(res.decision.reason, /not run|--run-checks/i);
});

// ── source change WITH --run-checks, tests PASS → ALLOW (verified) ───────────
test('verifyPrCycle: source change + --run-checks (tests pass) → ALLOW, exit 0', async () => {
  const res = await runPatch({
    projectFiles: { 'package.json': PKG_TEST_PASS },
    patch: newFilePatch('src/util.js', ['export const add = (a, b) => a + b;']),
    opts: { runChecks: true },
  });
  assert.equal(res.decision.verdict, VERDICT.ALLOW, `reason=${res.decision.reason}`);
  assert.equal(res.exitCode, 0);
  assert.equal(res.decision.checks.requested, true);
  assert.ok(res.decision.checks.results.some((c) => c.name === 'test' && c.status === 'pass'),
    `expected a passing test check, got ${JSON.stringify(res.decision.checks.results)}`);
});

// ── source change WITH --run-checks, tests FAIL → NEEDS_HUMAN_REVIEW ─────────
test('verifyPrCycle: source change + --run-checks (tests fail) → NEEDS_HUMAN_REVIEW, exit 1', async () => {
  const res = await runPatch({
    projectFiles: { 'package.json': PKG_TEST_FAIL },
    patch: newFilePatch('src/util.js', ['export const add = (a, b) => a + b;']),
    opts: { runChecks: true },
  });
  assert.equal(res.decision.verdict, VERDICT.NEEDS_HUMAN_REVIEW);
  assert.equal(res.exitCode, 1);
  assert.match(res.decision.reason, /failed: test/i);
});

// ── --run-checks is SKIPPED when the diff itself tampers with the run surface ─
// A diff that disables a test/security gate must not get its (attacker-modified)
// commands executed — checks are skipped, so the source change stays unverified.
// `// @ts-ignore` is a test-or-security-disable finding (see the medium-finding
// case above), which checksBlockedByRisk treats as "do not execute".
test('verifyPrCycle: --run-checks skips execution when the diff disables a gate', async () => {
  const res = await runPatch({
    projectFiles: { 'package.json': PKG_TEST_PASS },
    patch: newFilePatch('src/widget.js', ['var x = makeWidget(); // @ts-ignore', 'render(x);']),
    opts: { runChecks: true },
  });
  assert.equal(res.decision.checks.requested, true);
  assert.ok(res.decision.checks.skippedReason, 'execution must be skipped for a tamper diff');
  assert.equal(res.decision.checks.results.length, 0, 'no checks should have run');
});

// ── source change with a security-disable (medium) finding → NEEDS_HUMAN_REVIEW
// `// @ts-ignore` is a MEDIUM test-or-security-disable finding. Non-blocking on
// its own, but the slim gate no longer ALLOWs an unverified source change, and
// the finding also marks the diff as tamper-risky so --run-checks refuses to
// execute the (possibly modified) commands — the change stays NEEDS_HUMAN_REVIEW.
// (The ALLOW_WITH_WARNINGS verdict branch itself is unit-tested in
// verify-helpers.test.js, both with and without checkExecution.)
test('verifyPrCycle: source + medium security-disable finding → NEEDS_HUMAN_REVIEW, exit 1', async () => {
  const res = await runPatch({
    projectFiles: { 'package.json': PKG_WITH_CHECKS },
    patch: newFilePatch('src/widget.js', ['var x = makeWidget(); // @ts-ignore', 'render(x);']),
  });
  assert.equal(res.decision.verdict, VERDICT.NEEDS_HUMAN_REVIEW);
  assert.equal(res.exitCode, 1);
  const sev = res.findings.map((f) => f.severity);
  assert.ok(sev.includes('medium'), `expected a medium finding, got: ${sev.join(',')}`);
  assert.ok(!sev.includes('critical') && !sev.includes('high'), 'no blocking/high finding expected');
});

// ── BLOCK: critical finding ─────────────────────────────────────────────────
test('verifyPrCycle: hardcoded AWS access key → BLOCK, non-zero exit', async () => {
  const res = await runPatch({
    patch: newFilePatch('src/config.js', ['const key = "AKIAIOSFODNN7EXAMPLE";', 'export default key;']),
  });
  assert.equal(res.decision.verdict, VERDICT.BLOCK);
  assert.equal(res.exitCode, 2);
  assert.notEqual(res.exitCode, 0, 'BLOCK must be non-zero');
  assert.equal(res.decision.apply_allowed, false);
  assert.equal(res.decision.merge_allowed, false);
  const critical = res.findings.filter((f) => f.severity === 'critical');
  assert.ok(critical.length >= 1, 'expected a critical finding');
  assert.ok(critical.some((f) => f.blocks_apply === true), 'critical finding must block apply');
});

test('verifyPrCycle: child_process git push → BLOCK, non-zero exit', async () => {
  const res = await runPatch({
    patch: newFilePatch('scripts/deploy.js', [
      "import { execSync } from 'node:child_process';",
      "execSync('git', ['push', 'origin', 'main']);",
    ]),
  });
  assert.equal(res.decision.verdict, VERDICT.BLOCK);
  assert.equal(res.exitCode, 2);
  assert.ok(res.findings.some((f) => f.severity === 'critical'), 'subprocess git push is critical');
});

// ── NEEDS_HUMAN_REVIEW: a HIGH-severity (non-critical) finding ───────────────
test('verifyPrCycle: HIGH-severity finding (TLS verification disabled) → NEEDS_HUMAN_REVIEW, exit 1', async () => {
  const res = await runPatch({
    patch: newFilePatch('src/client.js', ['const agent = new https.Agent({ rejectUnauthorized: false });']),
  });
  assert.equal(res.decision.verdict, VERDICT.NEEDS_HUMAN_REVIEW);
  assert.equal(res.exitCode, 1);
  assert.equal(res.decision.apply_allowed, false);
  const sev = res.findings.map((f) => f.severity);
  assert.ok(sev.includes('high'), `expected a high finding, got: ${sev.join(',')}`);
  assert.ok(!sev.includes('critical'), 'must not be critical (that would be BLOCK)');
});

// ── INSUFFICIENT_EVIDENCE: source-only change, no test/lint/typecheck ────────
test('verifyPrCycle: source-only change in project with no test command → INSUFFICIENT_EVIDENCE, exit 1', async () => {
  // No package.json in projectRoot → detectProject reports hasTests=false.
  const res = await runPatch({
    patch: newFilePatch('src/feature.js', ['export function feature() {', '  return 42;', '}']),
  });
  assert.equal(res.decision.verdict, VERDICT.INSUFFICIENT_EVIDENCE);
  assert.equal(res.exitCode, 1);
  assert.equal(res.decision.project.checks_available.test, false, 'precondition: no test command');
});

test('verifyPrCycle: --ci-exit-soft softens INSUFFICIENT_EVIDENCE exit to 0 while hard mode stays non-zero', async () => {
  const patch = newFilePatch('src/feature.js', ['export const n = 7;']);
  const hard = await runPatch({ patch });
  assert.equal(hard.decision.verdict, VERDICT.INSUFFICIENT_EVIDENCE);
  assert.equal(hard.exitCode, 1, 'hard mode is non-zero for INSUFFICIENT_EVIDENCE');

  const soft = await runPatch({ patch, opts: { ciExitSoft: true } });
  assert.equal(soft.decision.verdict, VERDICT.INSUFFICIENT_EVIDENCE, 'verdict is unchanged by soft exit');
  assert.equal(soft.exitCode, 0, 'ci-exit-soft turns the exit code to 0');
});

// ── self-output exclusion (needs a real git repo for getGitDiff/dropSelfOutput)
test('verifyPrCycle: working-tree scan excludes .nekowork/** and REPORT.md, scans only the real file', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-vpr-self-'));
  const git = (args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr || ''}`);
    return r.stdout;
  };
  try {
    git(['init', '-q']);
    git(['config', 'user.email', 'test@test.local']);
    git(['config', 'user.name', 'test']);
    git(['config', 'commit.gpgsign', 'false']);
    fs.writeFileSync(path.join(cwd, 'README.md'), '# base\n');
    git(['add', 'README.md']);
    git(['commit', '-qm', 'baseline']);

    // one real (untracked) source file + the tool's own prior output
    fs.writeFileSync(path.join(cwd, 'real.js'), 'export const ok = 1;\n');
    fs.mkdirSync(path.join(cwd, '.nekowork', 'evidence'), { recursive: true });
    // self-output deliberately contains a critical-looking secret; if it were
    // scanned it would force a FALSE BLOCK (self-contamination).
    fs.writeFileSync(path.join(cwd, '.nekowork', 'evidence', 'x.json'), '{"leaked":"AKIAIOSFODNN7EXAMPLE"}\n');
    fs.writeFileSync(path.join(cwd, 'REPORT.md'), '# prior report\nAKIAIOSFODNN7EXAMPLE\n');

    const res = await verifyPrCycle({ projectRoot: cwd, mode: 'working', write: false });
    const scanned = (res.parsedDiff.files || []).map((f) => f.path).sort();
    assert.deepEqual(scanned, ['real.js'], 'only the real file is scanned');
    assert.ok(!scanned.some((p) => p.startsWith('.nekowork/')), '.nekowork/** excluded');
    assert.ok(!scanned.includes('REPORT.md'), 'REPORT.md excluded');
    // and the self-output secret did NOT contaminate the verdict into BLOCK
    assert.notEqual(res.decision.verdict, VERDICT.BLOCK, 'self-output secret must not force a BLOCK');
  } finally {
    rmrf(cwd);
  }
});

// ── evidence field is present on the returned object ─────────────────────────
test('verifyPrCycle: returned object always exposes an evidence summary (no-write)', async () => {
  const res = await runPatch({
    patch: newFilePatch('docs/notes.md', ['# notes']),
  });
  assert.notEqual(res.evidence, undefined, 'evidence must be defined');
  assert.ok(res.evidence, 'evidence is a truthy object');
  assert.equal(res.evidence.input_source, 'patch', 'patch mode reports input_source=patch');
  assert.equal(res.evidence.written, false, 'no-write run reports written=false');
  assert.ok(Array.isArray(res.evidence.artifacts), 'artifacts is an array');
});

// ── multi-file: a benign file alongside a critical one still BLOCKs ──────────
test('verifyPrCycle: critical finding in one of several files → BLOCK', async () => {
  const res = await runPatch({
    patch: multiFilePatch([
      { file: 'docs/readme.md', lines: ['# safe'] },
      { file: 'src/secrets.js', lines: ['const t = "AKIAIOSFODNN7EXAMPLE";'] },
    ]),
  });
  assert.equal(res.decision.verdict, VERDICT.BLOCK);
  assert.equal(res.exitCode, 2);
});
