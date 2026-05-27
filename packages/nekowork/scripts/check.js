#!/usr/bin/env node
// @ps-neko/nekowork — slim environment probe.
//
// Verifies the host is set up to run verify-pr:
//   1) Node.js >= 22
//   2) git available on PATH
//   3) cwd is inside a git repo
//   4) repo has >= 1 commit
//   5) (optional) recent working-tree diff present
//
// Distinct from @ps-neko/nekowork-cli's full doctor — that one probes AI
// provider CLIs (claude/codex/gemini) and skill catalogs, which the slim
// verification-gate package doesn't need.
//
// Exit code:
//   0  every check PASS
//   1  one or more WARN (non-blocking) — verify-pr will still work but degraded
//   2  one or more FAIL — verify-pr cannot run

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const STATUSES = { PASS: 'PASS', WARN: 'WARN', FAIL: 'FAIL' };
const RANK = { PASS: 0, WARN: 1, FAIL: 2 };

const checks = [];

function record(name, status, detail = '') {
  checks.push({ name, status, detail });
}

function checkNode() {
  const v = process.versions.node;
  const major = parseInt(v.split('.')[0], 10);
  if (major >= 22) {
    record('node-version', STATUSES.PASS, `node ${v}`);
  } else {
    record('node-version', STATUSES.FAIL, `node ${v} (need >= 22)`);
  }
}

function checkGitBinary() {
  const r = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (r.status === 0) {
    record('git-binary', STATUSES.PASS, r.stdout.trim());
  } else {
    record('git-binary', STATUSES.FAIL, 'git not on PATH');
  }
}

function checkInsideRepo() {
  const r = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });
  if (r.status === 0 && r.stdout.trim() === 'true') {
    record('git-repo', STATUSES.PASS, 'inside a git repo');
  } else {
    record('git-repo', STATUSES.FAIL, 'cwd is not inside a git repo (run `git init` first)');
  }
}

function checkHasCommit() {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (r.status === 0 && r.stdout.trim()) {
    record('git-has-commit', STATUSES.PASS, `HEAD = ${r.stdout.trim().slice(0, 8)}`);
  } else {
    record('git-has-commit', STATUSES.FAIL, 'repo has no commits yet (verify-pr needs a base)');
  }
}

function checkDiff() {
  const r = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
  if (r.status !== 0) {
    record('git-diff', STATUSES.WARN, 'could not check working-tree state');
    return;
  }
  const lines = r.stdout.split('\n').filter(l => l && !l.startsWith('??'));
  if (lines.length > 0) {
    record('git-diff', STATUSES.PASS, `${lines.length} modified file(s) — verify-pr will scan these`);
  } else {
    record('git-diff', STATUSES.WARN, 'no working-tree diff — `verify-pr` will report no changes');
  }
}

checkNode();
checkGitBinary();
checkInsideRepo();
if (checks[checks.length - 1].status === STATUSES.PASS) {
  checkHasCommit();
  if (checks[checks.length - 1].status === STATUSES.PASS) {
    checkDiff();
  }
}

const json = process.argv.includes('--json');
const worstRank = checks.reduce((m, c) => Math.max(m, RANK[c.status]), 0);
const worstStatus = Object.keys(RANK).find(k => RANK[k] === worstRank);

if (json) {
  console.log(JSON.stringify({
    overall: worstStatus,
    checks,
    nekowork_version: '0.2.0-alpha.0',
  }, null, 2));
} else {
  console.log('=== nekowork check ===');
  for (const c of checks) {
    const icon = c.status === 'PASS' ? '+' : c.status === 'WARN' ? '!' : 'x';
    console.log(`  [${icon}] ${c.name.padEnd(18)} ${c.status.padEnd(5)} ${c.detail}`);
  }
  console.log('');
  console.log(`overall: ${worstStatus}`);
  if (worstStatus === 'FAIL') {
    console.log('verify-pr cannot run until the FAIL items are fixed.');
  } else if (worstStatus === 'WARN') {
    console.log('verify-pr will run but some steps will be no-ops.');
  } else {
    console.log('Ready. Next: `nekowork verify-pr`');
  }
}

process.exit(worstRank);
