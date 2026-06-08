// Runs a project's verification commands (test / lint / typecheck) for
// `verify-pr --run-checks`. Command strings come from project-detector.
// A failed/timed-out check ESCALATES the verdict to NEEDS_HUMAN_REVIEW (see
// verify-pr.js / deriveRiskVerdict); a check failure NEVER auto-BLOCKs.
//
// Self-contained: the slim @ps-neko/nekowork package owns its own subprocess
// helper (no dependency on the internal harness) so the published gate can run
// checks on its own. Ported from the harness check-runner to keep behaviour
// identical across the two packages.

import { spawn, spawnSync } from 'node:child_process';

const DEFAULT_CHECKS = ['test', 'lint', 'typecheck'];
const TAIL_LINES = 40;
const DEFAULT_TIMEOUT_MS = 300000;
const BIN_EXISTS_TIMEOUT_MS = 5000;

// Shell "command not found": POSIX 127/126, cmd.exe 9009.
const NOT_FOUND_CODES = new Set([126, 127, 9009]);

function tail(text, n = TAIL_LINES) {
  return String(text || '').split('\n').slice(-n).join('\n');
}

function killProcessTree(child) {
  try {
    if (process.platform === 'win32' && child.pid) {
      spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      return;
    }
    child.kill();
  } catch {
    try { child.kill(); } catch {}
  }
}

/**
 * Returns true if the binary (first word of the command) is on PATH. Uses
 * `where` on Windows, `which` on POSIX. Resolves false on timeout or spawn error.
 */
function binExists(command) {
  const bin = command.trim().split(/\s+/)[0];
  if (!bin) return Promise.resolve(false);
  const checker = process.platform === 'win32' ? 'where' : 'which';
  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => { if (!settled) { settled = true; clearTimeout(timer); resolve(val); } };
    const child = spawn(checker, [bin], { shell: false, stdio: 'ignore', windowsHide: true });
    const timer = setTimeout(() => { try { child.kill(); } catch {} done(false); }, BIN_EXISTS_TIMEOUT_MS);
    child.on('error', () => done(false));
    child.on('close', (code) => done(code === 0));
  });
}

/**
 * Run a shell command, capturing output. NEVER rejects on a non-zero exit — a
 * failing check is a normal result, not a crash.
 *
 * @param {string} command  full command line (e.g. "npm test", "npx tsc --noEmit")
 * @param {{ cwd?: string, env?: object, timeoutMs?: number }} [options]
 * @returns {Promise<{ code: number|null, stdout: string, stderr: string,
 *   timedOut: boolean, spawnError: boolean, durationMs: number }>}
 */
function spawnCapture(command, options = {}) {
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
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

function classify(r, existed) {
  if (r.timedOut) return 'timeout';
  if (r.spawnError) return 'unavailable';
  if (r.code != null && NOT_FOUND_CODES.has(r.code)) return 'unavailable';
  if (!existed) return 'unavailable';
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
    const existed = await binExists(command);
    const r = await spawnCapture(command, { cwd: options.cwd, timeoutMs: options.timeoutMs });
    results.push({
      name,
      command,
      status: classify(r, existed),
      exitCode: r.code,
      durationMs: r.durationMs,
      outputTail: tail(r.stdout + r.stderr),
    });
  }
  return results;
}
