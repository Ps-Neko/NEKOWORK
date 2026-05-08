import fs from 'node:fs';
import path from 'node:path';
import { runCycle } from './run.js';
import { teamCycle } from './team.js';

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

export function normalizeBuildMode(mode) {
  const value = String(mode || 'fast').trim().toLowerCase();
  if (!MODE_PRESETS[value]) {
    throw new Error(`unknown build mode: ${value}. available: ${Object.keys(MODE_PRESETS).join(', ')}`);
  }
  return value;
}

export function buildModePreset(mode) {
  const normalized = normalizeBuildMode(mode);
  return { mode: normalized, ...MODE_PRESETS[normalized] };
}

export async function buildCycle(opts) {
  const harnessRoot = opts.harnessRoot || process.cwd();
  const projectRoot = opts.projectRoot || harnessRoot;
  if (!opts.task) throw new Error('build requires a task');

  const preset = buildModePreset(opts.mode);
  const sessionId = opts.sessionId || `build-${Date.now()}`;
  const profile = opts.profile || preset.profile;
  const strictQuality = opts.strictQuality || preset.strictQuality;
  const secure = opts.secure || preset.secure;

  let team = null;
  if (preset.team || opts.team) {
    team = await teamCycle({
      task: opts.task,
      sessionId,
      harnessRoot,
      projectRoot,
      workers: opts.workers || preset.workers,
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

function writeSummary(result, preset) {
  if (!result.sessionDir) return;
  fs.mkdirSync(result.sessionDir, { recursive: true });
  fs.writeFileSync(path.join(result.sessionDir, 'build-summary.json'), JSON.stringify({
    sessionId: result.sessionId,
    mode: result.mode,
    mode_description: preset.description,
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
    safety_invariants: [
      'Build may coordinate multiple read-only perspectives, but only one executor writes.',
      'Codex verification remains required before ship/apply.',
      'Apply is explicit and evidence-based.',
    ],
    next_step: result.nextStep,
  }, null, 2));
}

function nextStep(run) {
  if (run.humanGate) return 'resolve the human gate before continuing';
  if (run.noShip) return 'fix findings, rerun verify, then rerun build/ship';
  if (run.applied) return 'review git diff, run project tests, then commit manually';
  if (run.shipReady) return 'run report, then optionally apply a verified live-work diff';
  return 'inspect build-summary.json and run-summary.json';
}
