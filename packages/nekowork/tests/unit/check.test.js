// scripts/check.js — slim environment probe, the FIRST command a new user runs.
// Driven end-to-end through the CLI subprocess (`node scripts/cli.js check --json`)
// in controlled CWDs, since check.js's git probes use the process CWD (no -C) and
// its functions are not separately exported. The `check` verb in cli.js forwards
// argv to check.js via stdio:'inherit' and re-exits with check.js's status, so
// the parent spawnSync captures both the JSON stdout and the worst-rank exit code.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'cli.js');

function run(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', windowsHide: true });
}

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed:\n${r.stderr || r.stdout}`);
}

function makeGitRepoWithCommit() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-check-git-'));
  git(['init', '-q'], root);
  git(['config', 'user.email', 'test@test.local'], root);
  git(['config', 'user.name', 'test'], root);
  git(['config', 'commit.gpgsign', 'false'], root);
  fs.writeFileSync(path.join(root, 'base.txt'), 'base\n');
  git(['add', 'base.txt'], root);
  git(['commit', '-qm', 'baseline'], root);
  return root;
}

function makeNonGitDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'harness-check-nogit-'));
}

// (a) inside a fresh git repo with a commit: the four hard gates PASS. With a
// CLEAN working tree, git-diff WARNs ("no working-tree diff"), which rolls the
// overall up to WARN (exit 1) — that is the intended slim contract: the env is
// ready but verify-pr would have nothing to scan. No FAIL anywhere.
test('check --json: a git repo with a commit but clean tree → all gates PASS, git-diff WARN, overall WARN/exit 1', () => {
  const root = makeGitRepoWithCommit();
  try {
    const r = run(['check', '--json'], root);
    assert.equal(r.status, 1, `clean tree → WARN rolls up to exit 1. stdout: ${r.stdout}\nstderr: ${r.stderr}`);
    const j = JSON.parse(r.stdout);
    assert.equal(j.overall, 'WARN');

    const byName = Object.fromEntries(j.checks.map(c => [c.name, c.status]));
    assert.equal(byName['node-version'], 'PASS', 'node>=22 should PASS (test runner needs it)');
    assert.equal(byName['git-binary'], 'PASS');
    assert.equal(byName['git-repo'], 'PASS');
    assert.equal(byName['git-has-commit'], 'PASS');
    assert.equal(byName['git-diff'], 'WARN', 'clean tree → no diff → WARN');
    // No check FAILs in a healthy repo.
    assert.ok(j.checks.every(c => c.status !== 'FAIL'), 'no FAIL checks in a healthy repo');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// (a') A modified file makes git-diff PASS, so the whole rollup stays PASS.
test('check --json: a working-tree change makes git-diff PASS and overall PASS', () => {
  const root = makeGitRepoWithCommit();
  try {
    fs.writeFileSync(path.join(root, 'base.txt'), 'changed\n');
    const r = run(['check', '--json'], root);
    assert.equal(r.status, 0, `exit should be 0. stdout: ${r.stdout}\nstderr: ${r.stderr}`);
    const j = JSON.parse(r.stdout);
    assert.equal(j.overall, 'PASS');
    const diff = j.checks.find(c => c.name === 'git-diff');
    assert.equal(diff.status, 'PASS');
    assert.match(diff.detail, /changes detected/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// (a'') An UNTRACKED new file makes git-diff PASS — verify-pr scans untracked
// files (synthesizeUntrackedDiff), so `check` must not report "no diff" while
// verify-pr would BLOCK on a critical in that file. Regression test for the
// misleading false-negative where plain `git diff` (no untracked) drove check.
test('check --json: an UNTRACKED new file makes git-diff PASS (matches verify-pr scope)', () => {
  const root = makeGitRepoWithCommit();
  try {
    fs.writeFileSync(path.join(root, 'newfile.js'), 'const x = 1\n');
    const r = run(['check', '--json'], root);
    assert.equal(r.status, 0, `untracked file → PASS, exit 0. stdout: ${r.stdout}\nstderr: ${r.stderr}`);
    const j = JSON.parse(r.stdout);
    assert.equal(j.overall, 'PASS');
    const diff = j.checks.find(c => c.name === 'git-diff');
    assert.equal(diff.status, 'PASS', 'untracked file is a working-tree change verify-pr would scan');
    assert.match(diff.detail, /changes detected/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// (a''') nekowork's OWN output (.nekowork/, REPORT.md) does NOT count as a change:
// it mirrors verify-pr's isSelfOutput exclusion, so a repo whose only "changes"
// are tool artifacts still WARNs "no changes to scan" (not a false PASS).
test('check --json: only self-output (.nekowork/, REPORT.md) present → git-diff WARN (excluded)', () => {
  const root = makeGitRepoWithCommit();
  try {
    fs.mkdirSync(path.join(root, '.nekowork'), { recursive: true });
    fs.writeFileSync(path.join(root, '.nekowork', 'decision.json'), '{}\n');
    fs.writeFileSync(path.join(root, 'REPORT.md'), '# evidence\n');
    const r = run(['check', '--json'], root);
    assert.equal(r.status, 1, `self-output only → WARN rolls up to exit 1. stdout: ${r.stdout}`);
    const j = JSON.parse(r.stdout);
    const diff = j.checks.find(c => c.name === 'git-diff');
    assert.equal(diff.status, 'WARN', 'tool artifacts are excluded → no changes to scan');
    assert.match(diff.detail, /no changes to scan/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// (b) NON-git dir → checkInsideRepo FAILs, overall FAIL, exit code non-zero (== 2).
test('check --json: in a non-git dir git-repo FAILs and exit code is non-zero', () => {
  const dir = makeNonGitDir();
  try {
    const r = run(['check', '--json'], dir);
    assert.notEqual(r.status, 0, 'a non-git cwd must produce a non-zero (FAIL) exit');
    assert.equal(r.status, 2, 'worst-rank FAIL maps to exit code 2');
    const j = JSON.parse(r.stdout);
    assert.equal(j.overall, 'FAIL');
    const repoCheck = j.checks.find(c => c.name === 'git-repo');
    assert.equal(repoCheck.status, 'FAIL');
    assert.match(repoCheck.detail, /not inside a git repo/);
    // short-circuit: has-commit and diff never run once git-repo FAILs.
    assert.equal(j.checks.find(c => c.name === 'git-has-commit'), undefined);
    assert.equal(j.checks.find(c => c.name === 'git-diff'), undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// (b') A git repo with NO commits → git-has-commit FAILs, overall FAIL, exit 2.
test('check --json: a git repo with no commits FAILs git-has-commit and exits 2', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-check-empty-'));
  try {
    git(['init', '-q'], root);
    const r = run(['check', '--json'], root);
    assert.equal(r.status, 2, `no-commit repo should FAIL (exit 2). stdout: ${r.stdout}`);
    const j = JSON.parse(r.stdout);
    assert.equal(j.overall, 'FAIL');
    assert.equal(j.checks.find(c => c.name === 'git-repo').status, 'PASS');
    assert.equal(j.checks.find(c => c.name === 'git-has-commit').status, 'FAIL');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// (c) Documented --json output shape: overall, checks[], nekowork_version.
test('check --json: output shape has the documented fields', () => {
  const root = makeGitRepoWithCommit();
  try {
    const r = run(['check', '--json'], root);
    const j = JSON.parse(r.stdout);

    // top-level keys
    assert.ok(typeof j.overall === 'string', 'overall is a string');
    assert.ok(['PASS', 'WARN', 'FAIL'].includes(j.overall), 'overall is a valid status');
    assert.ok(Array.isArray(j.checks), 'checks is an array');
    assert.ok(j.checks.length >= 1, 'checks has at least one entry');
    assert.ok(typeof j.nekowork_version === 'string' && j.nekowork_version.length > 0,
      'nekowork_version is a non-empty string');

    // each check has { name, status, detail }
    for (const c of j.checks) {
      assert.ok(typeof c.name === 'string' && c.name, 'check.name is a non-empty string');
      assert.ok(['PASS', 'WARN', 'FAIL'].includes(c.status), `check.status valid: ${c.status}`);
      assert.ok(typeof c.detail === 'string', 'check.detail is a string');
    }

    // node-version is always probed first → its detail echoes the running node.
    const node = j.checks.find(c => c.name === 'node-version');
    assert.ok(node, 'node-version check is present');
    assert.match(node.detail, /node \d+\.\d+/);

    // overall is exactly the worst-rank rollup of the recorded check statuses.
    const rank = { PASS: 0, WARN: 1, FAIL: 2 };
    const worst = j.checks.reduce((m, c) => Math.max(m, rank[c.status]), 0);
    const expectedOverall = Object.keys(rank).find(k => rank[k] === worst);
    assert.equal(j.overall, expectedOverall, 'overall == worst-rank of checks');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Node-version comparison logic: the live runner is node>=22, so checkNode's PASS
// branch is exercised in every case above. The FAIL branch (major < 22) is NOT
// reachable from here without spawning an old node binary (not available in this
// environment), so it is documented rather than asserted. The PASS branch detail
// shape is pinned by this test.
test('check --json: node-version PASS branch echoes the running node version (FAIL branch unreachable — documented)', () => {
  const root = makeGitRepoWithCommit();
  try {
    const r = run(['check', '--json'], root);
    const j = JSON.parse(r.stdout);
    const node = j.checks.find(c => c.name === 'node-version');
    assert.equal(node.status, 'PASS', 'runner is node>=22 so this is always PASS');
    assert.equal(node.detail, `node ${process.versions.node}`,
      'PASS detail is exactly `node <version>`');
    const major = parseInt(process.versions.node.split('.')[0], 10);
    assert.ok(major >= 22, 'precondition: test runner is node>=22 (FAIL branch not reachable here)');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
