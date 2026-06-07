// verify-pr slim: verdict derivation + arg-parser bounds tests
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseVerifyPrArgs, VERDICT, EXIT_CODE, verifyPrCycle } from '../../scripts/orchestrators/verify-pr.js';

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr || ''}`);
  return r.stdout;
}

function makeRepo(seedFiles = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-vpr-'));
  git(cwd, ['init', '-q']);
  git(cwd, ['config', 'user.email', 'test@test.local']);
  git(cwd, ['config', 'user.name', 'test']);
  git(cwd, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(cwd, 'README.md'), '# base\n');
  git(cwd, ['add', 'README.md']);
  git(cwd, ['commit', '-qm', 'baseline']);
  for (const [rel, content] of Object.entries(seedFiles)) {
    const full = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return cwd;
}

// --- EXIT_CODE mapping ---
test('EXIT_CODE: ALLOW and ALLOW_WITH_WARNINGS exit 0', () => {
  assert.equal(EXIT_CODE[VERDICT.ALLOW], 0);
  assert.equal(EXIT_CODE[VERDICT.ALLOW_WITH_WARNINGS], 0);
});

test('EXIT_CODE: NEEDS_HUMAN_REVIEW and INSUFFICIENT_EVIDENCE exit 1', () => {
  assert.equal(EXIT_CODE[VERDICT.NEEDS_HUMAN_REVIEW], 1);
  assert.equal(EXIT_CODE[VERDICT.INSUFFICIENT_EVIDENCE], 1);
});

test('EXIT_CODE: BLOCK exits 2', () => {
  assert.equal(EXIT_CODE[VERDICT.BLOCK], 2);
});

// --- parseVerifyPrArgs defaults ---
test('parseVerifyPrArgs: empty args → working mode, write=true, json=false', () => {
  const opts = parseVerifyPrArgs([]);
  assert.equal(opts.mode, 'working');
  assert.equal(opts.write, true);
  assert.equal(opts.json, false);
});

test('parseVerifyPrArgs: --from-patch sets patch mode + patchPath', () => {
  const opts = parseVerifyPrArgs(['--from-patch', 'some/file.patch']);
  assert.equal(opts.mode, 'patch');
  assert.equal(opts.patchPath, 'some/file.patch');
});

test('parseVerifyPrArgs: --range sets range mode + range value', () => {
  const opts = parseVerifyPrArgs(['--range', 'main...HEAD']);
  assert.equal(opts.mode, 'range');
  assert.equal(opts.range, 'main...HEAD');
});

test('parseVerifyPrArgs: --full-scan sets full mode', () => {
  const opts = parseVerifyPrArgs(['--full-scan']);
  assert.equal(opts.mode, 'full');
});

test('parseVerifyPrArgs: --no-write and --json toggle flags', () => {
  const opts = parseVerifyPrArgs(['--no-write', '--json']);
  assert.equal(opts.write, false);
  assert.equal(opts.json, true);
});

test('parseVerifyPrArgs: --from-patch as last arg throws bounds error', () => {
  assert.throws(
    () => parseVerifyPrArgs(['--from-patch']),
    /requires a value/i
  );
});

test('parseVerifyPrArgs: --range as last arg throws bounds error', () => {
  assert.throws(
    () => parseVerifyPrArgs(['--range']),
    /requires a value/i
  );
});

test('parseVerifyPrArgs: --comment-file as last arg throws bounds error', () => {
  assert.throws(
    () => parseVerifyPrArgs(['--comment-file']),
    /requires a value/i
  );
});

test('parseVerifyPrArgs: --project-root as last arg throws bounds error', () => {
  assert.throws(
    () => parseVerifyPrArgs(['--project-root']),
    /requires a value/i
  );
});

test('parseVerifyPrArgs: --include as last arg throws bounds error', () => {
  assert.throws(
    () => parseVerifyPrArgs(['--include']),
    /requires a value/i
  );
});

test('parseVerifyPrArgs: --include accumulates multiple values', () => {
  const opts = parseVerifyPrArgs(['--include', 'src/', '--include', 'lib/']);
  assert.deepEqual(opts.includePaths, ['src/', 'lib/']);
});

// --- Fix 4: verifyPrCycle returns a defined `evidence` field (documented --json shape) ---
test('verifyPrCycle: result has a defined evidence summary (write mode)', async () => {
  const cwd = makeRepo({ 'src/app.js': 'export const x = 1;\n' });
  try {
    const result = await verifyPrCycle({ projectRoot: cwd, mode: 'working' });
    assert.notEqual(result.evidence, undefined, 'evidence must be defined');
    assert.ok(result.evidence, 'evidence should be a truthy summary object');
    // input_source reflects the real mode
    assert.equal(result.evidence.input_source, 'working_tree');
    // artifact paths are surfaced
    assert.ok(Array.isArray(result.evidence.artifacts));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('verifyPrCycle: evidence is defined even with --no-write', async () => {
  const cwd = makeRepo({ 'src/app.js': 'export const x = 1;\n' });
  try {
    const result = await verifyPrCycle({ projectRoot: cwd, mode: 'working', write: false });
    assert.notEqual(result.evidence, undefined, 'evidence must be defined even without write');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// --- Fix 5: verifyPrCycle computes exitCode honoring --ci-exit-soft ---
test('verifyPrCycle: exitCode honors ciExitSoft for INSUFFICIENT_EVIDENCE', async () => {
  // source-only change in a project with no test command → INSUFFICIENT_EVIDENCE (exit 1)
  const cwd = makeRepo({ 'src/app.js': 'export const x = 1;\n' });
  try {
    const hard = await verifyPrCycle({ projectRoot: cwd, mode: 'working' });
    if (hard.decision.verdict === VERDICT.INSUFFICIENT_EVIDENCE) {
      assert.equal(hard.exitCode, 1, 'hard exit should be 1');
      const soft = await verifyPrCycle({ projectRoot: cwd, mode: 'working', ciExitSoft: true });
      assert.equal(soft.exitCode, 0, 'ciExitSoft should soften to 0');
    }
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// --- Fix 6: evidence-manifest input_source reflects the real mode ---
test('verifyPrCycle: input_source = staged for --from-staged mode', async () => {
  const cwd = makeRepo({ 'src/app.js': 'export const x = 1;\n' });
  try {
    git(cwd, ['add', 'src/app.js']);
    const result = await verifyPrCycle({ projectRoot: cwd, mode: 'staged' });
    assert.equal(result.evidence.input_source, 'staged');
    // and the written manifest matches
    const manifest = JSON.parse(fs.readFileSync(path.join(cwd, '.nekowork', 'evidence', 'evidence-manifest.json'), 'utf8'));
    assert.equal(manifest.input_source, 'staged');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// --- Fix 2: .github/workflows/*.yml classifies as ci, not config ---
test('verifyPrCycle: .github/workflows/*.yml classifies as ci', async () => {
  const cwd = makeRepo({ '.github/workflows/build.yml': 'name: build\non: push\n' });
  try {
    const result = await verifyPrCycle({ projectRoot: cwd, mode: 'working' });
    const cf = result.decision.changed_files;
    assert.ok(cf.ci.includes('.github/workflows/build.yml'), 'workflow yml should be ci');
    assert.ok(!cf.config.includes('.github/workflows/build.yml'), 'workflow yml should NOT be config');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// --- R2-13: risk_level NONE when there are zero findings ---
test('verifyPrCycle: risk_level is NONE for zero findings', async () => {
  // docs-only change, nothing flagged → ALLOW with risk_level NONE (distinct
  // from LOW which means "low-severity findings present").
  const cwd = makeRepo();
  try {
    fs.writeFileSync(path.join(cwd, 'GUIDE.md'), '# guide\nsome docs\n');
    const result = await verifyPrCycle({ projectRoot: cwd, mode: 'working' });
    assert.equal(result.decision.finding_counts.critical + result.decision.finding_counts.high + result.decision.finding_counts.medium + result.decision.finding_counts.low, 0);
    assert.equal(result.decision.risk_level, 'NONE');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// --- R2-14: binary files get their own bucket, not 'source' ---
test('verifyPrCycle: binary files classify as binary, not source', async () => {
  const cwd = makeRepo();
  try {
    // Commit a binary file first, then modify it so `git diff` emits the
    // "Binary files ... differ" marker (parseDiff sets f.binary=true). An
    // untracked binary would be synthesized as text, so it must be tracked.
    fs.writeFileSync(path.join(cwd, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03]));
    git(cwd, ['add', 'logo.png']);
    git(cwd, ['commit', '-qm', 'add binary']);
    fs.writeFileSync(path.join(cwd, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xfe, 0xfd, 0xfc]));
    const result = await verifyPrCycle({ projectRoot: cwd, mode: 'working' });
    const cf = result.decision.changed_files;
    assert.ok(Array.isArray(cf.binary), 'binary bucket exists');
    assert.ok(cf.binary.includes('logo.png'), `logo.png should be binary, got ${JSON.stringify(cf)}`);
    assert.ok(!cf.source.includes('logo.png'), 'binary file must not be source');
    // binary-only change must NOT be treated as a source change needing tests
    assert.notEqual(result.decision.verdict, VERDICT.INSUFFICIENT_EVIDENCE);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// --- R2-15: classifyChangedFiles called once; verdict + decision use same classification ---
test('verifyPrCycle: verdict and decision agree on classification (single source of truth)', async () => {
  const cwd = makeRepo({ 'src/app.js': 'export const x = 1;\n' });
  try {
    const result = await verifyPrCycle({ projectRoot: cwd, mode: 'working' });
    // The decision.changed_files is the classification used for the verdict too.
    assert.ok(result.decision.changed_files.source.includes('src/app.js'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// --- R2-17: ALLOW report states scope ("not an exhaustive audit") ---
test('verifyPrCycle: ALLOW report contains the scope disclaimer', async () => {
  const cwd = makeRepo();
  try {
    fs.writeFileSync(path.join(cwd, 'GUIDE.md'), '# guide\nplain docs\n');
    const result = await verifyPrCycle({ projectRoot: cwd, mode: 'working' });
    assert.ok([VERDICT.ALLOW, VERDICT.ALLOW_WITH_WARNINGS].includes(result.decision.verdict),
      `expected ALLOW-ish verdict, got ${result.decision.verdict}`);
    const report = fs.readFileSync(path.join(cwd, 'REPORT.md'), 'utf8');
    assert.match(report, /## Scope/);
    assert.match(report, /NOT an exhaustive security audit/i);
    assert.match(report, /deterministic rules scanned/i);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
