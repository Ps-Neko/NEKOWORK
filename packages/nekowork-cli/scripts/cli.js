#!/usr/bin/env node
// NEKOWORK CLI entrypoint. The `harness` bin remains a legacy/internal alias.
// Public verbs: cockpit, guided, check, init, doctor, start, build, report, apply, ask, plan, team, work, verify, gate, ship (alias: ready), run, auto, pr-prep, review, review-cycle, install, validate, version.
// Advanced verbs: self-review, codex-review, ralph, wait, sessions, costs, instincts.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAutoCommand } from './cli/commands/auto-command.js';
import { runBuildCommand } from './cli/commands/build-command.js';
import { runCockpitCommand } from './cli/commands/cockpit-command.js';
import { paint, kvBlock, nextBlock } from './lib/ui-format.js';
import { normalizeFlags } from './lib/flag-normalize.js';
import { renderError } from './lib/ui-errors.js';
import { resolveSessionId } from './lib/session-resolver.js';
import { isNewId } from './lib/session-id.js';

function displayShortId(sessionId) {
  return isNewId(sessionId) ? sessionId.split('-').pop() : sessionId;
}

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

function readPkgVersion() {
  try {
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  } catch { return 'unknown'; }
}

function countSessions(projectRoot) {
  try {
    const dir = path.join(projectRoot || process.cwd(), '.harness', 'state', 'sessions');
    return fs.readdirSync(dir).length;
  } catch { return 0; }
}

function shortHelp() {
  const version = readPkgVersion();
  const root = process.cwd();
  const installed = fs.existsSync(path.join(root, '.harness')) ? 'yes' : 'no';
  const sessions = countSessions(root);
  printShortGateHelp({ version, root, installed, sessions });
}

function printShortGateHelp({ version, root, installed, sessions }) {
  console.log('');
  console.log(`  ${paint('ok', 'NEKOWORK')} ${version}`);
  console.log('  ' + paint('dim', `project: ${root}  |  installed: ${installed}  |  sessions: ${sessions}`));
  console.log('');
  console.log(paint('hint', 'First run ->'));
  console.log(`  1.  ${paint('hint', 'nekowork check')}        environment check`);
  console.log(`  2.  ${paint('hint', 'nekowork verify-pr')}    deterministic risk rules on the working tree diff`);
  console.log(`  3.  ${paint('hint', 'cat REPORT.md')}          read the verdict + evidence paths`);
  console.log('');
  console.log(paint('hint', 'CI ->'));
  console.log(`  ${paint('hint', 'nekowork verify-pr --comment-file .nekowork/pr-comment.md')}`);
  console.log(`  ${paint('hint', 'nekowork verify-pr --ci-exit-soft')}   exit 0 for NEEDS_REVIEW / INSUFFICIENT_EVIDENCE`);
  console.log(`  ${paint('hint', 'nekowork verify-pr --run-checks')}     run test/lint/typecheck; failure -> NEEDS_REVIEW (opt-in)`);
  console.log('');
  console.log(paint('hint', 'Compat / labs ->'));
  console.log(`  ${paint('hint', 'nekowork help all')}      session-based start / report / apply and others (deprecation pending)`);
  console.log('');
  console.log('  ' + paint('dim', "Verb help: 'nekowork help <verb>'"));
  console.log('');
}

function fullHelp() {
  console.log(`
nekowork <verb> [args]

Legacy alias:
  harness <verb> [args]

Recommended verification gate (1.0 front surface)
  check                                local readiness probe
  verify-pr [--from-working-tree]       deterministic risk rules → REPORT.md + .nekowork/decision.json
  verify-pr --comment-file <path>       GitHub PR comment markdown for CI integration
  verify-pr --ci-exit-soft              treat NEEDS_HUMAN_REVIEW / INSUFFICIENT_EVIDENCE as exit 0
  verify-pr --run-checks                run test/lint/typecheck; failure -> NEEDS_REVIEW (opt-in)

Compatibility / labs (session-based; deprecation pending)
  cockpit                              guided choice-first launcher (legacy)
  start "<task>" [--session <id>]      session-based safe build entrypoint
  report --session <id>                 summarize session evidence
  apply --session <id>                  apply a verified SHIP_READY live-work diff

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
  cockpit [--preview] [--project-root <dir>] [--json]
                                         guided terminal cockpit; choose the next safe action
  start "<task>" [--dry-run] [--explain] [--session <id>] [--live] [--project-root <dir>] [--json]
                                         beginner alias for build; one safe entrypoint before report/apply
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
  build "<task>" [--mode auto|fast|safe|team|tdd|release] [--dry-run] [--explain] [--force-mode] [--session <id>] [--live] [--apply] [--project-root <dir>] [--json]
                                         one-command builder wrapper; auto mode routes task intent safely
  auto "<task>" [--level cautious|normal|aggressive] [--budget N] [--parallel-candidates N] [--mode auto|fast|safe|team|tdd|release] [--dry-run] [--explain] [--session <id>] [--live] [--project-root <dir>] [--json]
                                         bounded autonomy before apply: route, build, verify, repair within budget, report, stop
  report --session <id> [--project-root <dir>] [--output <file>] [--stdout] [--json]
                                         summarize session evidence into REPORT.md; inspect-only
  pr-prep ["task"] [--session <id>] [--project-root <dir>] [--json]
                                         generate PR_SUMMARY/RISK_NOTES/TEST_EVIDENCE/CHANGELOG_DRAFT without branch, commit, push, or PR creation
  review "<task>" [--secure] [--fast] [--no-ship] [--no-codex] [--live] [--session <id>] [--project-root <dir>]
                                         legacy full nekowork-full-cycle workflow
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
  instincts adopt <id> --reviewed-by <name> --reason <text>
                                         adopt a ready pattern only after human review
  instincts promote <id> --reviewed-by <name> --reason <text>
                                         legacy alias for adopt
  instincts prune [--older-days N] [--dry-run]

Other
  validate, check, init, doctor, cockpit, version, help
`);
}

function help() { fullHelp(); }

const VERB_HELP = {
  cockpit: () => {
    console.log('');
    console.log('nekowork cockpit [--preview] [--project-root <dir>]');
    console.log('');
    console.log('  Guided choice-first launcher. Shows a project cockpit, recommended next action,');
    console.log('  session evidence, safety defaults, and menu choices for start/report/apply.');
    console.log('');
    console.log('Options:');
    console.log('  --preview             render the cockpit without prompting');
    console.log('  --no-interactive      same as preview; useful in scripts');
    console.log('  --project-root <dir>  target project root');
    console.log('  --json                machine-readable cockpit state');
    console.log('');
    console.log('Examples:');
    console.log('  nekowork');
    console.log('  nekowork cockpit --preview');
    console.log('  nekowork cockpit --project-root ../my-app');
    console.log('');
  },
  start: () => {
    console.log('');
    console.log('nekowork start "<task>" [options]');
    console.log('');
    console.log('  Safe beginner entrypoint. Routes the task through build intelligence, writes');
    console.log('  evidence, and stops before apply.');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run             show planned mode, risk, and workers');
    console.log('  --explain             print routing and evidence summary');
    console.log('  --session <id>        write artifacts to a named session');
    console.log('  --live                use local provider CLIs');
    console.log('  --project-root <dir>  target project root');
    console.log('  --json                machine-readable output');
    console.log('');
    console.log('Next:');
    console.log('  nekowork report --session <id>');
    console.log('  nekowork apply --session <id>');
    console.log('');
  },
  auto: () => {
    console.log('');
    console.log('nekowork auto "<task>" [options]');
    console.log('');
    console.log('  Bounded autonomy before apply: route, build, verify, repair within budget,');
    console.log('  report, and stop. It never commits, pushes, deploys, publishes, or applies.');
    console.log('');
    console.log('Options:');
    console.log('  --level cautious|normal|aggressive');
    console.log('  --budget N');
    console.log('  --parallel-candidates N');
    console.log('  --mode auto|fast|safe|team|tdd|release');
    console.log('  --dry-run');
    console.log('  --explain');
    console.log('  --session <id>');
    console.log('  --live');
    console.log('  --project-root <dir>');
    console.log('  --json');
    console.log('');
  },
  ready: () => {
    console.log('');
    console.log('nekowork ready --session <id>');
    console.log('');
    console.log('  Inspect ship readiness. Alias for the ship readiness decision; this is not');
    console.log('  a deployment and it does not mutate the target project.');
    console.log('');
    console.log('Examples:');
    console.log('  nekowork ready --session latest');
    console.log('  nekowork ready --session auth-fix --json');
    console.log('');
  },
  report: () => {
    console.log('');
    console.log('nekowork report --session <id> [options]');
    console.log('');
    console.log('  Render recorded session evidence into REPORT.md. Inspect-only.');
    console.log('');
    console.log('Options:');
    console.log('  --session <id>');
    console.log('  --output <file>');
    console.log('  --stdout');
    console.log('  --json');
    console.log('');
  },
  apply: () => {
    console.log('');
    console.log('nekowork apply --session <id> [options]');
    console.log('');
    console.log('  Explicit apply boundary. Refuses without verified SHIP_READY evidence and');
    console.log('  clear Human Gate state. Never commits, pushes, deploys, or publishes.');
    console.log('');
    console.log('Options:');
    console.log('  --session <id>');
    console.log('  --allow-dirty');
    console.log('  --force');
    console.log('  --json');
    console.log('');
  },
  'pr-prep': () => {
    console.log('');
    console.log('nekowork pr-prep ["task"] --session <id>');
    console.log('');
    console.log('  Generate PR_SUMMARY, RISK_NOTES, TEST_EVIDENCE, CHANGELOG_DRAFT, and');
    console.log('  SHIP_DECISION from a verified session. No branch, commit, push, or PR is made.');
    console.log('');
  },
  work: () => {
    console.log('');
    console.log('nekowork work "<task>" [options]');
    console.log('');
    console.log('  단일 executor 구현 핸드오프. 코드 변경을 생성한 뒤 verify로 넘긴다.');
    console.log('');
    console.log('Options:');
    console.log('  --profile quality|security|product   강조점 (기본: quality)');
    console.log('  --strict                              TDD/품질 강화');
    console.log('  --live                                실 제공자 사용 (없으면 mock)');
    console.log('  --session <id>                        기존 세션에 이어붙임 (prefix 가능)');
    console.log('  --project-root <dir>                  대상 프로젝트 루트');
    console.log('  --json                                머신 파싱용 출력');
    console.log('');
    console.log('예시:');
    console.log('  nekowork work "BOM 출력 컬럼에 단가 추가"');
    console.log('  nekowork work "타이틀바 다크모드" --profile quality --strict');
    console.log('');
  },
  verify: () => {
    console.log('');
    console.log('nekowork verify "<task>" --session <id> [options]');
    console.log('');
    console.log('  앞선 work 핸드오프를 Codex로만 검증한다.');
    console.log('');
    console.log('Options:');
    console.log('  --session <id>                        대상 세션 (prefix 가능)');
    console.log('  --profile quality|security|product   강조점');
    console.log('  --strict                              TDD/품질 강화');
    console.log('  --live                                실 제공자 사용');
    console.log('  --json                                머신 파싱용 출력');
    console.log('');
    console.log('예시:');
    console.log('  nekowork verify "BOM 단가 추가" --session a3f7');
    console.log('  nekowork verify --session a3f7   # task 생략 (세션이 보유)');
    console.log('');
  },
};

function verbHelp(verb) {
  const renderer = VERB_HELP[verb];
  if (renderer) { renderer(); return 0; }
  console.error(`알 수 없는 동사: ${verb}`);
  console.error(`전체 명령은: nekowork help all`);
  return 2;
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

function safeNormalizeFlags(argv, helpRef) {
  try {
    return normalizeFlags(argv, { warn: console.error });
  } catch (e) {
    console.error(renderError({
      message: e.message,
      helpRef,
    }));
    process.exit(2);
  }
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
    contextFile: null,
    domainFile: null,
    specFile: null,
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
    } else if (a === '--context-file') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--context-file requires a value');
      opts.contextFile = value;
    } else if (a.startsWith('--context-file=')) {
      opts.contextFile = a.slice('--context-file='.length);
    } else if (a === '--domain-file') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--domain-file requires a value');
      opts.domainFile = value;
    } else if (a.startsWith('--domain-file=')) {
      opts.domainFile = a.slice('--domain-file='.length);
    } else if (a === '--spec-file') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--spec-file requires a value');
      opts.specFile = value;
    } else if (a.startsWith('--spec-file=')) {
      opts.specFile = a.slice('--spec-file='.length);
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
    contextFile: null,
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
    else if (a === '--context-file') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--context-file requires a value');
      opts.contextFile = value;
    } else if (a.startsWith('--context-file=')) {
      opts.contextFile = a.slice('--context-file='.length);
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
    contextFile: null,
    domainFile: null,
    specFile: null,
    planFile: null,
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
    } else if (a === '--context-file') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--context-file requires a value');
      opts.contextFile = value;
    } else if (a.startsWith('--context-file=')) {
      opts.contextFile = a.slice('--context-file='.length);
    } else if (a === '--domain-file') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--domain-file requires a value');
      opts.domainFile = value;
    } else if (a.startsWith('--domain-file=')) {
      opts.domainFile = a.slice('--domain-file='.length);
    } else if (a === '--spec-file') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--spec-file requires a value');
      opts.specFile = value;
    } else if (a.startsWith('--spec-file=')) {
      opts.specFile = a.slice('--spec-file='.length);
    } else if (a === '--plan-file') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--plan-file requires a value');
      opts.planFile = value;
    } else if (a.startsWith('--plan-file=')) {
      opts.planFile = a.slice('--plan-file='.length);
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
    strict: false,
    planFile: null,
  };
  const unknown = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--live') opts.live = true;
    else if (a === '--strict') opts.strict = true;
    else if (a === '--profile') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--profile requires a value');
      opts.profile = value;
    } else if (a.startsWith('--profile=')) {
      opts.profile = a.slice('--profile='.length);
    } else if (a === '--plan-file') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--plan-file requires a value');
      opts.planFile = value;
    } else if (a.startsWith('--plan-file=')) {
      opts.planFile = a.slice('--plan-file='.length);
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
    else if (a === '--strict') opts.strictQuality = true;
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

function parsePrPrepArgs(argv) {
  const opts = {
    task: '',
    sessionId: 'latest',
    projectRoot: null,
    json: false,
  };
  const unknown = [];

  for (let i = 0; i < argv.length; i++) {
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
  if (verb && verb !== 'help' && (rest.includes('--help') || rest.includes('-h'))) {
    process.exit(verbHelp(verb));
  }

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

    case 'cockpit':
    case 'guided': {
      const result = await runCockpitCommand({
        argv: rest,
        cliPath: path.join(__dirname, 'cli.js'),
        version: readPkgVersion(),
        resolveProjectRoot,
      });
      if (result.exitCode) process.exit(result.exitCode);
      break;
    }

    case 'doctor':
      run('doctor.js', rest);
      break;

    case 'ask': {
      const opts = parseAskArgs(rest);
      if (!opts.task) {
        console.error('task is required. Example: nekowork ask "trading dashboard mockup"');
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
        console.error('task is required. Example: nekowork team "trading dashboard mockup"');
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
      const normalizedArgv = safeNormalizeFlags(process.argv.slice(3), 'nekowork help work');
      const opts = parseWorkArgs(normalizedArgv);
      if (!opts.task) {
        console.error(renderError({
          message: 'task 인수가 필요합니다.',
          examples: [
            'nekowork work "BOM 출력 컬럼에 단가 추가"',
            'nekowork work "타이틀바 다크모드"',
          ],
          helpRef: 'nekowork help work',
        }));
        process.exit(2);
      }
      if (opts.sessionId) {
        try {
          opts.sessionId = resolveSessionId(resolveProjectRoot(opts.projectRoot), opts.sessionId);
        } catch (e) {
          console.error(renderError({
            message: `세션 ID '${opts.sessionId}' 가 모호합니다.`,
            examples: [String(e.message)],
            helpRef: 'nekowork sessions',
          }));
          process.exit(2);
        }
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
        const fileCount = Array.isArray(result.handoff?.files) ? result.handoff.files.length : 0;
        const round = result.handoff?.round ?? 1;
        const shortId = displayShortId(result.sessionId);

        console.log('');
        console.log(`  ${paint('ok', '✓')} work 완료              ${paint('dim', `round ${round} · ${fileCount} files`)}`);
        console.log(kvBlock([
          ['session', paint('hint', result.sessionId)],
          ['diff',    (result.handoff?.diffPath || result.diffPath) ? '(generated)' : '(none — 다음 단계에서 생성)'],
          ['codex',   result.handoff?.codex ? 'ok' : 'not run'],
          ['ship',    result.handoff?.ship  ? 'ready' : 'not run'],
        ]));
        console.log('');
        console.log(nextBlock([
          { cmd: `nekowork verify --session ${shortId}`, note: 'Codex 검증 (필수)' },
          { cmd: `nekowork report --session ${result.sessionId}`, note: 'evidence 미리 보기' },
          { cmd: `nekowork gate status --session ${result.sessionId}`, note: 'HUMAN_GATE 확인' },
        ]));
        console.log('');
      }
      break;
    }

    case 'verify': {
      const normalizedArgv = safeNormalizeFlags(process.argv.slice(3), 'nekowork help verify');
      const opts = parseVerifyArgs(normalizedArgv);

      if (!opts.sessionId) {
        console.error(renderError({
          message: '--session 인자가 필요합니다.',
          examples: [
            'nekowork verify --session a3f7',
            'nekowork verify "원본 task" --session a3f7',
          ],
          helpRef: 'nekowork help verify',
        }));
        process.exit(2);
      }

      let resolvedSessionId;
      try {
        resolvedSessionId = resolveSessionId(resolveProjectRoot(opts.projectRoot), opts.sessionId);
      } catch (e) {
        console.error(renderError({
          message: `세션 ID '${opts.sessionId}' 가 모호합니다.`,
          examples: [String(e.message)],
          helpRef: 'nekowork sessions',
        }));
        process.exit(2);
      }

      const { verifyCycle } = await import('./orchestrators/verify.js');
      let result;
      try {
        result = await verifyCycle({
          ...opts,
          sessionId: resolvedSessionId,
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
        const fileCount = Array.isArray(result.codexReview?.files) ? result.codexReview.files.length : 0;
        const round = result.codexReview?.round ?? 1;
        const shortId = displayShortId(result.sessionId);

        console.log('');
        console.log(`  ${paint('ok', '✓')} verify 완료            ${paint('dim', `round ${round} · ${fileCount} files reviewed`)}`);
        console.log(kvBlock([
          ['session', paint('hint', result.sessionId)],
          ['codex',   result.codexReview ? 'ok' : 'not run'],
          ['verdict', result.verdict ?? '-'],
          ['gate',    result.humanGate ? 'HUMAN_GATE open' : 'clear'],
        ]));
        console.log('');
        console.log(nextBlock([
          { cmd: `nekowork ship --session ${result.sessionId}`, note: 'ship 준비 확인' },
          { cmd: `nekowork report --session ${result.sessionId}`, note: 'REPORT.md 생성' },
          { cmd: `nekowork gate status --session ${result.sessionId}`, note: 'gate 상태' },
        ]));
        console.log('');
      }
      if (result.humanGate) process.exit(3);
      break;
    }

    case 'verify-pr': {
      const { parseVerifyPrArgs, printVerifyPrSummary, verifyPrCycle } =
        await import('./orchestrators/verify-pr.js');
      const opts = parseVerifyPrArgs(rest);
      const result = await verifyPrCycle({
        ...opts,
        projectRoot: resolveProjectRoot(opts.projectRoot),
      });
      if (opts.json) {
        console.log(JSON.stringify(result.decision, null, 2));
      } else {
        printVerifyPrSummary(result);
      }
      process.exit(result.exitCode);
    }

    case 'ready':
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
        console.error('task is required. Example: nekowork run "implement and verify dashboard"');
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

    case 'start':
    case 'build': {
      const result = await runBuildCommand({
        argv: rest,
        harnessRoot: ROOT,
        resolveProjectRoot,
        usageError,
      });
      if (result.exitCode) process.exit(result.exitCode);
      break;
    }

    case 'auto': {
      const result = await runAutoCommand({
        argv: rest,
        harnessRoot: ROOT,
        resolveProjectRoot,
        usageError,
      });
      if (result.exitCode) process.exit(result.exitCode);
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

    case 'pr-prep': {
      const opts = parsePrPrepArgs(rest);
      const { prPrepSession } = await import('./orchestrators/pr-prep.js');
      let result;
      try {
        result = prPrepSession({
          ...opts,
          projectRoot: resolveProjectRoot(opts.projectRoot),
        });
      } catch (e) {
        if (/^pr-prep requires/.test(e?.message || '')) throw usageError(e.message);
        throw e;
      }
      if (opts.json) {
        console.log(JSON.stringify({
          sessionId: result.sessionId,
          status: result.status,
          decision: result.decision,
          readyForPr: result.readyForPr,
          shipReady: result.shipReady,
          noShip: result.noShip,
          humanGate: result.humanGate,
          applied: result.applied,
          artifacts: result.artifacts,
          reportPath: result.reportPath,
          targetProjectMutated: result.targetProjectMutated,
          noRemoteMutation: result.noRemoteMutation,
        }, null, 2));
      } else {
        console.log('=== pr-prep ===');
        console.log('  session    : ' + result.sessionId);
        console.log('  decision   : ' + result.decision);
        console.log('  ready PR   : ' + (result.readyForPr ? 'yes' : 'no'));
        console.log('  human gate : ' + (result.humanGate ? 'YES' : 'no'));
        console.log('  no ship    : ' + (result.noShip ? 'YES' : 'no'));
        console.log('  artifacts  : ' + result.artifacts.join(', '));
        console.log('  report     : ' + path.relative(process.cwd(), result.reportPath).replace(/\\/g, '/'));
        console.log('  remote     : none');
      }
      if (!result.readyForPr) process.exit(3);
      break;
    }

    case 'review':
    case 'review-cycle': {
      const opts = parseReviewArgs(rest);
      if (!opts.task) {
        console.error(`task is required. Example: nekowork ${verb} "add JWT validation"`);
        process.exit(2);
      }
      await dynamicReview(opts);
      break;
    }

    case 'ralph': {
      const opts = parseRalphArgs(rest);
      if (!opts.task) {
        console.error('task is required. Example: nekowork ralph "feature X" --max-iter 5');
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
        console.error('task is required. Example: nekowork team-lite "refactor auth guard"');
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
          console.log('\nAdoption requires explicit human review: harness instincts adopt <id> --reviewed-by <name> --reason <text>');
        }
      } else if (sub === 'adopt' || sub === 'promote') {
        const id = rest[1];
        if (!id) {
          console.error('id is required');
          process.exit(2);
        }
        const reviewedBy = optionValue(rest, '--reviewed-by', undefined);
        const reason = optionValue(rest, '--reason', undefined);
        const r = iPromote(id, { reviewedBy, reason });
        console.log(`adopted: ${r.id} (${r.key}) reviewed_by=${r.reviewed_by}`);
      } else if (sub === 'prune') {
        const dryRun = rest.includes('--dry-run');
        const olderDays = optionNumber(rest, '--older-days', undefined);
        const r = iPrune({ olderDays, dryRun });
        console.log(`removed=${r.removed.length}, kept=${r.kept}, dry_run=${r.dry_run}`);
        if (rest.includes('--rows')) {
          for (const x of r.removed) console.log(`  - ${x.id} ${x.kind} ${x.key}`);
        }
      } else {
        console.error(`unknown subverb: ${sub}. list | show <id> | ready | adopt <id> | promote <id> | prune`);
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
      if (process.stdin.isTTY && process.stdout.isTTY && process.env.NEKOWORK_NO_INTERACTIVE !== '1' && !process.env.CI) {
        const result = await runCockpitCommand({
          argv: [],
          cliPath: path.join(__dirname, 'cli.js'),
          version: readPkgVersion(),
          resolveProjectRoot,
        });
        if (result.exitCode) process.exit(result.exitCode);
      } else {
        shortHelp();
      }
      process.exit(0);
      break;

    case '--help':
    case '-h':
      shortHelp();
      process.exit(0);
      break;

    case 'help': {
      const subArg = process.argv[3];
      if (!subArg || subArg === 'all') {
        fullHelp();
        process.exit(0);
      }
      process.exit(verbHelp(subArg));
      break;
    }

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
