# verify-pr `--run-checks` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `verify-pr --run-checks` flag that actually runs the project's test/lint/typecheck commands and escalates a clean verdict to `NEEDS_HUMAN_REVIEW` when a check fails (never auto-BLOCK on a check alone), refusing to run when the diff tampered with build/test scripts.

**Architecture:** A new no-reject subprocess capture helper feeds a new `check-runner` module that runs the command strings already produced by `project-detector`. `verify-pr.js` gains a `--run-checks` flag, a risk-based security gate, verdict escalation, and check evidence in `REPORT.md`/`decision.json`. Default behavior (no flag) is unchanged.

**Tech Stack:** Node.js (ESM), `node:test`, `node:child_process`. Repo: `C:/Users/Mun/harness`, package `packages/nekowork-cli`. Branch: `feat/verify-pr-run-checks`.

**Conventions:**
- All commands run from `packages/nekowork-cli/` unless noted.
- End every commit message with the repo trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Spec: `docs/superpowers/specs/2026-05-28-verify-pr-run-checks-design.md`.

---

### Task 1: `spawnCapture` — no-reject subprocess capture

**Files:**
- Modify: `packages/nekowork-cli/scripts/core/subprocess.js` (add `spawnCapture`, reuse internal `killProcessTree`)
- Test: `packages/nekowork-cli/tests/unit/subprocess-capture.test.js`

- [ ] **Step 1: Write the failing test**

Create `packages/nekowork-cli/tests/unit/subprocess-capture.test.js`:

```js
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { spawnCapture } from '../../scripts/core/subprocess.js';

test('spawnCapture: exit 0 → code 0, no reject', async () => {
  const r = await spawnCapture('node -e "process.stdout.write(\'ok\')"', {});
  assert.equal(r.code, 0);
  assert.equal(r.timedOut, false);
  assert.match(r.stdout, /ok/);
});

test('spawnCapture: non-zero exit is resolved (not rejected)', async () => {
  const r = await spawnCapture('node -e "process.exit(3)"', {});
  assert.equal(r.code, 3);
  assert.equal(r.timedOut, false);
});

test('spawnCapture: timeout → timedOut true', async () => {
  const r = await spawnCapture('node -e "setTimeout(()=>{}, 10000)"', { timeoutMs: 300 });
  assert.equal(r.timedOut, true);
});

test('spawnCapture: reports durationMs', async () => {
  const r = await spawnCapture('node -e ""', {});
  assert.equal(typeof r.durationMs, 'number');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/subprocess-capture.test.js`
Expected: FAIL — `spawnCapture` is not exported (`The requested module ... does not provide an export named 'spawnCapture'`).

- [ ] **Step 3: Implement `spawnCapture`**

In `packages/nekowork-cli/scripts/core/subprocess.js`, the top already has `import { spawn, spawnSync } from 'node:child_process';` and an internal `killProcessTree(child)`. Append this export at the end of the file:

```js
/**
 * Run a shell command, capturing output. Unlike spawnAndCollect, this NEVER
 * rejects on a non-zero exit — a failing check is a normal result, not a crash.
 *
 * @param {string} command  full command line (e.g. "npm test", "npx tsc --noEmit")
 * @param {{ cwd?: string, env?: object, timeoutMs?: number }} [options]
 * @returns {Promise<{ code: number|null, stdout: string, stderr: string,
 *   timedOut: boolean, spawnError: boolean, durationMs: number }>}
 */
export function spawnCapture(command, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 300000);
  const start = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const child = spawn(command, [], {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true,
    });

    const finish = (partial) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, timedOut, durationMs: Date.now() - start, ...partial });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => finish({ code: null, spawnError: true, stderr: stderr + String(e) }));
    child.on('close', (code) => finish({ code, spawnError: false }));
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/subprocess-capture.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/nekowork-cli/scripts/core/subprocess.js packages/nekowork-cli/tests/unit/subprocess-capture.test.js
git commit -m "feat(verify-pr): add spawnCapture (no-reject subprocess for checks)"
```

---

### Task 2: `check-runner` — run test/lint/typecheck commands

**Files:**
- Create: `packages/nekowork-cli/scripts/lib/check-runner.js`
- Test: `packages/nekowork-cli/tests/unit/check-runner.test.js`

- [ ] **Step 1: Write the failing test**

Create `packages/nekowork-cli/tests/unit/check-runner.test.js`:

```js
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { runChecks } from '../../scripts/lib/check-runner.js';

const PASS = 'node -e ""';
const FAIL = 'node -e "process.exit(1)"';

test('runChecks: passing command → status pass', async () => {
  const results = await runChecks({ test: PASS }, { only: ['test'] });
  assert.equal(results.length, 1);
  assert.equal(results[0].name, 'test');
  assert.equal(results[0].status, 'pass');
  assert.equal(results[0].exitCode, 0);
});

test('runChecks: failing command → status fail', async () => {
  const results = await runChecks({ test: FAIL }, { only: ['test'] });
  assert.equal(results[0].status, 'fail');
  assert.equal(results[0].exitCode, 1);
});

test('runChecks: null command → status skipped', async () => {
  const results = await runChecks({ test: null }, { only: ['test'] });
  assert.equal(results[0].status, 'skipped');
});

test('runChecks: nonexistent binary → status unavailable', async () => {
  const results = await runChecks({ lint: 'definitely-not-a-real-bin-xyz' }, { only: ['lint'] });
  assert.equal(results[0].status, 'unavailable');
});

test('runChecks: timeout → status timeout', async () => {
  const results = await runChecks(
    { test: 'node -e "setTimeout(()=>{}, 10000)"' },
    { only: ['test'], timeoutMs: 300 },
  );
  assert.equal(results[0].status, 'timeout');
});

test('runChecks: default only = test, lint, typecheck (build/audit excluded)', async () => {
  const results = await runChecks(
    { test: PASS, lint: PASS, typecheck: PASS, build: PASS, audit: PASS },
  );
  const names = results.map(r => r.name);
  assert.deepEqual(names, ['test', 'lint', 'typecheck']);
});

test('runChecks: outputTail captures command output', async () => {
  const results = await runChecks(
    { test: 'node -e "console.log(\'hello-from-check\')"' },
    { only: ['test'] },
  );
  assert.match(results[0].outputTail, /hello-from-check/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/check-runner.test.js`
Expected: FAIL — cannot find module `check-runner.js`.

- [ ] **Step 3: Implement `check-runner.js`**

Create `packages/nekowork-cli/scripts/lib/check-runner.js`:

```js
// Runs a project's verification commands (test / lint / typecheck) for
// `verify-pr --run-checks`. Command strings come from project-detector.
// Failures escalate the verdict (see verify-pr.js); they never auto-BLOCK.

import { spawnCapture } from '../core/subprocess.js';

const DEFAULT_CHECKS = ['test', 'lint', 'typecheck'];
const TAIL_LINES = 40;

// Shell "command not found": POSIX 127/126, cmd.exe 9009.
const NOT_FOUND_CODES = new Set([126, 127, 9009]);

function tail(text, n = TAIL_LINES) {
  return String(text || '').split('\n').slice(-n).join('\n');
}

function classify(r) {
  if (r.timedOut) return 'timeout';
  if (r.spawnError) return 'unavailable';
  if (r.code != null && NOT_FOUND_CODES.has(r.code)) return 'unavailable';
  if (r.code === 0) return 'pass';
  return 'fail';
}

/**
 * @param {{ test?: string|null, lint?: string|null, typecheck?: string|null }} commands
 * @param {{ cwd?: string, timeoutMs?: number, only?: string[] }} [options]
 * @returns {Promise<Array<{ name, command, status, exitCode, durationMs, outputTail }>>}
 */
export async function runChecks(commands = {}, options = {}) {
  const only = options.only || DEFAULT_CHECKS;
  const results = [];
  for (const name of only) {
    const command = commands?.[name] ?? null;
    if (!command) {
      results.push({ name, command: null, status: 'skipped', exitCode: null, durationMs: 0, outputTail: '' });
      continue;
    }
    const r = await spawnCapture(command, { cwd: options.cwd, timeoutMs: options.timeoutMs });
    results.push({
      name,
      command,
      status: classify(r),
      exitCode: r.code,
      durationMs: r.durationMs,
      outputTail: tail(r.stdout + r.stderr),
    });
  }
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/check-runner.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/nekowork-cli/scripts/lib/check-runner.js packages/nekowork-cli/tests/unit/check-runner.test.js
git commit -m "feat(verify-pr): add check-runner (runs test/lint/typecheck)"
```

---

### Task 3: `--run-checks` / `--checks-timeout` argument parsing

**Files:**
- Modify: `packages/nekowork-cli/scripts/orchestrators/verify-pr.js` (function `parseVerifyPrArgs`)
- Test: `packages/nekowork-cli/tests/unit/verify-pr.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `packages/nekowork-cli/tests/unit/verify-pr.test.js`:

```js
test('parseVerifyPrArgs: --run-checks 와 --checks-timeout', () => {
  const opts = parseVerifyPrArgs(['--run-checks', '--checks-timeout', '60000']);
  assert.equal(opts.runChecks, true);
  assert.equal(opts.checksTimeout, 60000);
});

test('parseVerifyPrArgs: --run-checks 없으면 runChecks 는 falsy', () => {
  const opts = parseVerifyPrArgs([]);
  assert.ok(!opts.runChecks);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/verify-pr.test.js`
Expected: FAIL — `opts.runChecks` is `undefined` (assert `=== true` fails).

- [ ] **Step 3: Implement the flag parsing**

In `packages/nekowork-cli/scripts/orchestrators/verify-pr.js`, function `parseVerifyPrArgs`, add two branches inside the `for` loop (next to the existing `--ci-exit-soft` branch):

```js
    else if (a === '--run-checks') opts.runChecks = true;
    else if (a === '--checks-timeout') opts.checksTimeout = Number(rest[++i]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/verify-pr.test.js`
Expected: PASS (existing tests + 2 new).

- [ ] **Step 5: Commit**

```bash
git add packages/nekowork-cli/scripts/orchestrators/verify-pr.js packages/nekowork-cli/tests/unit/verify-pr.test.js
git commit -m "feat(verify-pr): parse --run-checks / --checks-timeout"
```

---

### Task 4: Security gate — refuse to run on script/install tampering

**Files:**
- Modify: `packages/nekowork-cli/scripts/orchestrators/verify-pr.js` (add + export `checksBlockedByRisk`)
- Test: `packages/nekowork-cli/tests/unit/verify-pr-gate.test.js`

- [ ] **Step 1: Write the failing test**

Create `packages/nekowork-cli/tests/unit/verify-pr-gate.test.js`:

```js
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { checksBlockedByRisk } from '../../scripts/orchestrators/verify-pr.js';

test('gate: critical finding blocks check execution', () => {
  assert.equal(checksBlockedByRisk([{ rule: 'secret-fallback', severity: 'critical', pattern: 'x' }]), true);
});

test('gate: package-lockfile-risk install-hook blocks execution', () => {
  assert.equal(checksBlockedByRisk([{ rule: 'package-lockfile-risk', severity: 'high', pattern: 'install-hook-postinstall' }]), true);
});

test('gate: package-lockfile-risk script-* blocks execution', () => {
  assert.equal(checksBlockedByRisk([{ rule: 'package-lockfile-risk', severity: 'critical', pattern: 'script-curl-bash' }]), true);
});

test('gate: test-or-security-disable blocks execution', () => {
  assert.equal(checksBlockedByRisk([{ rule: 'test-or-security-disable', severity: 'high', pattern: 'it-skip' }]), true);
});

test('gate: plain dependency change does NOT block execution', () => {
  assert.equal(checksBlockedByRisk([{ rule: 'package-lockfile-risk', severity: 'high', pattern: 'dependency-git-url' }]), false);
});

test('gate: no findings → not blocked', () => {
  assert.equal(checksBlockedByRisk([]), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/verify-pr-gate.test.js`
Expected: FAIL — no export `checksBlockedByRisk`.

- [ ] **Step 3: Implement the gate**

In `packages/nekowork-cli/scripts/orchestrators/verify-pr.js`, add this exported function (near `deriveVerdict`):

```js
/**
 * Decide whether --run-checks must SKIP executing project commands because the
 * diff itself tampered with the execution surface (install/test scripts) or has
 * a critical finding. The finding's `pattern` field (set by makeRegexScanner)
 * distinguishes install/script changes from plain dependency changes.
 */
export function checksBlockedByRisk(findings) {
  return findings.some((f) => {
    if (f.severity === 'critical') return true;
    if (f.rule === 'test-or-security-disable') return true;
    if (f.rule === 'package-lockfile-risk') {
      const p = String(f.pattern || '');
      return p.startsWith('install-hook-') || p.startsWith('script-');
    }
    return false;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/verify-pr-gate.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/nekowork-cli/scripts/orchestrators/verify-pr.js packages/nekowork-cli/tests/unit/verify-pr-gate.test.js
git commit -m "feat(verify-pr): add checksBlockedByRisk security gate"
```

---

### Task 5: Wire checks into `verifyPrCycle` + verdict escalation + evidence

**Files:**
- Modify: `packages/nekowork-cli/scripts/orchestrators/verify-pr.js` (functions `verifyPrCycle`, `deriveVerdict`, `buildDecision`, `writeEvidence`)
- Test: `packages/nekowork-cli/tests/integration/verify-pr-checks.test.js`

- [ ] **Step 1: Write the failing test**

Create `packages/nekowork-cli/tests/integration/verify-pr-checks.test.js`:

```js
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
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('--run-checks: failing test + benign source → NEEDS_HUMAN_REVIEW (not BLOCK)', async () => {
  const root = makeProject('node -e "process.exit(1)"'); // test fails
  try {
    write(root, 'src/util.ts', 'export const x = 1;\n');
    const r = await verifyPrCycle({ projectRoot: root, runChecks: true, write: false });
    assert.equal(r.decision.verdict, VERDICT.NEEDS_HUMAN_REVIEW);
    assert.match(r.decision.reason, /test/);
    assert.equal(r.exitCode, 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('without --run-checks: behavior unchanged (failing test not run)', async () => {
  const root = makeProject('node -e "process.exit(1)"');
  try {
    write(root, 'src/util.ts', 'export const x = 1;\n');
    const r = await verifyPrCycle({ projectRoot: root, write: false });
    // test command EXISTS, so source change is ALLOW; checks were never run.
    assert.equal(r.decision.verdict, VERDICT.ALLOW);
    assert.equal(r.decision.checks.requested, false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('--run-checks: critical finding skips execution (gate)', async () => {
  const root = makeProject('node -e "process.exit(1)"');
  try {
    write(root, 'src/auth.ts', 'export const k = process.env.API_KEY || "sk-leaked-fallback-secret";\n');
    const r = await verifyPrCycle({ projectRoot: root, runChecks: true, write: false });
    assert.equal(r.decision.verdict, VERDICT.BLOCK); // critical wins
    assert.equal(r.decision.checks.skippedReason != null, true);
    assert.equal(r.decision.checks.results.length, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/integration/verify-pr-checks.test.js`
Expected: FAIL — `r.decision.checks` is undefined; `runChecks` option ignored.

- [ ] **Step 3: Implement the wiring**

In `packages/nekowork-cli/scripts/orchestrators/verify-pr.js`:

(a) Add the import near the other rule imports at the top:

```js
import { runChecks } from '../lib/check-runner.js';
```

(b) In `verifyPrCycle`, after `const findings = runRules(parsedDiff);` and before `const verdict = deriveVerdict(...)`, insert:

```js
  let checks = { requested: Boolean(opts.runChecks), skippedReason: null, results: [] };
  if (opts.runChecks) {
    if (checksBlockedByRisk(findings)) {
      checks.skippedReason = 'diff modifies build/test scripts or has a critical finding — checks not run; run them manually in a trusted sandbox if you trust this change';
    } else {
      checks.results = await runChecks(project.commands, {
        cwd: projectRoot,
        timeoutMs: opts.checksTimeout,
      });
    }
  }
```

(c) Change the `deriveVerdict` call to pass checks:

```js
  const verdict = deriveVerdict({ findings, parsedDiff, checksAvailable, checks });
```

(d) Change the `buildDecision` call to pass checks:

```js
  const decision = buildDecision({ verdict, findings, parsedDiff, project, checksAvailable, checks });
```

(e) In `deriveVerdict`, update the signature and insert the escalation branch. Replace the function's signature line and add the branch AFTER the `hasHigh` branch and BEFORE the `sourceOnly && !checksAvailable.test` branch:

```js
function deriveVerdict({ findings, parsedDiff, checksAvailable, checks }) {
```

After the existing `if (hasHigh) { ... }` block, insert:

```js
  const ranChecks = checks && Array.isArray(checks.results) && checks.results.length > 0;
  if (ranChecks) {
    const failed = checks.results.filter(c => c.status === 'fail' || c.status === 'timeout');
    if (failed.length) {
      return {
        verdict: VERDICT.NEEDS_HUMAN_REVIEW,
        reason: `verification command failed: ${failed.map(c => c.name).join(', ')}`,
        apply_allowed: false,
      };
    }
  }
```

(f) In `buildDecision`, update the signature and add `checks` to the returned object:

```js
function buildDecision({ verdict, findings, parsedDiff, project, checksAvailable, checks }) {
```

Add this line inside the returned object (e.g., after `findings,`):

```js
    checks: checks || { requested: false, skippedReason: null, results: [] },
```

(g) In `writeEvidence`, after the `risk-findings.json` write, add a checks evidence file. Update the `writeEvidence` signature to accept `decision` (it already does) and write:

```js
  const checksPath = path.join(evidenceDir, 'checks.json');
  fs.writeFileSync(checksPath, JSON.stringify(decision.checks || { requested: false, results: [] }, null, 2));
```

Add `checks: checksPath` to the returned `writtenPaths` object in `writeEvidence`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/integration/verify-pr-checks.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the existing verify-pr unit tests (regression guard)**

Run: `node --test tests/unit/verify-pr.test.js`
Expected: PASS — all existing tests still pass (no-flag behavior unchanged).

- [ ] **Step 6: Commit**

```bash
git add packages/nekowork-cli/scripts/orchestrators/verify-pr.js packages/nekowork-cli/tests/integration/verify-pr-checks.test.js
git commit -m "feat(verify-pr): run checks, escalate on failure, write checks evidence"
```

---

### Task 6: Report + PR comment rendering for checks

**Files:**
- Modify: `packages/nekowork-cli/scripts/orchestrators/verify-pr.js` (functions `renderReport`, `renderPrComment`)
- Test: `packages/nekowork-cli/tests/integration/verify-pr-checks.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `packages/nekowork-cli/tests/integration/verify-pr-checks.test.js`:

```js
test('--run-checks: REPORT.md has a Checks Run section', async () => {
  const root = makeProject('node -e "process.exit(1)"');
  try {
    write(root, 'src/util.ts', 'export const x = 1;\n');
    await verifyPrCycle({ projectRoot: root, runChecks: true, write: true });
    const report = fs.readFileSync(path.join(root, 'REPORT.md'), 'utf8');
    assert.match(report, /## Checks Run/);
    assert.match(report, /test.*fail/i);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/integration/verify-pr-checks.test.js`
Expected: FAIL — REPORT.md has no "Checks Run" section.

- [ ] **Step 3: Implement the rendering**

In `packages/nekowork-cli/scripts/orchestrators/verify-pr.js`, function `renderReport`, replace the existing "Checks Available" block (the loop over `decision.project.checks_available`) with a checks-run-aware version. Find:

```js
  lines.push('## Checks Available');
  lines.push('');
  for (const [name, ok] of Object.entries(decision.project.checks_available)) {
    lines.push(`- ${name}: ${ok ? 'configured' : 'not configured'}`);
  }
  lines.push('');
```

Replace with:

```js
  const checks = decision.checks || { requested: false, skippedReason: null, results: [] };
  if (checks.requested && checks.results.length) {
    lines.push('## Checks Run');
    lines.push('');
    for (const c of checks.results) {
      lines.push(`- ${c.name}: ${c.status}${c.exitCode != null ? ` (exit ${c.exitCode})` : ''}`);
      if ((c.status === 'fail' || c.status === 'timeout') && c.outputTail) {
        lines.push('');
        lines.push('```text');
        lines.push(c.outputTail);
        lines.push('```');
      }
    }
    lines.push('');
  } else if (checks.requested && checks.skippedReason) {
    lines.push('## Checks Run');
    lines.push('');
    lines.push(`Skipped: ${checks.skippedReason}`);
    lines.push('');
  } else {
    lines.push('## Checks Available');
    lines.push('');
    for (const [name, ok] of Object.entries(decision.project.checks_available)) {
      lines.push(`- ${name}: ${ok ? 'configured' : 'not configured'}`);
    }
    lines.push('');
  }
```

Then in `renderPrComment`, after the findings-count table row block (after the `| Changed files |` line push), add a checks row:

```js
  const cks = decision.checks || { requested: false, results: [] };
  if (cks.requested) {
    const summary = cks.results.length
      ? cks.results.map(c => `${c.name}=${c.status}`).join(' ')
      : (cks.skippedReason ? 'skipped' : 'none');
    lines.push(`| Checks | ${summary} |`);
  }
```

(Place this BEFORE the `lines.push('');` that closes the table, so it stays inside the table.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/integration/verify-pr-checks.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/nekowork-cli/scripts/orchestrators/verify-pr.js packages/nekowork-cli/tests/integration/verify-pr-checks.test.js
git commit -m "feat(verify-pr): render Checks Run in REPORT.md and PR comment"
```

---

### Task 7: CLI help, SCOPE doc update, full-suite verification

**Files:**
- Modify: `packages/nekowork-cli/scripts/cli.js` (verify-pr help text)
- Modify: `packages/nekowork-cli/docs/SCOPE-1.0.md` (§5, §7)

- [ ] **Step 1: Add `--run-checks` to CLI help**

In `packages/nekowork-cli/scripts/cli.js`, find the verify-pr help lines (around the `verify-pr --ci-exit-soft` help line) and add below it:

```js
  console.log(`  verify-pr --run-checks                run test/lint/typecheck; failure → NEEDS_REVIEW (opt-in)`);
```

- [ ] **Step 2: Update SCOPE-1.0.md §5 (pipeline) and §7 (decision rules)**

In `packages/nekowork-cli/docs/SCOPE-1.0.md`:

In §5, the "구현 상태" note (added by PR #84) currently says command execution is unimplemented. Change the relevant sentence to:

```
> **구현 상태 (2026-05-28):** diff 수집 · project detector · 5개 risk rule · deterministic
> decision · REPORT.md · decision.json · --comment-file · --ci-exit-soft 동작. 검증 명령 실행은
> **옵트인 `--run-checks`** 로 구현됨 (test/lint/typecheck; build/audit 는 v1 제외). 실행 결과는
> 격상-only — 실패 시 ALLOW → NEEDS_HUMAN_REVIEW, 단독 BLOCK 없음. Codex advisor 경로는 미연결.
```

In §7 "결정 룰", change the line:

```
source 변경 + 테스트 실패                → BLOCK
```

to:

```
검사(test/lint/typecheck) 실패 (--run-checks)  → NEEDS_HUMAN_REVIEW (단독 BLOCK 없음)
```

And change:

```
HIGH finding + 검증 실패                 → BLOCK
HIGH finding + 검증 성공                 → NEEDS_HUMAN_REVIEW
```

to:

```
HIGH finding                             → NEEDS_HUMAN_REVIEW (검사 결과가 등급을 낮추지 않음)
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all unit + integration + e2e tests green, including the new `subprocess-capture`, `check-runner`, `verify-pr-gate`, and `verify-pr-checks` suites.

- [ ] **Step 4: Run repo validation (no catalog/marker breakage)**

Run: `node scripts/ci/check-markers.js && npm run validate:all`
Expected: PASS (these cover catalog/markers, unaffected by this change, but confirm nothing regressed).

- [ ] **Step 5: Manual smoke (optional but recommended)**

Run from a scratch git repo with a passing and then failing `npm test` script:
```bash
node scripts/cli.js verify-pr --run-checks
```
Expected: passing → `ALLOW` with a "Checks Run" section; failing → `NEEDS_HUMAN_REVIEW`.

- [ ] **Step 6: Commit**

```bash
git add packages/nekowork-cli/scripts/cli.js packages/nekowork-cli/docs/SCOPE-1.0.md
git commit -m "docs(verify-pr): document --run-checks in CLI help and SCOPE §5/§7"
```

---

## Notes for the executor

- **Do not** add build/audit execution, default-on behavior, or sandboxing — explicitly out of scope (spec §2, §7).
- The verdict precedence is: risk rules (CRITICAL→BLOCK, HIGH→NEEDS_HUMAN_REVIEW) **first**, then check failure escalation, then existing INSUFFICIENT/ALLOW logic. A failing check must never produce BLOCK on its own.
- `decision.json` gains a `checks` field; bump `SCHEMA_VERSION` from `verify-pr-v0` to `verify-pr-v1` in verify-pr.js if you add the field to the schema surface (spec §8).
- After all tasks, the SCOPE-1.0.md change here may conflict with PR #84 (which also edited §5) once both land on `main`; rebase `feat/verify-pr-run-checks` on `main` after #84 merges and resolve the §5 note in favor of this task's wording.
