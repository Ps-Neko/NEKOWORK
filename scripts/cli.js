#!/usr/bin/env node
// NEKOWORK CLI entrypoint. The `harness` bin remains a legacy/internal alias.
// Public verbs: check, init, doctor, ask, plan, team, work, verify, gate, ship, apply, run, build, report, review, review-cycle, install, validate, version.
// Advanced verbs: self-review, codex-review, ralph, wait, sessions, costs, instincts.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const verb = process.argv[2];
const rest = process.argv.slice(3);

function run(script, args) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script), ...args], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

function resolveProjectRoot(value) {
  return path.resolve(value || process.env.HARNESS_PROJECT_ROOT || process.cwd());
}

function help() {
  console.log(`
nekowork <verb> [args]

Legacy alias:
  harness <verb> [args]

Install / verify
  check [--project-root <dir>] [--gemini-smoke] [--json] [--full]
                                         beginner health check; quick doctor by default
  init [--profile <name>|--pack <name>] [--project-root <dir>]
                                         beginner install alias; applies generated harness outputs
  install --plan [--profile <name>|--pack <name>] [--target <name>] [--module <id>] [--component <id>] [--project-root <dir>]
                                         selective manifest dry-run
  install --plan --list [--json]         list profile/module/component/target catalog
  install --apply [--profile <name>|--pack <name>] [--project-root <dir>]
                                         apply generated harness outputs and state
  validate                               validate catalog and core profile
  doctor [--project-root <dir>] [--quick] [--gemini-smoke] [--json]
                                         local environment health check
  version

Review loop
  ask "<task>" [--profile quality|product|security] [--session <id>] [--project-root <dir>] [--json]
                                         question gate only; no provider calls or project mutation
  team "<task>" [--workers planner,research,product,security,test] [--no-write] [--session <id>] [--project-root <dir>] [--live] [--json]
                                         read-only multi-worker handoffs; no project mutation
  work "<task>" [--profile quality|security] [--single-executor] [--session <id>] [--project-root <dir>] [--live] [--json]
                                         single executor implement handoff; live mode captures isolated diff
  verify "<task>" --session <id> [--profile quality|security] [--strict-quality] [--secure] [--project-root <dir>] [--live] [--json]
                                         Codex-only verification of a prior work handoff
  gate status --session <id> [--project-root <dir>] [--json]
                                         inspect HUMAN_GATE / approval / block state
  gate approve --session <id> --reason <text> [--project-root <dir>] [--json]
                                         record explicit human approval for an open gate
  gate block --session <id> --reason <text> [--project-root <dir>] [--json]
                                         record explicit human block for a session
  ship "<task>" --session <id> [--require-clean-gates] [--project-root <dir>] [--live] [--json]
                                         ship/no-ship readiness handoff; blocked by HUMAN_GATE
  apply --session <id> [--project-root <dir>] [--allow-dirty] [--force] [--json]
                                         apply a verified SHIP_READY live-work diff to the target project
  run "<task>" [--session <id>] [--profile quality|security] [--strict-quality] [--secure] [--live] [--apply] [--allow-dirty] [--force] [--project-root <dir>] [--json]
                                         decomposed wrapper: work -> verify -> ship, optional apply
  build "<task>" [--mode fast|safe|team|tdd|release] [--session <id>] [--live] [--apply] [--project-root <dir>] [--json]
                                         one-command builder wrapper over read-only team thinking and run
  report --session <id> [--project-root <dir>] [--output <file>] [--stdout] [--json]
                                         summarize session evidence into REPORT.md; inspect-only
  review "<task>" [--secure] [--fast] [--no-ship] [--no-codex] [--live] [--session <id>] [--project-root <dir>]
                                         legacy full claude-led-codex-review workflow
  review-cycle "<task>" [--secure] [--fast] [--no-ship] [--no-codex] [--live] [--session <id>] [--project-root <dir>]
                                         explicit compatibility alias for the legacy full workflow
  plan "<task>" [--project-root <dir>]   ideate + plan only
  self-review                            reserved; use review for now
  codex-review                           reserved; use review for now

Options:
  --live      use local CLI sessions. Claude uses claude auth, Codex uses codex login.
              API keys are not needed for the default delegated CLI path.
  --project-root <dir>
              target project root for session/state/git work. Agents/schemas are read
              from the NEKOWORK install root.
  default     mock provider; no API keys or provider CLIs required

Advanced
  ralph "<task>" [--max-iter 5] [--engine review|run] [--secure] [--live] [--project-root <dir>]
                                         repeat until PRD acceptance criteria pass
  team-lite "<task>" [--live] [--session <id>] [--project-root <dir>]
                                         OMC-style staged team pipeline
  wait start                             start persistent daemon
  wait stop                              stop persistent daemon
  wait status                            daemon status

Sessions / cost / learning
  sessions                               list sessions
  costs --since=7d [--rows] [--json]     summarize cost estimates
  instincts list [--kind <k>] [--min-confidence <n>] [--json]
  instincts show <id>
  instincts ready [--max-stale-days N] [--min-diversity X] [--blocked]
                                         list promotion candidates; human confirmation required
  instincts promote <id>                 promote only at confidence 1.0
  instincts prune [--older-days N] [--dry-run]

Other
  validate, check, init, doctor, version, help
`);
}

async function dynamicReview(opts) {
  const { reviewCycle } = await import('./orchestrators/review.js');
  const result = await reviewCycle({
    ...opts,
    harnessRoot: ROOT,
    projectRoot: resolveProjectRoot(opts.projectRoot),
  });

  console.log('');
  console.log('=== result ===');
  console.log('  session    : ' + result.sessionId);
  console.log('  mode       : ' + (result.mode || 'legacy-full-review-cycle'));
  console.log('  handoffs   : ' + result.handoffs.length);
  console.log('  human gate : ' + (result.humanGate ? `YES (${result.reason})` : 'no'));
  console.log('  secure     : ' + (result.secureActive ? 'active' : 'off'));
  if (result.humanGate) process.exit(3);
}

function usageError(message) {
  const err = new Error(message);
  err.cliUsage = true;
  return err;
}

function parseReviewArgs(argv) {
  const opts = {
    task: '',
    live: false,
    secure: false,
    fast: false,
    noShip: false,
    noCodex: false,
    sessionId: null,
    projectRoot: null,
  };
  const unknown = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') opts.live = true;
    else if (a === '--secure') opts.secure = true;
    else if (a === '--fast') opts.fast = true;
    else if (a === '--no-ship') opts.noShip = true;
    else if (a === '--no-codex') opts.noCodex = true;
    else if (a === '--session') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--session requires a value');
      opts.sessionId = value;
    } else if (a === '--project-root') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--project-root requires a value');
      opts.projectRoot = value;
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = a.slice('--project-root='.length);
    } else if (a === '--max-iter') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--max-iter requires a value');
      opts.maxIter = Number(value);
    } else if (a.startsWith('--max-iter=')) {
      opts.maxIter = Number(a.slice('--max-iter='.length));
    } else if (a.startsWith('--')) {
      unknown.push(a);
    } else if (!opts.task) {
      opts.task = a;
    } else {
      opts.task += ' ' + a;
    }
  }

  if (unknown.length) throw usageError(`unknown flag: ${unknown.join(', ')}`);
  if (opts.secure && opts.fast) throw usageError('--secure and --fast cannot be used together');
  if (opts.noCodex && opts.secure) throw usageError('--no-codex and --secure cannot be used together');
  if (opts.maxIter != null && (!Number.isFinite(opts.maxIter) || opts.maxIter < 1)) {
    throw usageError('--max-iter must be a number >= 1');
  }

  return opts;
}

function parseRalphArgs(argv) {
  const reviewArgv = [];
  let engine = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--engine') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--engine requires a value');
      engine = value;
    } else if (a.startsWith('--engine=')) {
      engine = a.slice('--engine='.length);
    } else {
      reviewArgv.push(a);
    }
  }

  const opts = parseReviewArgs(reviewArgv);
  if (engine != null) {
    if (!['review', 'legacy-review', 'run'].includes(engine)) {
      throw usageError('--engine must be review or run');
    }
    opts.engine = engine;
  }
  return opts;
}

function parseAskArgs(argv) {
  const opts = {
    task: '',
    sessionId: null,
    projectRoot: null,
    profile: null,
    json: false,
  };
  const unknown = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--profile') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--profile requires a value');
      opts.profile = value;
    } else if (a.startsWith('--profile=')) {
      opts.profile = a.slice('--profile='.length);
    }
    else if (a === '--session') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--session requires a value');
      opts.sessionId = value;
    } else if (a === '--project-root') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--project-root requires a value');
      opts.projectRoot = value;
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = a.slice('--project-root='.length);
    } else if (a.startsWith('--session=')) {
      opts.sessionId = a.slice('--session='.length);
    } else if (a.startsWith('--')) {
      unknown.push(a);
    } else if (!opts.task) {
      opts.task = a;
    } else {
      opts.task += ' ' + a;
    }
  }

  if (unknown.length) throw usageError(`unknown flag: ${unknown.join(', ')}`);
  return opts;
}

function parseTeamArgs(argv) {
  const opts = {
    task: '',
    workers: null,
    noWrite: false,
    sessionId: null,
    projectRoot: null,
    live: false,
    json: false,
  };
  const unknown = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--live') opts.live = true;
    else if (a === '--no-write') opts.noWrite = true;
    else if (a === '--workers') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--workers requires a comma-separated value');
      opts.workers = value;
    } else if (a.startsWith('--workers=')) {
      opts.workers = a.slice('--workers='.length);
    } else if (a === '--session') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--session requires a value');
      opts.sessionId = value;
    } else if (a.startsWith('--session=')) {
      opts.sessionId = a.slice('--session='.length);
    } else if (a === '--project-root') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--project-root requires a value');
      opts.projectRoot = value;
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = a.slice('--project-root='.length);
    } else if (a.startsWith('--')) {
      unknown.push(a);
    } else if (!opts.task) {
      opts.task = a;
    } else {
      opts.task += ' ' + a;
    }
  }

  if (unknown.length) throw usageError(`unknown flag: ${unknown.join(', ')}`);
  return opts;
}

function parseWorkArgs(argv) {
  const opts = {
    task: '',
    singleExecutor: false,
    sessionId: null,
    projectRoot: null,
    profile: null,
    live: false,
    json: false,
  };
  const unknown = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--live') opts.live = true;
    else if (a === '--profile') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--profile requires a value');
      opts.profile = value;
    } else if (a.startsWith('--profile=')) {
      opts.profile = a.slice('--profile='.length);
    } else if (a === '--single-executor') opts.singleExecutor = true;
    else if (a === '--session') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--session requires a value');
      opts.sessionId = value;
    } else if (a.startsWith('--session=')) {
      opts.sessionId = a.slice('--session='.length);
    } else if (a === '--project-root') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--project-root requires a value');
      opts.projectRoot = value;
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = a.slice('--project-root='.length);
    } else if (a.startsWith('--')) {
      unknown.push(a);
    } else if (!opts.task) {
      opts.task = a;
    } else {
      opts.task += ' ' + a;
    }
  }

  if (unknown.length) throw usageError(`unknown flag: ${unknown.join(', ')}`);
  return opts;
}

function parseVerifyArgs(argv) {
  const opts = {
    task: '',
    requireCleanGates: false,
    sessionId: null,
    projectRoot: null,
    profile: null,
    live: false,
    secure: false,
    strictQuality: false,
    json: false,
  };
  const unknown = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--live') opts.live = true;
    else if (a === '--secure') opts.secure = true;
    else if (a === '--strict-quality') opts.strictQuality = true;
    else if (a === '--profile') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--profile requires a value');
      opts.profile = value;
    } else if (a.startsWith('--profile=')) {
      opts.profile = a.slice('--profile='.length);
    } else if (a === '--session') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--session requires a value');
      opts.sessionId = value;
    } else if (a.startsWith('--session=')) {
      opts.sessionId = a.slice('--session='.length);
    } else if (a === '--project-root') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--project-root requires a value');
      opts.projectRoot = value;
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = a.slice('--project-root='.length);
    } else if (a.startsWith('--')) {
      unknown.push(a);
    } else if (!opts.task) {
      opts.task = a;
    } else {
      opts.task += ' ' + a;
    }
  }

  if (unknown.length) throw usageError(`unknown flag: ${unknown.join(', ')}`);
  return opts;
}

function parseShipArgs(argv) {
  const opts = {
    task: '',
    sessionId: null,
    projectRoot: null,
    live: false,
    json: false,
  };
  const unknown = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--live') opts.live = true;
    else if (a === '--require-clean-gates') opts.requireCleanGates = true;
    else if (a === '--session') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--session requires a value');
      opts.sessionId = value;
    } else if (a.startsWith('--session=')) {
      opts.sessionId = a.slice('--session='.length);
    } else if (a === '--project-root') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--project-root requires a value');
      opts.projectRoot = value;
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = a.slice('--project-root='.length);
    } else if (a.startsWith('--')) {
      unknown.push(a);
    } else if (!opts.task) {
      opts.task = a;
    } else {
      opts.task += ' ' + a;
    }
  }

  if (unknown.length) throw usageError(`unknown flag: ${unknown.join(', ')}`);
  return opts;
}

function parseGateArgs(argv) {
  const opts = {
    action: argv[0] && !argv[0].startsWith('--') ? argv[0] : 'status',
    sessionId: null,
    projectRoot: null,
    reason: '',
    json: false,
  };
  const unknown = [];
  const start = opts.action === argv[0] ? 1 : 0;

  for (let i = start; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--session') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--session requires a value');
      opts.sessionId = value;
    } else if (a.startsWith('--session=')) {
      opts.sessionId = a.slice('--session='.length);
    } else if (a === '--project-root') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--project-root requires a value');
      opts.projectRoot = value;
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = a.slice('--project-root='.length);
    } else if (a === '--reason') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--reason requires a value');
      opts.reason = value;
    } else if (a.startsWith('--reason=')) {
      opts.reason = a.slice('--reason='.length);
    } else if (a.startsWith('--')) {
      unknown.push(a);
    } else if (opts.action === 'approve' || opts.action === 'block') {
      opts.reason = opts.reason ? `${opts.reason} ${a}` : a;
    } else {
      unknown.push(a);
    }
  }

  if (!['status', 'approve', 'block'].includes(opts.action)) {
    throw usageError(`unknown gate action: ${opts.action}`);
  }
  if (unknown.length) throw usageError(`unknown flag: ${unknown.join(', ')}`);
  if ((opts.action === 'approve' || opts.action === 'block') && !opts.reason) {
    throw usageError(`gate ${opts.action} requires --reason <text>`);
  }
  return opts;
}

function parseApplyArgs(argv) {
  const opts = {
    sessionId: null,
    projectRoot: null,
    allowDirty: false,
    force: false,
    json: false,
  };
  const unknown = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--allow-dirty') opts.allowDirty = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--session') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--session requires a value');
      opts.sessionId = value;
    } else if (a.startsWith('--session=')) {
      opts.sessionId = a.slice('--session='.length);
    } else if (a === '--project-root') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--project-root requires a value');
      opts.projectRoot = value;
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = a.slice('--project-root='.length);
    } else if (a.startsWith('--')) {
      unknown.push(a);
    } else {
      unknown.push(a);
    }
  }

  if (unknown.length) throw usageError(`unknown flag: ${unknown.join(', ')}`);
  return opts;
}

function parseRunArgs(argv) {
  const opts = {
    task: '',
    sessionId: null,
    projectRoot: null,
    profile: null,
    live: false,
    secure: false,
    strictQuality: false,
    apply: false,
    allowDirty: false,
    force: false,
    json: false,
  };
  const unknown = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--live') opts.live = true;
    else if (a === '--secure') opts.secure = true;
    else if (a === '--strict-quality') opts.strictQuality = true;
    else if (a === '--profile') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--profile requires a value');
      opts.profile = value;
    } else if (a.startsWith('--profile=')) {
      opts.profile = a.slice('--profile='.length);
    } else if (a === '--apply') opts.apply = true;
    else if (a === '--allow-dirty') opts.allowDirty = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--session') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--session requires a value');
      opts.sessionId = value;
    } else if (a.startsWith('--session=')) {
      opts.sessionId = a.slice('--session='.length);
    } else if (a === '--project-root') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--project-root requires a value');
      opts.projectRoot = value;
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = a.slice('--project-root='.length);
    } else if (a.startsWith('--')) {
      unknown.push(a);
    } else if (!opts.task) {
      opts.task = a;
    } else {
      opts.task += ' ' + a;
    }
  }

  if (unknown.length) throw usageError(`unknown flag: ${unknown.join(', ')}`);
  return opts;
}

function parseBuildArgs(argv) {
  const opts = {
    task: '',
    mode: 'fast',
    sessionId: null,
    projectRoot: null,
    profile: null,
    live: false,
    secure: false,
    strictQuality: false,
    team: false,
    workers: null,
    apply: false,
    allowDirty: false,
    force: false,
    json: false,
  };
  const unknown = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--live') opts.live = true;
    else if (a === '--secure') opts.secure = true;
    else if (a === '--strict-quality') opts.strictQuality = true;
    else if (a === '--team') opts.team = true;
    else if (a === '--mode') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--mode requires a value');
      opts.mode = value;
    } else if (a.startsWith('--mode=')) {
      opts.mode = a.slice('--mode='.length);
    } else if (a === '--profile') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--profile requires a value');
      opts.profile = value;
    } else if (a.startsWith('--profile=')) {
      opts.profile = a.slice('--profile='.length);
    } else if (a === '--workers') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--workers requires a value');
      opts.workers = value;
    } else if (a.startsWith('--workers=')) {
      opts.workers = a.slice('--workers='.length);
    } else if (a === '--apply') opts.apply = true;
    else if (a === '--allow-dirty') opts.allowDirty = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--session') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--session requires a value');
      opts.sessionId = value;
    } else if (a.startsWith('--session=')) {
      opts.sessionId = a.slice('--session='.length);
    } else if (a === '--project-root') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--project-root requires a value');
      opts.projectRoot = value;
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = a.slice('--project-root='.length);
    } else if (a.startsWith('--')) {
      unknown.push(a);
    } else if (!opts.task) {
      opts.task = a;
    } else {
      opts.task += ' ' + a;
    }
  }

  if (unknown.length) throw usageError(`unknown flag: ${unknown.join(', ')}`);
  return opts;
}

function parseReportArgs(argv) {
  const opts = {
    sessionId: null,
    projectRoot: null,
    outputPath: null,
    stdoutOnly: false,
    json: false,
  };
  const unknown = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--stdout') opts.stdoutOnly = true;
    else if (a === '--session') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--session requires a value');
      opts.sessionId = value;
    } else if (a.startsWith('--session=')) {
      opts.sessionId = a.slice('--session='.length);
    } else if (a === '--project-root') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--project-root requires a value');
      opts.projectRoot = value;
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = a.slice('--project-root='.length);
    } else if (a === '--output') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--output requires a value');
      opts.outputPath = value;
    } else if (a.startsWith('--output=')) {
      opts.outputPath = a.slice('--output='.length);
    } else if (a.startsWith('--')) {
      unknown.push(a);
    } else {
      unknown.push(a);
    }
  }

  if (unknown.length) throw usageError(`unknown flag: ${unknown.join(', ')}`);
  return opts;
}

function optionValue(argv, flag, fallback = undefined) {
  const i = argv.indexOf(flag);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  for (const a of argv) {
    if (a.startsWith(`${flag}=`)) return a.slice(flag.length + 1);
  }
  return fallback;
}

function optionNumber(argv, flag, fallback = undefined) {
  const value = optionValue(argv, flag, undefined);
  return value == null ? fallback : Number(value);
}

function hasOption(argv, flag) {
  return argv.includes(flag) || argv.some(a => a.startsWith(`${flag}=`));
}

function checkArgs(argv) {
  const full = argv.includes('--full');
  const filtered = argv.filter(a => a !== '--full');
  if (full || hasOption(filtered, '--quick')) return filtered;
  return ['--quick', ...filtered];
}

(async () => {
  switch (verb) {
    case 'check':
      run('doctor.js', checkArgs(rest));
      break;

    case 'init':
      run('install-apply.js', rest);
      break;

    case 'install': {
      const mode = rest.includes('--apply') ? 'apply' : 'plan';
      const filtered = rest.filter(a => a !== '--apply' && a !== '--plan');
      run(`install-${mode}.js`, filtered);
      break;
    }

    case 'validate':
      run('install-plan.js', ['--profile', 'core', '--verbose']);
      break;

    case 'doctor':
      run('doctor.js', rest);
      break;

    case 'ask': {
      const opts = parseAskArgs(rest);
      if (!opts.task) {
        console.error('task is required. Example: harness ask "trading dashboard mockup"');
        process.exit(2);
      }
      const { askGate } = await import('./orchestrators/ask.js');
      const result = await askGate({
        ...opts,
        harnessRoot: ROOT,
        projectRoot: resolveProjectRoot(opts.projectRoot),
      });
      if (opts.json) {
        console.log(JSON.stringify(result.handoff, null, 2));
      } else {
        console.log('=== ask ===');
        console.log('  session    : ' + result.sessionId);
        console.log('  risk       : ' + result.handoff.risk_level);
        console.log('  human gate : ' + (result.handoff.requires_human_gate ? 'required-if-continuing' : 'no'));
        console.log('  questions  : ' + result.handoff.questions.length);
        console.log('  handoff    : ' + path.relative(process.cwd(), path.join(result.sessionDir, 'handoffs', '00-question-gate.md')).replace(/\\/g, '/'));
      }
      break;
    }

    case 'team': {
      const opts = parseTeamArgs(rest);
      if (!opts.task) {
        console.error('task is required. Example: harness team "trading dashboard mockup"');
        process.exit(2);
      }
      const { teamCycle } = await import('./orchestrators/team.js');
      const result = await teamCycle({
        ...opts,
        harnessRoot: ROOT,
        projectRoot: resolveProjectRoot(opts.projectRoot),
      });
      if (opts.json) {
        console.log(JSON.stringify({
          sessionId: result.sessionId,
          workers: result.workers,
          tasks: result.tasks,
          handoffs: result.handoffs.length,
          recommendedNextStep: result.recommendedNextStep,
        }, null, 2));
      } else {
        console.log('=== team ===');
        console.log('  session    : ' + result.sessionId);
        console.log('  mode       : read-only');
        console.log('  workers    : ' + result.workers.join(', '));
        console.log('  handoffs   : ' + result.handoffs.length);
        console.log('  next step  : ' + result.recommendedNextStep);
        console.log('  summary    : ' + path.relative(process.cwd(), path.join(result.sessionDir, 'team-summary.json')).replace(/\\/g, '/'));
      }
      break;
    }

    case 'work': {
      const opts = parseWorkArgs(rest);
      if (!opts.task) {
        console.error('task is required. Example: harness work "implement trading dashboard mockup"');
        process.exit(2);
      }
      const { workCycle } = await import('./orchestrators/work.js');
      const result = await workCycle({
        ...opts,
        harnessRoot: ROOT,
        projectRoot: resolveProjectRoot(opts.projectRoot),
      });
      if (opts.json) {
        console.log(JSON.stringify({
          sessionId: result.sessionId,
          stage: result.handoff.stage,
          agent: result.handoff.agent,
          round: result.round,
          files: result.files,
          diffPath: result.diffPath,
          live: result.live,
        }, null, 2));
      } else {
        console.log('=== work ===');
        console.log('  session    : ' + result.sessionId);
        console.log('  executor   : ' + result.handoff.agent);
        console.log('  round      : ' + result.round);
        console.log('  files      : ' + result.files.length);
        console.log('  diff       : ' + (result.diffPath || '(none)'));
        console.log('  codex      : not run');
        console.log('  ship       : not run');
      }
      break;
    }

    case 'verify': {
      const opts = parseVerifyArgs(rest);
      if (!opts.task) {
        console.error('task is required. Example: harness verify "verify implemented dashboard" --session work-123');
        process.exit(2);
      }
      if (!opts.sessionId) {
        console.error('--session is required for verify so NEKOWORK can read the prior work handoff');
        process.exit(2);
      }
      const { verifyCycle } = await import('./orchestrators/verify.js');
      let result;
      try {
        result = await verifyCycle({
          ...opts,
          harnessRoot: ROOT,
          projectRoot: resolveProjectRoot(opts.projectRoot),
        });
      } catch (e) {
        if (/^verify requires/.test(e?.message || '')) throw usageError(e.message);
        throw e;
      }
      if (opts.json) {
        console.log(JSON.stringify({
          sessionId: result.sessionId,
          verdict: result.verdict,
          secureActive: result.secureActive,
          humanGate: result.humanGate,
          reason: result.reason,
          codexChallenge: Boolean(result.codexChallenge),
          strictQuality: result.strictQuality,
          strictQualityBlocked: result.strictQualityBlocked,
          qualityWarnings: result.qualityWarnings || [],
        }, null, 2));
      } else {
        console.log('=== verify ===');
        console.log('  session    : ' + result.sessionId);
        console.log('  verdict    : ' + result.verdict);
        console.log('  secure     : ' + (result.secureActive ? 'active' : 'off'));
        console.log('  challenge  : ' + (result.codexChallenge ? 'yes' : 'no'));
        console.log('  strict     : ' + (result.strictQuality ? (result.strictQualityBlocked ? 'blocked' : 'passed') : 'off'));
        console.log('  warnings   : ' + (result.qualityWarnings?.length || 0));
        console.log('  human gate : ' + (result.humanGate ? `YES (${result.reason})` : 'no'));
        console.log('  ship       : not run');
      }
      if (result.humanGate) process.exit(3);
      break;
    }

    case 'ship': {
      const opts = parseShipArgs(rest);
      if (!opts.sessionId) {
        console.error('--session is required for ship so NEKOWORK can read prior work and verify handoffs');
        process.exit(2);
      }
      const { shipCycle } = await import('./orchestrators/ship.js');
      let result;
      try {
        result = await shipCycle({
          ...opts,
          harnessRoot: ROOT,
          projectRoot: resolveProjectRoot(opts.projectRoot),
        });
      } catch (e) {
        if (/^ship requires/.test(e?.message || '')) throw usageError(e.message);
        throw e;
      }
      if (opts.json) {
        console.log(JSON.stringify({
          sessionId: result.sessionId,
          shipReady: result.shipReady,
          noShip: result.noShip,
          humanGate: result.humanGate,
          verdict: result.verdict,
          reason: result.reason,
          shipHandoff: Boolean(result.shipHandoff),
        }, null, 2));
      } else {
        console.log('=== ship ===');
        console.log('  session    : ' + result.sessionId);
        console.log('  status     : ' + (result.shipReady ? 'ready' : 'no-ship'));
        console.log('  verdict    : ' + result.verdict);
        console.log('  handoff    : ' + (result.shipHandoff ? 'written' : 'not written'));
        console.log('  human gate : ' + (result.humanGate ? `YES (${result.reason})` : 'no'));
        console.log('  mutation   : target project not mutated');
      }
      if (result.humanGate) process.exit(3);
      break;
    }

    case 'gate': {
      const opts = parseGateArgs(rest);
      if (!opts.sessionId) {
        console.error('--session is required for gate');
        process.exit(2);
      }
      const { gateCommand } = await import('./orchestrators/gate.js');
      let result;
      try {
        result = gateCommand({
          ...opts,
          projectRoot: resolveProjectRoot(opts.projectRoot),
        });
      } catch (e) {
        if (/^gate /.test(e?.message || '') || /^unknown gate action/.test(e?.message || '')) throw usageError(e.message);
        throw e;
      }
      if (opts.json) {
        console.log(JSON.stringify({
          sessionId: result.sessionId,
          status: result.status,
          humanGate: result.humanGate,
          approved: result.approved,
          blocked: result.blocked,
          reason: result.reason,
          humanGateReason: result.humanGateReason,
          approvalReason: result.approvalReason,
          blockReason: result.blockReason,
        }, null, 2));
      } else {
        console.log('=== gate ===');
        console.log('  session    : ' + result.sessionId);
        console.log('  status     : ' + result.status);
        console.log('  human gate : ' + (result.humanGate ? `YES (${result.humanGateReason || result.reason})` : 'no'));
        console.log('  approved   : ' + (result.approved ? `yes (${result.approvalReason || result.reason})` : 'no'));
        console.log('  blocked    : ' + (result.blocked ? `YES (${result.blockReason || result.reason})` : 'no'));
      }
      if (result.blocked || result.status === 'open') process.exit(3);
      break;
    }

    case 'apply': {
      const opts = parseApplyArgs(rest);
      if (!opts.sessionId) {
        console.error('--session is required for apply');
        process.exit(2);
      }
      const { applyCycle } = await import('./orchestrators/apply.js');
      let result;
      try {
        result = applyCycle({
          ...opts,
          projectRoot: resolveProjectRoot(opts.projectRoot),
        });
      } catch (e) {
        if (/^(apply requires|git apply failed)/.test(e?.message || '')) throw usageError(e.message);
        throw e;
      }
      if (opts.json) {
        console.log(JSON.stringify({
          sessionId: result.sessionId,
          applied: result.applied,
          alreadyApplied: result.alreadyApplied,
          humanGate: result.humanGate,
          noShip: result.noShip,
          reason: result.reason,
          diffPath: result.diffPath,
          files: result.files,
        }, null, 2));
      } else {
        console.log('=== apply ===');
        console.log('  session    : ' + result.sessionId);
        console.log('  applied    : ' + (result.applied ? 'yes' : 'no'));
        console.log('  already    : ' + (result.alreadyApplied ? 'yes' : 'no'));
        console.log('  human gate : ' + (result.humanGate ? 'YES' : 'no'));
        console.log('  no ship    : ' + (result.noShip ? 'YES' : 'no'));
        console.log('  diff       : ' + (result.diffPath || '(none)'));
        if (result.reason) console.log('  reason     : ' + result.reason);
      }
      if (result.humanGate || result.noShip) process.exit(3);
      break;
    }

    case 'run': {
      const opts = parseRunArgs(rest);
      if (!opts.task) {
        console.error('task is required. Example: harness run "implement and verify dashboard"');
        process.exit(2);
      }
      const { runCycle } = await import('./orchestrators/run.js');
      let result;
      try {
        result = await runCycle({
          ...opts,
          harnessRoot: ROOT,
          projectRoot: resolveProjectRoot(opts.projectRoot),
        });
      } catch (e) {
        if (/^(run requires|verify requires|ship requires|apply requires|git apply failed)/.test(e?.message || '')) throw usageError(e.message);
        throw e;
      }
      if (opts.json) {
        console.log(JSON.stringify({
          sessionId: result.sessionId,
          stoppedAt: result.stoppedAt,
          verdict: result.verdict,
          humanGate: result.humanGate,
          noShip: result.noShip,
          shipReady: result.shipReady,
          applyRequested: result.applyRequested,
          applySkippedReason: result.applySkippedReason,
          applied: result.applied,
          strictQuality: result.verify?.strictQuality,
          strictQualityBlocked: result.verify?.strictQualityBlocked,
        }, null, 2));
      } else {
        console.log('=== run ===');
        console.log('  session    : ' + result.sessionId);
        console.log('  stopped at : ' + result.stoppedAt);
        console.log('  verdict    : ' + result.verdict);
        console.log('  human gate : ' + (result.humanGate ? 'YES' : 'no'));
        console.log('  no ship    : ' + (result.noShip ? 'YES' : 'no'));
        console.log('  ship ready : ' + (result.shipReady ? 'yes' : 'no'));
        console.log('  strict     : ' + (result.verify?.strictQuality ? (result.verify?.strictQualityBlocked ? 'blocked' : 'passed') : 'off'));
        console.log('  apply      : ' + (result.applied ? 'applied' : result.applyRequested ? `skipped (${result.applySkippedReason || 'not needed'})` : 'not requested'));
      }
      if (result.humanGate || (opts.apply && (result.noShip || result.applySkippedReason))) process.exit(3);
      break;
    }

    case 'build': {
      const opts = parseBuildArgs(rest);
      if (!opts.task) {
        console.error('task is required. Example: harness build "implement and verify dashboard" --mode fast');
        process.exit(2);
      }
      const { buildCycle } = await import('./orchestrators/build.js');
      let result;
      try {
        result = await buildCycle({
          ...opts,
          harnessRoot: ROOT,
          projectRoot: resolveProjectRoot(opts.projectRoot),
        });
      } catch (e) {
        if (/^(build requires|unknown build mode|run requires|verify requires|ship requires|apply requires|team worker|git apply failed)/.test(e?.message || '')) throw usageError(e.message);
        throw e;
      }
      if (opts.json) {
        console.log(JSON.stringify({
          sessionId: result.sessionId,
          mode: result.mode,
          profile: result.profile,
          strictQuality: result.strictQuality,
          secure: result.secure,
          teamRun: Boolean(result.team),
          stoppedAt: result.run?.stoppedAt,
          verdict: result.verdict,
          humanGate: result.humanGate,
          noShip: result.noShip,
          shipReady: result.shipReady,
          applied: result.applied,
        }, null, 2));
      } else {
        console.log('=== build ===');
        console.log('  session    : ' + result.sessionId);
        console.log('  mode       : ' + result.mode);
        console.log('  profile    : ' + (result.profile || 'none'));
        console.log('  team       : ' + (result.team ? `read-only (${result.team.workers.join(',')})` : 'off'));
        console.log('  stopped at : ' + result.run?.stoppedAt);
        console.log('  verdict    : ' + result.verdict);
        console.log('  human gate : ' + (result.humanGate ? 'YES' : 'no'));
        console.log('  no ship    : ' + (result.noShip ? 'YES' : 'no'));
        console.log('  ship ready : ' + (result.shipReady ? 'yes' : 'no'));
        console.log('  apply      : ' + (result.applied ? 'applied' : result.run?.applyRequested ? `skipped (${result.run.applySkippedReason || 'not needed'})` : 'not requested'));
      }
      if (result.humanGate || (opts.apply && (result.noShip || result.run?.applySkippedReason))) process.exit(3);
      break;
    }

    case 'report': {
      const opts = parseReportArgs(rest);
      if (!opts.sessionId) {
        console.error('--session is required for report');
        process.exit(2);
      }
      const { reportSession } = await import('./orchestrators/report.js');
      let result;
      try {
        result = reportSession({
          ...opts,
          projectRoot: resolveProjectRoot(opts.projectRoot),
        });
      } catch (e) {
        if (/^report requires/.test(e?.message || '')) throw usageError(e.message);
        throw e;
      }
      if (opts.stdoutOnly) process.stdout.write(result.markdown);
      if (opts.json) {
        console.log(JSON.stringify({
          sessionId: result.sessionId,
          status: result.status,
          verdict: result.verdict,
          mode: result.mode,
          profile: result.profile,
          strictQuality: result.strictQuality,
          strictQualityBlocked: result.strictQualityBlocked,
          shipReady: result.shipReady,
          noShip: result.noShip,
          humanGate: result.humanGate,
          applied: result.applied,
          handoffs: result.handoffs,
          qualityWarnings: result.qualityWarnings.length,
          reportPath: result.reportPath,
        }, null, 2));
      } else if (!opts.stdoutOnly) {
        console.log('=== report ===');
        console.log('  session    : ' + result.sessionId);
        console.log('  status     : ' + result.status);
        console.log('  verdict    : ' + (result.verdict || 'n/a'));
        console.log('  human gate : ' + (result.humanGate ? 'YES' : 'no'));
        console.log('  no ship    : ' + (result.noShip ? 'YES' : 'no'));
        console.log('  applied    : ' + (result.applied ? 'yes' : 'no'));
        console.log('  warnings   : ' + result.qualityWarnings.length);
        console.log('  report     : ' + path.relative(process.cwd(), result.reportPath).replace(/\\/g, '/'));
      }
      break;
    }

    case 'review':
    case 'review-cycle': {
      const opts = parseReviewArgs(rest);
      if (!opts.task) {
        console.error(`task is required. Example: harness ${verb} "add JWT validation"`);
        process.exit(2);
      }
      await dynamicReview(opts);
      break;
    }

    case 'ralph': {
      const opts = parseRalphArgs(rest);
      if (!opts.task) {
        console.error('task is required. Example: harness ralph "feature X" --max-iter 5');
        process.exit(2);
      }
      const { ralphLoop } = await import('./orchestrators/ralph.js');
      const r = await ralphLoop({
        ...opts,
        harnessRoot: ROOT,
        projectRoot: resolveProjectRoot(opts.projectRoot),
      });
      console.log('=== ralph done ===');
      console.log(JSON.stringify(r, null, 2));
      if (r.reason === 'human_gate') process.exit(3);
      break;
    }

    case 'team-lite': {
      const opts = parseReviewArgs(rest);
      if (!opts.task) {
        console.error('task is required. Example: harness team-lite "refactor auth guard"');
        process.exit(2);
      }
      const { teamLiteCycle } = await import('./orchestrators/team-lite.js');
      const r = await teamLiteCycle({
        ...opts,
        harnessRoot: ROOT,
        projectRoot: resolveProjectRoot(opts.projectRoot),
      });
      console.log('=== team-lite done ===');
      console.log('  session  : ' + r.sessionId);
      console.log('  tasks    : ' + r.tasks.map(t => `${t.id}:${t.status}`).join(', '));
      console.log('  handoffs : ' + r.handoffs.length);
      console.log('  verdict  : ' + r.verdict);
      break;
    }

    case 'wait':
      run('daemon/wait.js', rest.length ? rest : ['status']);
      break;

    case 'plan': {
      const opts = parseReviewArgs(rest);
      opts.fast = false;
      opts.noShip = true;
      const { reviewCycle } = await import('./orchestrators/review.js');
      const result = await reviewCycle({
        ...opts,
        harnessRoot: ROOT,
        projectRoot: resolveProjectRoot(opts.projectRoot),
        stopAfter: 'plan',
      });
      console.log('handoffs:', result.handoffs.map(h => h.stage).join(' -> '));
      break;
    }

    case 'self-review':
    case 'codex-review':
      console.error(`${verb} is reserved. Use the review workflow for now.`);
      process.exit(2);

    case 'instincts': {
      const sub = rest[0] || 'list';
      const { list: iList, get: iGet, promote: iPromote, prune: iPrune } = await import('./lib/instincts.js');

      if (sub === 'list') {
        const minConfidence = optionNumber(rest, '--min-confidence', 0);
        const kind = optionValue(rest, '--kind', undefined);
        const rows = iList({ kind, minConfidence });

        if (rest.includes('--json')) {
          console.log(JSON.stringify(rows, null, 2));
        } else {
          console.log(`total=${rows.length} (kind=${kind || 'any'}, min-confidence=${minConfidence})`);
          for (const r of rows) {
            const mark = r.promoted ? '[PROMOTED]' : (r.confidence >= 1 ? '[READY]' : '');
            console.log(`  ${r.id}  ${r.kind.padEnd(15)} count=${String(r.count).padStart(3)} conf=${r.confidence.toFixed(2)} ${mark} ${r.key}`);
          }
        }
      } else if (sub === 'show') {
        const id = rest[1];
        if (!id) {
          console.error('id is required');
          process.exit(2);
        }
        const inst = iGet(id);
        if (!inst) {
          console.error('not found');
          process.exit(1);
        }
        console.log(JSON.stringify(inst, null, 2));
      } else if (sub === 'ready') {
        const { ready: iReady } = await import('./lib/instincts.js');
        const maxStaleDays = optionNumber(rest, '--max-stale-days', 14);
        const minDiversity = optionNumber(rest, '--min-diversity', 0.5);
        const r = iReady({ maxStaleDays, minDiversity });

        if (rest.includes('--json')) {
          console.log(JSON.stringify(r, null, 2));
        } else {
          console.log(`promotion candidates=${r.ready.length} (max-stale-days=${maxStaleDays}, min-diversity=${minDiversity})`);
          for (const x of r.ready) {
            console.log(`  ${x.id}  ${x.kind.padEnd(15)} count=${x.count} div=${x.diversity}  ${x.key}`);
          }
          if (rest.includes('--blocked')) {
            console.log(`\nblocked=${r.blocked.length}`);
            for (const x of r.blocked) console.log(`  ${x.id}  ${x.reason}  ${x.key}`);
          }
          console.log('\nPromotion requires explicit command: harness instincts promote <id>');
        }
      } else if (sub === 'promote') {
        const id = rest[1];
        if (!id) {
          console.error('id is required');
          process.exit(2);
        }
        const r = iPromote(id);
        console.log(`promoted: ${r.id} (${r.key})`);
      } else if (sub === 'prune') {
        const dryRun = rest.includes('--dry-run');
        const olderDays = optionNumber(rest, '--older-days', undefined);
        const r = iPrune({ olderDays, dryRun });
        console.log(`removed=${r.removed.length}, kept=${r.kept}, dry_run=${r.dry_run}`);
        if (rest.includes('--rows')) {
          for (const x of r.removed) console.log(`  - ${x.id} ${x.kind} ${x.key}`);
        }
      } else {
        console.error(`unknown subverb: ${sub}. list | show <id> | ready | promote <id> | prune`);
        process.exit(2);
      }
      break;
    }

    case 'costs': {
      const since = optionValue(rest, '--since', '7d');
      const { list, summarize } = await import('./lib/costs.js');
      const rows = list({ since });
      const sum = summarize(rows);
      console.log(`since=${since}, rows=${sum.rows}, total=$${sum.total_usd}`);
      console.log('by_provider:', JSON.stringify(sum.by_provider));
      console.log('by_model   :', JSON.stringify(sum.by_model));
      if (rest.includes('--json')) {
        console.log(JSON.stringify({ since, summary: sum, rows }, null, 2));
      } else if (rest.includes('--rows')) {
        for (const r of rows.slice(-20)) console.log('  ' + JSON.stringify(r));
      }
      break;
    }

    case 'sessions': {
      const sessionsProjectRoot = optionValue(rest, '--project-root', null);
      const dir = path.join(resolveProjectRoot(sessionsProjectRoot), '.harness', 'state', 'sessions');
      if (!fs.existsSync(dir)) {
        console.log('(no sessions)');
        break;
      }
      for (const s of fs.readdirSync(dir)) {
        const sd = path.join(dir, s);
        const handoffs = fs.existsSync(path.join(sd, 'handoffs'))
          ? fs.readdirSync(path.join(sd, 'handoffs')).filter(f => f.endsWith('.md')).length
          : 0;
        const gate = fs.existsSync(path.join(sd, 'HUMAN_GATE')) ? ' [HUMAN_GATE]' : '';
        console.log(`  ${s}  handoffs=${handoffs}${gate}`);
      }
      break;
    }

    case 'version':
    case '--version':
    case '-v': {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
      console.log(`harness ${pkg.version}`);
      break;
    }

    case undefined:
    case 'help':
    case '--help':
    case '-h':
      help();
      break;

    default:
      console.error(`unknown verb: ${verb}`);
      help();
      process.exit(2);
  }
})().catch((e) => {
  if (e?.cliUsage) {
    console.error(e.message);
    process.exit(2);
  }
  console.error('UNEXPECTED:', e?.stack || e);
  process.exit(1);
});
