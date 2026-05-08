import fs from 'node:fs';
import path from 'node:path';
import { runCycle } from './run.js';
import { teamCycle } from './team.js';
import { normalizeAcceptanceCriteria } from '../lib/acceptance-criteria.js';
import { analyzeBuildIntent } from '../lib/build-intelligence.js';

const MODE_PRESETS = {
  fast: {
    profile: 'quality',
    strictQuality: false,
    secure: false,
    team: false,
    description: 'fast implementation with Codex verification and explicit apply only',
  },
  safe: {
    profile: 'security',
    strictQuality: true,
    secure: true,
    team: false,
    description: 'security-sensitive implementation with strict evidence and Codex challenge',
  },
  team: {
    profile: 'quality',
    strictQuality: false,
    secure: false,
    team: true,
    workers: 'planner,product,security,test',
    description: 'read-only team thinking before single-executor implementation',
  },
  tdd: {
    profile: 'quality',
    strictQuality: true,
    secure: false,
    team: false,
    description: 'test-first quality mode with strict acceptance evidence',
  },
  release: {
    profile: 'quality',
    strictQuality: false,
    secure: false,
    team: false,
    description: 'release-readiness mode with ship/report evidence before apply',
  },
};

const AUTO_PRESET = {
  profile: null,
  strictQuality: false,
  secure: false,
  team: false,
  description: 'task-aware mode routing before the safe build loop',
};

const MODE_SAFETY_RANK = {
  fast: 0,
  team: 1,
  tdd: 1,
  release: 2,
  safe: 3,
};

const RISK_AWARE_TAGS = new Set(['security', 'financial', 'deploy', 'data']);

export function normalizeBuildMode(mode) {
  const value = String(mode || 'auto').trim().toLowerCase();
  if (value !== 'auto' && !MODE_PRESETS[value]) {
    throw new Error(`unknown build mode: ${value}. available: ${availableModes().join(', ')}`);
  }
  return value;
}

export function buildModePreset(mode) {
  const normalized = normalizeBuildMode(mode);
  if (normalized === 'auto') return { mode: 'auto', ...AUTO_PRESET };
  return { mode: normalized, ...MODE_PRESETS[normalized] };
}

export async function buildCycle(opts) {
  const harnessRoot = opts.harnessRoot || process.cwd();
  const projectRoot = opts.projectRoot || harnessRoot;
  if (!opts.task) throw new Error('build requires a task');

  if (opts.dryRun) {
    return buildPlan({ ...opts, harnessRoot, projectRoot });
  }

  const config = resolveBuildConfig(opts);
  const { preset, sessionId, profile, strictQuality, secure } = config;
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  writeIntelligenceArtifacts(sessionDir, opts.task, config);

  let team = null;
  if (config.teamRun) {
    team = await teamCycle({
      task: opts.task,
      sessionId,
      harnessRoot,
      projectRoot,
      workers: config.teamWorkers,
      live: !!opts.live,
      dispatcher: opts.dispatcher,
    });
  }

  const run = await runCycle({
    task: opts.task,
    sessionId,
    harnessRoot,
    projectRoot,
    profile,
    strictQuality,
    secure,
    live: !!opts.live,
    apply: !!opts.apply,
    allowDirty: !!opts.allowDirty,
    force: !!opts.force,
    dispatcher: opts.dispatcher,
  });

  const result = {
    sessionId,
    sessionDir: run.sessionDir,
    mode: preset.mode,
    requestedMode: config.requestedMode,
    autoMode: config.autoMode,
    intelligence: config.intelligence,
    modeOverride: config.modeOverride,
    profile,
    strictQuality,
    secure,
    team,
    run,
    humanGate: run.humanGate,
    noShip: run.noShip,
    shipReady: run.shipReady,
    applied: run.applied,
    verdict: run.verdict,
    nextStep: nextStep(run),
  };
  writeSummary(result, preset);
  return result;
}

export function buildPlan(opts) {
  const config = resolveBuildConfig(opts);
  const { preset, sessionId, profile, strictQuality, secure, teamRun, teamWorkers } = config;
  const applyRequested = Boolean(opts.apply);
  return {
    dryRun: true,
    task: opts.task,
    sessionId,
    mode: preset.mode,
    requestedMode: config.requestedMode,
    autoMode: config.autoMode,
    modeDescription: preset.description,
    intelligence: config.intelligence,
    modeOverride: config.modeOverride,
    profile,
    strictQuality,
    secure,
    live: Boolean(opts.live),
    applyRequested,
    allowDirty: Boolean(opts.allowDirty),
    force: Boolean(opts.force),
    teamRun,
    teamWorkers: teamRun ? splitWorkers(teamWorkers) : [],
    stages: [
      {
        stage: 'team',
        runs: teamRun,
        mutation: 'read-only',
        workers: teamRun ? splitWorkers(teamWorkers) : [],
      },
      {
        stage: 'work',
        runs: true,
        mutation: 'single-executor',
        output: opts.live ? 'captured live-work diff plus implement handoff' : 'implement handoff',
      },
      {
        stage: 'verify',
        runs: true,
        provider: 'codex',
        challenge: secure,
        strictQuality,
      },
      {
        stage: 'ship',
        runs: true,
        output: 'ship/no-ship readiness evidence',
      },
      {
        stage: 'apply',
        runs: applyRequested,
        condition: 'explicit --apply, SHIP_READY, clear gates, and captured live-work diff',
      },
    ],
    safetyInvariants: safetyInvariants(),
    nextStep: applyRequested
      ? 'run build without --dry-run when ready; apply will still require verified ship-ready evidence'
      : 'run build without --dry-run when ready; inspect report before any explicit apply',
  };
}

function resolveBuildConfig(opts) {
  const requestedMode = normalizeBuildMode(opts.mode);
  const intelligence = requestedMode === 'auto'
    ? analyzeBuildIntent({ task: opts.task })
    : null;
  const explicitModeRecommendation = requestedMode === 'auto'
    ? null
    : analyzeBuildIntent({ task: opts.task });
  const modeOverride = modeOverridePolicy({
    requestedMode,
    recommendation: explicitModeRecommendation,
    forceMode: Boolean(opts.forceMode),
  });
  const selectedMode = intelligence?.recommendedMode || requestedMode;
  const preset = buildModePreset(selectedMode);
  const sessionId = opts.sessionId || `build-${Date.now()}`;
  const profile = opts.profile || intelligence?.profile || preset.profile;
  const strictQuality = Boolean(opts.strictQuality || intelligence?.strictQuality || preset.strictQuality);
  const secure = Boolean(opts.secure || intelligence?.secure || intelligence?.requiresCodexChallenge || preset.secure);
  const teamRun = Boolean(preset.team || intelligence?.team || opts.team);
  const teamWorkers = opts.workers || (intelligence?.workers || []).join(',') || preset.workers || '';

  return {
    preset,
    requestedMode,
    autoMode: requestedMode === 'auto',
    intelligence,
    modeOverride,
    sessionId,
    profile,
    strictQuality,
    secure,
    teamRun,
    teamWorkers,
  };
}

function modeOverridePolicy({ requestedMode, recommendation, forceMode }) {
  if (requestedMode === 'auto' || !recommendation) {
    return {
      checked: false,
      forced: false,
      blocked: false,
      recommendedMode: null,
      reason: null,
      explanation: [],
    };
  }

  const riskyOverride = requiresForceForModeOverride(requestedMode, recommendation);
  const policy = {
    checked: true,
    forced: Boolean(forceMode && riskyOverride),
    blocked: Boolean(riskyOverride && !forceMode),
    requestedMode,
    recommendedMode: recommendation.recommendedMode,
    taskType: recommendation.taskType,
    risk: recommendation.risk,
    tags: recommendation.tags,
    reason: riskyOverride
      ? `task appears ${recommendation.taskType}; recommended mode is ${recommendation.recommendedMode} but ${requestedMode} was requested`
      : null,
    explanation: riskyOverride ? recommendation.explanation : [],
  };

  if (policy.blocked) {
    const err = new Error(`${policy.reason}. Use --mode ${recommendation.recommendedMode} or pass --force-mode to continue with ${requestedMode}.`);
    err.code = 'BUILD_MODE_OVERRIDE_BLOCKED';
    err.policy = policy;
    throw err;
  }

  return policy;
}

function requiresForceForModeOverride(requestedMode, recommendation) {
  if (!recommendation || requestedMode === recommendation.recommendedMode) return false;
  if (!isRiskAwareRecommendation(recommendation)) return false;
  return modeSafetyRank(requestedMode) < modeSafetyRank(recommendation.recommendedMode);
}

function isRiskAwareRecommendation(recommendation) {
  return recommendation.risk === 'high' ||
    recommendation.risk === 'critical' ||
    recommendation.requiresHumanGate ||
    recommendation.requiresCodexChallenge ||
    (recommendation.tags || []).some(tag => RISK_AWARE_TAGS.has(tag));
}

function modeSafetyRank(mode) {
  return MODE_SAFETY_RANK[mode] ?? 0;
}

function availableModes() {
  return ['auto', ...Object.keys(MODE_PRESETS)];
}

function splitWorkers(workers) {
  return String(workers || '').split(',').map(w => w.trim()).filter(Boolean);
}

function writeIntelligenceArtifacts(sessionDir, task, config) {
  if (!config.autoMode || !config.intelligence) return;
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, 'build-intelligence.json'), JSON.stringify(config.intelligence, null, 2));

  const criteria = normalizeAcceptanceCriteria(config.intelligence.acceptanceCriteria, 'build-intelligence-v0');
  fs.writeFileSync(path.join(sessionDir, 'acceptance-criteria.json'), JSON.stringify({
    source: 'build-intelligence-v0',
    generated: true,
    required: true,
    criteria,
    updated_at: new Date().toISOString(),
  }, null, 2));

  fs.writeFileSync(path.join(sessionDir, 'build-plan.json'), JSON.stringify({
    source: 'build-intelligence-v0',
    task,
    selected_mode: config.preset.mode,
    requested_mode: config.requestedMode,
    mini_plan: config.intelligence.miniPlan,
    self_check: config.intelligence.selfCheck,
    reasons: config.intelligence.reasons,
    explanation: config.intelligence.explanation,
    updated_at: new Date().toISOString(),
  }, null, 2));
}

function writeSummary(result, preset) {
  if (!result.sessionDir) return;
  fs.mkdirSync(result.sessionDir, { recursive: true });
  fs.writeFileSync(path.join(result.sessionDir, 'build-summary.json'), JSON.stringify({
    sessionId: result.sessionId,
    mode: result.mode,
    requested_mode: result.requestedMode,
    auto_mode: result.autoMode,
    mode_description: preset.description,
    build_intelligence: result.intelligence ? {
      version: result.intelligence.version,
      task_type: result.intelligence.taskType,
      recommended_mode: result.intelligence.recommendedMode,
      risk: result.intelligence.risk,
      tags: result.intelligence.tags,
      reasons: result.intelligence.reasons,
      explanation: result.intelligence.explanation,
      workers: result.intelligence.workers,
    } : null,
    mode_override: result.modeOverride || null,
    profile: result.profile,
    strict_quality: result.strictQuality,
    secure: result.secure,
    team_run: Boolean(result.team),
    team_workers: result.team?.workers || [],
    run_stopped_at: result.run?.stoppedAt || null,
    verdict: result.verdict,
    ship_ready: result.shipReady,
    no_ship: result.noShip,
    human_gate: result.humanGate,
    applied: result.applied,
    safety_invariants: safetyInvariants(),
    next_step: result.nextStep,
  }, null, 2));
}

function safetyInvariants() {
  return [
    'Build may coordinate multiple read-only perspectives, but only one executor writes.',
    'Codex verification remains required before ship/apply.',
    'Apply is explicit and evidence-based.',
  ];
}

function nextStep(run) {
  if (run.humanGate) return 'resolve the human gate before continuing';
  if (run.noShip) return 'fix findings, rerun verify, then rerun build/ship';
  if (run.applied) return 'review git diff, run project tests, then commit manually';
  if (run.shipReady) return 'run report, then optionally apply a verified live-work diff';
  return 'inspect build-summary.json and run-summary.json';
}
