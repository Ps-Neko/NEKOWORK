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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));

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

// Mirror scripts/lib/diff-parser.js isSelfOutput: verify-pr drops its own output
// (REPORT.md + .nekowork/**) from every diff source, so those artifacts must not
// count as "working-tree changes" here either. Case-insensitive to match the
// parser (Windows/macOS case-insensitive filesystems resolve REPORT.MD etc. to
// the same files).
function isSelfOutput(relPath) {
  const lower = String(relPath).toLowerCase();
  return lower === 'report.md' || lower.startsWith('.nekowork/');
}

// Parse one `git status --porcelain` line into its repo-relative path. Porcelain
// v1 format is `XY <path>` (2 status chars + space + path); renames use
// `XY old -> new`, where the post-rename path is what verify-pr would scan.
function porcelainPath(line) {
  let p = line.slice(3);
  const arrow = p.indexOf(' -> ');
  if (arrow !== -1) p = p.slice(arrow + ' -> '.length);
  // Porcelain quotes paths with special chars; strip surrounding quotes.
  if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
  return p.replace(/\\/g, '/');
}

function checkDiff() {
  // Use `git status --porcelain` (NOT `git diff`): plain `git diff` omits
  // UNTRACKED new files, but verify-pr DOES scan them (synthesizeUntrackedDiff).
  // Reporting "no diff" while verify-pr finds untracked criticals is a misleading
  // false-negative. Porcelain lists untracked with `??`, so it matches verify-pr's
  // diff scope. We then drop nekowork's own output so its artifacts don't count.
  const r = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
  if (r.status !== 0) {
    record('git-diff', STATUSES.WARN, 'could not check working-tree state');
    return;
  }
  const changed = r.stdout
    .split('\n')
    .filter(Boolean)
    .map(porcelainPath)
    .filter(p => p && !isSelfOutput(p));
  if (changed.length > 0) {
    record('git-diff', STATUSES.PASS, `working-tree changes detected (${changed.length} file(s)) — verify-pr will scan them`);
  } else {
    record('git-diff', STATUSES.WARN, 'no changes to scan — `verify-pr` will report no changes');
  }
}

// Gentle, non-blocking hint: verify-pr leaves its evidence output (.nekowork/ and
// REPORT.md) in the user's repo, which then shows up in `git status`. If those
// artifacts already exist AND are not gitignored, suggest adding them. Returns a
// hint string or null. Never a check/failure — just a nudge.
function gitignoreHint() {
  const artifacts = ['.nekowork/', 'REPORT.md'];
  const present = artifacts.filter(a => {
    try { return fs.existsSync(path.resolve(process.cwd(), a.replace(/\/$/, ''))); } catch { return false; }
  });
  if (present.length === 0) return null;
  // git check-ignore exits 0 if the path IS ignored, 1 if not. Hint only for
  // artifacts that exist but are NOT ignored.
  const notIgnored = present.filter(a => {
    const r = spawnSync('git', ['check-ignore', '-q', a], { encoding: 'utf8' });
    return r.status !== 0;
  });
  if (notIgnored.length === 0) return null;
  return 'Tip: NEKOWORK wrote evidence (.nekowork/, REPORT.md) into this repo. '
    + 'Add them to .gitignore so they don\'t clutter `git status`:\n'
    + '       echo -e ".nekowork/\\nREPORT.md" >> .gitignore';
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
    nekowork_version: _pkg.version,
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
  // Only meaningful inside a repo (where check-ignore works). git-repo PASS implies that.
  const repoOk = checks.find(c => c.name === 'git-repo')?.status === STATUSES.PASS;
  if (repoOk) {
    const hint = gitignoreHint();
    if (hint) {
      console.log('');
      console.log(`  [i] ${hint}`);
    }
  }
}

process.exit(worstRank);
