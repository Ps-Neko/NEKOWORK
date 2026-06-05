// Runs a project's verification commands (test / lint / typecheck) for
// `verify-pr --run-checks`. Command strings come from project-detector.
// Failures escalate the verdict (see verify-pr.js); they never auto-BLOCK.

import { spawn } from 'node:child_process';
import { spawnCapture } from '../core/subprocess.js';

const DEFAULT_CHECKS = ['test', 'lint', 'typecheck'];
const TAIL_LINES = 40;

// Shell "command not found": POSIX 127/126, cmd.exe 9009.
const NOT_FOUND_CODES = new Set([126, 127, 9009]);

function tail(text, n = TAIL_LINES) {
  return String(text || '').split('\n').slice(-n).join('\n');
}

const BIN_EXISTS_TIMEOUT_MS = 5000;

/**
 * Returns true if the binary (first word of command) can be found on PATH.
 * Uses `where` on Windows, `which` on POSIX.
 * Resolves false on timeout (~5 s) or spawn error.
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
