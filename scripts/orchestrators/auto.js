import fs from 'node:fs';
import path from 'node:path';
import { buildCycle, buildPlan } from './build.js';
import { reportSession } from './report.js';
import {
  normalizeParallelCandidateCount,
  parallelCandidatePlan,
  runParallelCandidates,
} from '../lib/parallel-candidates.js';

const AUTONOMY_LEVELS = {
  cautious: {
    maxRounds: 1,
    repair: false,
    maxFilesChanged: 6,
    maxDiffLines: 300,
    description: 'one verified build attempt; stop for human review before any repair loop',
  },
  normal: {
    maxRounds: 3,
    repair: true,
    maxFilesChanged: 10,
    maxDiffLines: 600,
    description: 'bounded repair loop for fixable findings, then report and gate/apply boundary',
  },
  aggressive: {
    maxRounds: 5,
    repair: true,
    maxFilesChanged: 20,
    maxDiffLines: 1200,
    description: 'larger repair budget, still no automatic apply, commit, push, publish, or deploy',
  },
};

export function normalizeAutoLevel(level) {
  const value = String(level || 'normal').trim().toLowerCase();
  if (!AUTONOMY_LEVELS[value]) {
    throw new Error(`unknown autonomy level: ${value}. available: ${Object.keys(AUTONOMY_LEVELS).join(', ')}`);
  }
  return value;
}

export function autoPlan(opts) {
  const harnessRoot = opts.harnessRoot || process.cwd();
  const projectRoot = opts.projectRoot || harnessRoot;
  if (!opts.task) throw new Error('auto requires a task');

  const sessionId = opts.sessionId || `auto-${Date.now()}`;
  const policy = resolveAutonomyPolicy(opts);
  const parallelCandidates = parallelCandidatePlan({ count: opts.parallelCandidates, task: opts.task });
  const build = buildPlan({
    ...opts,
    harnessRoot,
    projectRoot,
    sessionId,
    mode: opts.mode || 'auto',
    apply: false,
    dryRun: true,
  });

  return {
    dryRun: true,
    task: opts.task,
    sessionId,
    level: policy.level,
    policy,
    requestedMode: build.requestedMode,
    mode: build.mode,
    build,
    parallelCandidates,
    stages: autonomyStages(build, policy, parallelCandidates),
    applyRequested: false,
    safetyInvariants: safetyInvariants(),
    nextStep: 'run auto without --dry-run when ready; it will stop at report/gate and never auto-apply',
  };
}

export async function autoCycle(opts) {
  const harnessRoot = opts.harnessRoot || process.cwd();
  const projectRoot = opts.projectRoot || harnessRoot;
  if (!opts.task) throw new Error('auto requires a task');

  if (opts.dryRun) {
    return autoPlan({ ...opts, harnessRoot, projectRoot });
  }

  const sessionId = opts.sessionId || `auto-${Date.now()}`;
  const policy = resolveAutonomyPolicy(opts);
  const parallelCandidateCount = normalizeParallelCandidateCount(opts.parallelCandidates);
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  const parallelCandidates = await runParallelCandidates({
    count: parallelCandidateCount,
    task: opts.task,
    sessionId,
    sessionDir,
    harnessRoot,
    projectRoot,
    live: !!opts.live,
    dispatcher: opts.dispatcher,
  });
  const rounds = [];
  let lastBuild = null;
  let stopReason = null;

  for (let round = 1; round <= policy.maxRounds; round++) {
    const build = await buildCycle({
      ...opts,
      harnessRoot,
      projectRoot,
      sessionId,
      mode: opts.mode || 'auto',
      apply: false,
      task: round === 1 ? opts.task : repairTask(opts.task, round),
      dryRun: false,
    });

    lastBuild = build;
    rounds.push(roundSummary(round, build));

    if (build.humanGate) {
      stopReason = 'human gate required';
      break;
    }
    if (build.shipReady) {
      stopReason = 'ship ready';
      break;
    }
    if (!build.noShip) {
      stopReason = 'workflow stopped without no-ship marker';
      break;
    }
    if (!policy.repair) {
      stopReason = 'repair disabled by autonomy level';
      break;
    }
    if (round >= policy.maxRounds) {
      stopReason = 'repair budget exhausted';
      break;
    }
  }

  const result = {
    sessionId,
    sessionDir: lastBuild?.sessionDir || sessionDir,
    task: opts.task,
    level: policy.level,
    policy,
    parallelCandidates,
    requestedMode: lastBuild?.requestedMode || opts.mode || 'auto',
    mode: lastBuild?.mode || null,
    rounds,
    finalBuild: lastBuild,
    report: null,
    stopReason,
    humanGate: Boolean(lastBuild?.humanGate),
    noShip: Boolean(lastBuild?.noShip),
    shipReady: Boolean(lastBuild?.shipReady),
    applied: false,
    nextStep: nextStep(lastBuild, stopReason),
    safetyInvariants: safetyInvariants(),
  };
  writeSummary(result);
  result.report = reportSession({ sessionId, projectRoot });
  writeSummary(result);
  return result;
}

function resolveAutonomyPolicy(opts) {
  const level = normalizeAutoLevel(opts.level);
  const base = AUTONOMY_LEVELS[level];
  return {
    level,
    description: base.description,
    maxRounds: positiveInteger(opts.maxRounds ?? opts.budget, base.maxRounds),
    repair: base.repair,
    maxFilesChanged: positiveInteger(opts.maxFilesChanged, base.maxFilesChanged),
    maxDiffLines: positiveInteger(opts.maxDiffLines, base.maxDiffLines),
    stopBeforeApply: true,
    noAutoCommit: true,
    noAutoPush: true,
    noAutoPublish: true,
    noAutoDeploy: true,
  };
}

function positiveInteger(value, fallback) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function autonomyStages(build, policy, parallelCandidates = null) {
  return [
    {
      stage: 'route',
      runs: true,
      output: 'task risk, mode, profile, workers, and acceptance criteria',
    },
    {
      stage: 'parallel-candidates',
      runs: Boolean(parallelCandidates?.enabled),
      mutation: 'isolated evidence only',
      candidates: parallelCandidates?.count || 0,
      output: 'candidate patch evidence; no ship-ready canonical diff in alpha.10 preview',
    },
    ...build.stages.filter(stage => stage.stage !== 'apply'),
    {
      stage: 'repair-loop',
      runs: policy.repair,
      budget: policy.maxRounds,
      condition: 'fixable no-ship findings only; stop on Human Gate or budget exhaustion',
    },
    {
      stage: 'report',
      runs: true,
      output: 'REPORT.md plus auto-summary.json',
    },
    {
      stage: 'apply-boundary',
      runs: true,
      mutation: 'none',
      output: 'stop before apply; human must explicitly run apply after verified ship-ready evidence',
    },
  ];
}

function repairTask(task, round) {
  return `${task}\n\nRepair round ${round}: address the previous verification findings, keep changes within the autonomy budget, and preserve the original acceptance criteria.`;
}

function roundSummary(round, build) {
  return {
    round,
    mode: build.mode,
    requested_mode: build.requestedMode,
    profile: build.profile,
    strict_quality: build.strictQuality,
    secure: build.secure,
    verdict: build.verdict,
    stopped_at: build.run?.stoppedAt || null,
    human_gate: Boolean(build.humanGate),
    no_ship: Boolean(build.noShip),
    ship_ready: Boolean(build.shipReady),
    applied: Boolean(build.applied),
    next_step: build.nextStep,
  };
}

function writeSummary(result) {
  if (!result.sessionDir) return;
  fs.mkdirSync(result.sessionDir, { recursive: true });
  fs.writeFileSync(path.join(result.sessionDir, 'auto-summary.json'), JSON.stringify({
    sessionId: result.sessionId,
    task: result.task,
    level: result.level,
    policy: result.policy,
    requested_mode: result.requestedMode,
    selected_mode: result.mode,
    rounds: result.rounds,
    parallel_candidates: result.parallelCandidates ? {
      status: result.parallelCandidates.status,
      count: result.parallelCandidates.count,
      candidates: result.parallelCandidates.candidates,
      arbiter: result.parallelCandidates.arbiter,
      target_project_mutated: false,
    } : null,
    stop_reason: result.stopReason,
    report_path: result.report?.reportPath || null,
    ship_ready: result.shipReady,
    no_ship: result.noShip,
    human_gate: result.humanGate,
    applied: false,
    safety_invariants: result.safetyInvariants,
    next_step: result.nextStep,
    updated_at: new Date().toISOString(),
  }, null, 2));
}

function nextStep(build, stopReason) {
  if (!build) return 'inspect auto-summary.json';
  if (build.humanGate) return 'resolve Human Gate before any apply or ship action';
  if (build.noShip) return stopReason === 'repair budget exhausted'
    ? 'inspect report and decide whether to run another bounded auto cycle'
    : 'inspect report and decide whether to repair manually or rerun auto with a larger budget';
  if (build.shipReady) return 'inspect report, then optionally run apply for a verified live-work diff';
  return 'inspect report and auto-summary.json';
}

function safetyInvariants() {
  return [
    'Auto mode may plan, build, verify, and repair within budget before apply.',
    'Parallel candidates are evidence-only until one canonical diff is selected and verified.',
    'Only one executor writes during each work round.',
    'Codex verification remains required before ship/apply.',
    'Human Gate cannot be bypassed by autonomy level.',
    'Apply, commit, push, publish, and deploy are never automatic.',
  ];
}
