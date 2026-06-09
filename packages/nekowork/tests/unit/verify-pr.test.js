// verify-pr slim: verdict derivation + arg-parser bounds tests
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseVerifyPrArgs, VERDICT, EXIT_CODE, verifyPrCycle } from '../../scripts/orchestrators/verify-pr.js';

const CLI = fileURLToPath(new URL('../../scripts/cli.js', import.meta.url));

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

// --- parseVerifyPrArgs: reject unknown options (no silent fall-through) ---
// An unrecognized flag must FAIL LOUDLY, never be silently ignored. A typo like
// `--rang main...HEAD` previously fell through to the working-tree default, so a
// CI invocation that thought it was scanning a PR range would scan the wrong diff.
test('parseVerifyPrArgs: unknown --flag throws (no silent ignore)', () => {
  assert.throws(
    () => parseVerifyPrArgs(['--rang', 'origin/main...HEAD']),
    /unknown verify-pr option: --rang/i
  );
});

test('parseVerifyPrArgs: bare unknown token throws (no positional args)', () => {
  assert.throws(
    () => parseVerifyPrArgs(['bogus']),
    /unknown verify-pr option: bogus/i
  );
});

test('parseVerifyPrArgs: a typo does NOT silently degrade to working mode', () => {
  // The exact bug: --rang is ignored, mode stays 'working'. Must throw instead.
  assert.throws(() => parseVerifyPrArgs(['--rang', 'main...HEAD']), /unknown/i);
});

// --- parseVerifyPrArgs: --flag=value (equals) form for every value-taking flag ---
test('parseVerifyPrArgs: --range=value (equals form) sets range mode + value', () => {
  const opts = parseVerifyPrArgs(['--range=origin/main...HEAD']);
  assert.equal(opts.mode, 'range');
  assert.equal(opts.range, 'origin/main...HEAD');
});

test('parseVerifyPrArgs: --from-patch=value (equals form) sets patch mode + path', () => {
  const opts = parseVerifyPrArgs(['--from-patch=diff.patch']);
  assert.equal(opts.mode, 'patch');
  assert.equal(opts.patchPath, 'diff.patch');
});

test('parseVerifyPrArgs: --project-root=value and --comment-file=value (equals form)', () => {
  const opts = parseVerifyPrArgs(['--project-root=.', '--comment-file=.nekowork/pr-comment.md']);
  assert.equal(opts.projectRoot, '.');
  assert.equal(opts.commentFile, '.nekowork/pr-comment.md');
});

test('parseVerifyPrArgs: --include=value (equals form) accumulates', () => {
  const opts = parseVerifyPrArgs(['--include=src/', '--include', 'lib/']);
  assert.deepEqual(opts.includePaths, ['src/', 'lib/']);
});

test('parseVerifyPrArgs: equals form keeps a value that itself contains "="', () => {
  // Only the FIRST '=' splits flag from value, so a value with '=' survives.
  const opts = parseVerifyPrArgs(['--range=a=b...c']);
  assert.equal(opts.mode, 'range');
  assert.equal(opts.range, 'a=b...c');
});

test('parseVerifyPrArgs: --range= with empty value still consumed (downstream validates)', () => {
  // `--range=` is degenerate but must not be treated as an unknown option.
  const opts = parseVerifyPrArgs(['--range=']);
  assert.equal(opts.mode, 'range');
  assert.equal(opts.range, '');
});

// --- CLI surface: an unknown option fails cleanly (exit 2, no JS stack trace) ---
// parseVerifyPrArgs throws; cli.js must catch it and print a one-line usage error
// rather than crashing with a raw stack trace.
test('CLI verify-pr: unknown option exits 2 with a clean message (no stack trace)', () => {
  const cwd = makeRepo({ 'src/app.js': 'export const x = 1;\n' });
  try {
    const r = spawnSync(process.execPath, [CLI, 'verify-pr', '--rang', 'main...HEAD'], {
      cwd, encoding: 'utf8', windowsHide: true,
    });
    assert.equal(r.status, 2, `expected usage exit 2, got ${r.status}; stderr=${r.stderr}`);
    assert.match(r.stderr, /unknown verify-pr option: --rang/i);
    assert.doesNotMatch(r.stderr, /\n\s+at /, 'must not leak a JS stack trace');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
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

// --- FIX 2 (GPT P1): evidence chain includes the raw diff + its hash + rule version ---
test('verifyPrCycle: writes diff.patch (non-empty) for a normal scan', async () => {
  const cwd = makeRepo({ 'src/app.js': 'export const x = 1;\n' });
  try {
    await verifyPrCycle({ projectRoot: cwd, mode: 'working' });
    const patchPath = path.join(cwd, '.nekowork', 'evidence', 'diff.patch');
    assert.ok(fs.existsSync(patchPath), 'diff.patch must be written');
    const patch = fs.readFileSync(patchPath, 'utf8');
    assert.ok(patch.length > 0, 'diff.patch must be non-empty');
    // The raw patch is the text the parser saw — it should reference the scanned file.
    assert.match(patch, /src\/app\.js/, 'diff.patch should contain the scanned file path');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('verifyPrCycle: diff.sha256 equals the sha256 of diff.patch content', async () => {
  const cwd = makeRepo({ 'src/app.js': 'export const x = 1;\n' });
  try {
    await verifyPrCycle({ projectRoot: cwd, mode: 'working' });
    const evidenceDir = path.join(cwd, '.nekowork', 'evidence');
    const patch = fs.readFileSync(path.join(evidenceDir, 'diff.patch'), 'utf8');
    const sha = fs.readFileSync(path.join(evidenceDir, 'diff.sha256'), 'utf8').trim();
    const expected = crypto.createHash('sha256').update(patch, 'utf8').digest('hex');
    assert.equal(sha, expected, 'diff.sha256 must equal sha256(diff.patch)');
    assert.match(sha, /^[0-9a-f]{64}$/, 'sha256 is 64 lowercase hex chars');
    // and the manifest records the same hash for cross-reference
    const manifest = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'evidence-manifest.json'), 'utf8'));
    assert.equal(manifest.diff_sha256, expected, 'manifest diff_sha256 matches');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('verifyPrCycle: rule-version.json has engine_version, rule_count===11, and rules array', async () => {
  const cwd = makeRepo({ 'src/app.js': 'export const x = 1;\n' });
  try {
    await verifyPrCycle({ projectRoot: cwd, mode: 'working' });
    const rv = JSON.parse(fs.readFileSync(path.join(cwd, '.nekowork', 'evidence', 'rule-version.json'), 'utf8'));
    assert.ok(typeof rv.engine_version === 'string' && rv.engine_version.length > 0, 'engine_version present');
    assert.equal(rv.rule_count, 11, 'rule_count is 11');
    assert.ok(Array.isArray(rv.rules), 'rules is an array');
    assert.equal(rv.rules.length, 11, 'rules lists all 11 rule units');
    assert.ok(rv.rules.includes('secret-fallback') && rv.rules.includes('ast-dataflow'), 'rules contains known rule ids');
    assert.ok(typeof rv.generated_at === 'string', 'generated_at present (the only non-deterministic field)');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('verifyPrCycle: evidence summary artifacts include the three new files', async () => {
  const cwd = makeRepo({ 'src/app.js': 'export const x = 1;\n' });
  try {
    const res = await verifyPrCycle({ projectRoot: cwd, mode: 'working' });
    const names = res.evidence.artifacts.map((a) => a.name);
    assert.ok(names.includes('diff.patch'), 'diff.patch in artifacts');
    assert.ok(names.includes('diff.sha256'), 'diff.sha256 in artifacts');
    assert.ok(names.includes('rule-version.json'), 'rule-version.json in artifacts');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
