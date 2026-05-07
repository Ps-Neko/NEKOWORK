#!/usr/bin/env node
// Persistent wait daemon. It watches wakeup.json files created by the
// persistent-mode hook and resumes only sessions that declare a safe engine.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PIDFILE = path.join(ROOT, '.harness', 'wait.pid');
const POLL_MS = Number(process.env.HARNESS_WAIT_POLL_MS || 10_000);
const BACKOFF_MS = Number(process.env.HARNESS_WAIT_BACKOFF_MS || 60_000);

if (isMain()) main(process.argv.slice(2));

function main(argv) {
  const verb = argv[0] || 'status';
  if (verb === 'start') start({ root: ROOT });
  else if (verb === 'stop') stop({ root: ROOT });
  else if (verb === 'status') status({ root: ROOT });
  else { console.error(`unknown wait command: ${verb}. start | stop | status`); process.exit(2); }
}

function start({ root = ROOT } = {}) {
  if (fs.existsSync(PIDFILE)) {
    const pid = Number(fs.readFileSync(PIDFILE, 'utf8'));
    if (alive(pid)) { console.error(`already running: pid=${pid}`); process.exit(1); }
    fs.unlinkSync(PIDFILE);
  }
  fs.mkdirSync(path.dirname(PIDFILE), { recursive: true });
  fs.writeFileSync(PIDFILE, String(process.pid));
  console.log(`[harness wait] start pid=${process.pid} poll=${POLL_MS}ms`);

  const interval = setInterval(() => tick({ root }), POLL_MS);
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  function cleanup() {
    clearInterval(interval);
    try { fs.unlinkSync(PIDFILE); } catch {}
    console.log('[harness wait] stop');
    process.exit(0);
  }
  tick({ root });
}

function stop() {
  if (!fs.existsSync(PIDFILE)) { console.log('(daemon not running)'); return; }
  const pid = Number(fs.readFileSync(PIDFILE, 'utf8'));
  if (alive(pid)) {
    try { process.kill(pid, 'SIGTERM'); console.log(`SIGTERM pid=${pid}`); }
    catch (e) { console.error('kill failed:', e.message); }
  } else {
    console.log(`stale pidfile (pid=${pid}). cleaning.`);
  }
  try { fs.unlinkSync(PIDFILE); } catch {}
}

function status({ root = ROOT } = {}) {
  if (!fs.existsSync(PIDFILE)) console.log('daemon stopped');
  else {
    const pid = Number(fs.readFileSync(PIDFILE, 'utf8'));
    console.log(`pid=${pid} alive=${alive(pid)}`);
  }
  console.log(`pending wakeup: ${countWakeups(sessionsDir(root))}`);
}

function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}

function tick({ root = ROOT, runner = spawnSync, now = new Date() } = {}) {
  const decisions = processWakeups({ root, runner, now });
  for (const d of decisions) {
    if (d.action === 'resumed') console.log(`[wait] ${d.sessionId}: resumed ${d.command.join(' ')}`);
    else if (d.action === 'backoff') console.log(`[wait] ${d.sessionId}: resume failed; backoff until ${d.notBefore}`);
    else if (d.action === 'blocked-human-gate') console.log(`[wait] ${d.sessionId}: HUMAN_GATE; skipped`);
    else if (d.action === 'blocked') console.log(`[wait] ${d.sessionId}: blocked (${d.reason})`);
    else if (d.action === 'cleared-inactive') console.log(`[wait] ${d.sessionId}: inactive; wakeup cleared`);
  }
  return decisions;
}

function processWakeups({ root = ROOT, runner = spawnSync, now = new Date() } = {}) {
  const dir = sessionsDir(root);
  if (!fs.existsSync(dir)) return [];
  const decisions = [];
  for (const sessionId of fs.readdirSync(dir).sort()) {
    const sessionDir = path.join(dir, sessionId);
    if (!fs.statSync(sessionDir).isDirectory()) continue;
    const wakeupPath = path.join(sessionDir, 'wakeup.json');
    if (!fs.existsSync(wakeupPath)) continue;

    const wakeup = readJson(wakeupPath) || {};
    if (wakeup.not_before && new Date(wakeup.not_before) > now) {
      decisions.push(writeDecision(sessionDir, { sessionId, action: 'waiting-backoff', notBefore: wakeup.not_before }));
      continue;
    }

    const activePath = path.join(sessionDir, 'active');
    if (!fs.existsSync(activePath)) {
      removeFile(wakeupPath);
      decisions.push(writeDecision(sessionDir, { sessionId, action: 'cleared-inactive', reason: 'active file missing' }));
      continue;
    }

    if (fs.existsSync(path.join(sessionDir, 'HUMAN_GATE'))) {
      removeFile(wakeupPath);
      decisions.push(writeDecision(sessionDir, { sessionId, action: 'blocked-human-gate', reason: 'HUMAN_GATE exists' }));
      continue;
    }

    const active = parseActiveFile(fs.readFileSync(activePath, 'utf8'));
    const plan = buildResumePlan({ root, sessionId, active });
    if (!plan.ok) {
      removeFile(wakeupPath);
      decisions.push(writeDecision(sessionDir, { sessionId, action: 'blocked', reason: plan.reason, active }));
      continue;
    }

    const result = runner(process.execPath, plan.args, {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, HARNESS_WAIT_RESUME: '1' },
    });

    if ((result.status ?? 1) === 0) {
      removeFile(wakeupPath);
      decisions.push(writeDecision(sessionDir, {
        sessionId,
        action: 'resumed',
        command: [process.execPath, ...plan.args],
        status: result.status ?? 0,
        stdout: trimOutput(result.stdout),
        stderr: trimOutput(result.stderr),
      }));
    } else {
      const notBefore = new Date(now.getTime() + BACKOFF_MS).toISOString();
      fs.writeFileSync(wakeupPath, JSON.stringify({ ...wakeup, not_before: notBefore, last_error: trimOutput(result.stderr || result.stdout) }, null, 2));
      decisions.push(writeDecision(sessionDir, {
        sessionId,
        action: 'backoff',
        command: [process.execPath, ...plan.args],
        status: result.status ?? 1,
        notBefore,
        stdout: trimOutput(result.stdout),
        stderr: trimOutput(result.stderr),
      }));
    }
  }
  return decisions;
}

function buildResumePlan({ root = ROOT, sessionId, active }) {
  const mode = normalizeMode(active.mode);
  const task = active.task || active.prompt || active.request;
  if (!mode) return { ok: false, reason: 'active mode is missing or unsupported' };
  if (!task) return { ok: false, reason: 'active task is missing' };

  const cli = path.join('scripts', 'cli.js');
  if (mode === 'ralph') {
    const engine = active.engine || 'review';
    if (!['review', 'legacy-review', 'run'].includes(engine)) return { ok: false, reason: `unsupported ralph engine: ${engine}` };
    const args = [cli, 'ralph', task, '--session', sessionId, '--engine', engine];
    if (active.max_iter || active.maxIter) args.push('--max-iter', String(active.max_iter || active.maxIter));
    appendCommonFlags(args, active);
    return { ok: true, args };
  }

  if (mode === 'run') {
    const args = [cli, 'run', task, '--session', sessionId];
    appendCommonFlags(args, active);
    return { ok: true, args };
  }

  if (mode === 'review-cycle') {
    const args = [cli, 'review-cycle', task, '--session', sessionId];
    appendCommonFlags(args, active);
    if (truthy(active.no_ship) || truthy(active.noShip)) args.push('--no-ship');
    if (truthy(active.no_codex) || truthy(active.noCodex)) args.push('--no-codex');
    return { ok: true, args };
  }

  return { ok: false, reason: `unsupported active mode: ${active.mode}` };
}

function appendCommonFlags(args, active) {
  if (truthy(active.live)) args.push('--live');
  if (truthy(active.secure)) args.push('--secure');
}

function normalizeMode(mode) {
  if (mode === 'review') return 'review-cycle';
  if (mode === 'review-cycle' || mode === 'run' || mode === 'ralph') return mode;
  return null;
}

function parseActiveFile(content) {
  const text = String(content || '').trim();
  if (!text) return {};
  if (text.startsWith('{')) {
    try { return JSON.parse(text); } catch {}
  }

  const data = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const rawValue = trimmed.slice(idx + 1).trim();
    data[key] = parseActiveValue(rawValue);
  }
  return data;
}

function parseActiveValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('[') && value.endsWith(']'))) {
    try { return JSON.parse(value); } catch {}
  }
  return value;
}

function truthy(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function sessionsDir(root) {
  return path.join(root, '.harness', 'state', 'sessions');
}

function countWakeups(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir)
    .filter(s => fs.existsSync(path.join(dir, s, 'wakeup.json')))
    .length;
}

function writeDecision(sessionDir, decision) {
  const full = {
    ...decision,
    at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(sessionDir, 'wait-summary.json'), JSON.stringify(full, null, 2));
  fs.appendFileSync(path.join(sessionDir, 'wait-events.jsonl'), JSON.stringify(full) + '\n');
  return full;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function removeFile(file) {
  try { fs.unlinkSync(file); } catch {}
}

function trimOutput(value, max = 2000) {
  const text = String(value || '').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function isMain() {
  return path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url);
}

export {
  parseActiveFile,
  buildResumePlan,
  processWakeups,
  tick,
};
