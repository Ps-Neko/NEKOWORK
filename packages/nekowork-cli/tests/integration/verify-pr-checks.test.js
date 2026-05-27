import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyPrCycle, VERDICT } from '../../scripts/orchestrators/verify-pr.js';

function makeProject(testScript) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-checks-'));
  spawnSync('git', ['init', '-q'], { cwd: root });
  spawnSync('git', ['config', 'user.email', 't@t.t'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: root });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: testScript } }));
  fs.writeFileSync(path.join(root, '.gitignore'), '.nekowork/\nREPORT.md\n');
  spawnSync('git', ['add', '-A'], { cwd: root });
  spawnSync('git', ['commit', '-q', '-m', 'init'], { cwd: root });
  return root;
}
function write(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

test('--run-checks: passing test + benign source → ALLOW with checks evidence', async () => {
  const root = makeProject('node -e ""'); // test passes
  try {
    write(root, 'src/util.ts', 'export const x = 1;\n');
    const r = await verifyPrCycle({ projectRoot: root, runChecks: true, write: false });
    assert.equal(r.decision.verdict, VERDICT.ALLOW);
    const testResult = r.decision.checks.results.find(c => c.name === 'test');
    assert.equal(testResult.status, 'pass');
  } finally { try { fs.rmSync(root, { recursive: true, force: true }); } catch {} }
});

test('--run-checks: failing test + benign source → NEEDS_HUMAN_REVIEW (not BLOCK)', async () => {
  const root = makeProject('node -e "process.exit(1)"'); // test fails
  try {
    write(root, 'src/util.ts', 'export const x = 1;\n');
    const r = await verifyPrCycle({ projectRoot: root, runChecks: true, write: false });
    assert.equal(r.decision.verdict, VERDICT.NEEDS_HUMAN_REVIEW);
    assert.match(r.decision.reason, /test/);
    assert.equal(r.exitCode, 1);
  } finally { try { fs.rmSync(root, { recursive: true, force: true }); } catch {} }
});

test('without --run-checks: behavior unchanged (failing test not run)', async () => {
  const root = makeProject('node -e "process.exit(1)"');
  try {
    write(root, 'src/util.ts', 'export const x = 1;\n');
    const r = await verifyPrCycle({ projectRoot: root, write: false });
    // test command EXISTS, so source change is ALLOW; checks were never run.
    assert.equal(r.decision.verdict, VERDICT.ALLOW);
    assert.equal(r.decision.checks.requested, false);
  } finally { try { fs.rmSync(root, { recursive: true, force: true }); } catch {} }
});

test('--run-checks: critical finding skips execution (gate)', async () => {
  const root = makeProject('node -e "process.exit(1)"');
  try {
    write(root, 'src/auth.ts', 'export const k = process.env.API_KEY || "sk-leaked-fallback-secret";\n');
    const r = await verifyPrCycle({ projectRoot: root, runChecks: true, write: false });
    assert.equal(r.decision.verdict, VERDICT.BLOCK); // critical wins
    assert.equal(r.decision.checks.skippedReason != null, true);
    assert.equal(r.decision.checks.results.length, 0);
  } finally { try { fs.rmSync(root, { recursive: true, force: true }); } catch {} }
});

test('--run-checks: REPORT.md has a Checks Run section', async () => {
  const root = makeProject('node -e "process.exit(1)"');
  try {
    write(root, 'src/util.ts', 'export const x = 1;\n');
    await verifyPrCycle({ projectRoot: root, runChecks: true, write: true });
    const report = fs.readFileSync(path.join(root, 'REPORT.md'), 'utf8');
    assert.match(report, /## Checks Run/);
    assert.match(report, /test.*fail/i);
  } finally { try { fs.rmSync(root, { recursive: true, force: true }); } catch {} }
});

test('--run-checks + --comment-file: PR comment has Checks row', async () => {
  const root = makeProject('node -e ""');
  try {
    write(root, 'src/util.ts', 'export const x = 1;\n');
    const commentPath = path.join(root, 'pr-comment.md');
    await verifyPrCycle({ projectRoot: root, runChecks: true, commentFile: commentPath, write: false });
    const comment = fs.readFileSync(commentPath, 'utf8');
    assert.match(comment, /\| Checks \|.*test=pass.*\|/);
  } finally { try { fs.rmSync(root, { recursive: true, force: true }); } catch {} }
});
