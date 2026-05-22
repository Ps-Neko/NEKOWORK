import fs from 'node:fs';
import path from 'node:path';
import { workCycle } from './work.js';
import { verifyCycle } from './verify.js';
import { shipCycle } from './ship.js';
import { applyCycle } from './apply.js';
import { writeDecision } from '../lib/decision.js';

export async function runCycle(opts) {
  const harnessRoot = opts.harnessRoot || process.cwd();
  const projectRoot = opts.projectRoot || harnessRoot;
  if (!opts.task) throw new Error('run requires a task');

  const sessionId = opts.sessionId || `run-${Date.now()}`;
  const base = {
    task: opts.task,
    sessionId,
    harnessRoot,
    projectRoot,
    live: !!opts.live,
    profile: opts.profile,
    strictQuality: !!opts.strictQuality,
    dispatcher: opts.dispatcher,
  };

  const work = await workCycle(base);
  const verify = await verifyCycle({
    ...base,
    secure: !!opts.secure,
  });

  if (verify.humanGate) {
    return finishRun({
      sessionId,
      sessionDir: verify.sessionDir,
      work,
      verify,
      ship: null,
      apply: null,
      applyRequested: !!opts.apply,
      applySkippedReason: 'human gate from verify',
      stoppedAt: 'verify',
    });
  }

  const ship = await shipCycle(base);
  let apply = null;
  let applySkippedReason = null;

  if (opts.apply) {
    if (!ship.shipReady) {
      applySkippedReason = ship.reason || 'ship is not ready';
    } else {
      apply = applyCycle({
        sessionId,
        projectRoot,
        allowDirty: !!opts.allowDirty,
        force: !!opts.force,
      });
    }
  }

  return finishRun({
    sessionId,
    sessionDir: ship.sessionDir,
    work,
    verify,
    ship,
    apply,
    applyRequested: !!opts.apply,
    applySkippedReason,
    stoppedAt: stoppedAt({ verify, ship, apply, applyRequested: !!opts.apply, applySkippedReason }),
  });
}

function finishRun({ sessionId, sessionDir, work, verify, ship, apply, applyRequested, applySkippedReason, stoppedAt }) {
  const result = {
    sessionId,
    sessionDir,
    stoppedAt,
    work,
    verify,
    ship,
    apply,
    applyRequested,
    applySkippedReason,
    humanGate: Boolean(verify?.humanGate || ship?.humanGate || apply?.humanGate),
    noShip: Boolean(ship?.noShip || apply?.noShip),
    shipReady: Boolean(ship?.shipReady),
    applied: Boolean(apply?.applied),
    verdict: apply?.applied
      ? 'applied'
      : ship?.verdict || verify?.verdict || work?.handoff?.verdict || 'unknown',
  };
  writeSummary(sessionDir, result);
  return result;
}

function stoppedAt({ verify, ship, apply, applyRequested, applySkippedReason }) {
  if (verify?.humanGate) return 'verify';
  if (ship?.humanGate) return 'ship';
  if (apply?.humanGate || apply?.noShip) return 'apply';
  if (apply?.applied || apply?.alreadyApplied) return 'apply';
  if (applyRequested && applySkippedReason) return 'ship';
  return 'ship';
}

function writeSummary(sessionDir, result) {
  if (!sessionDir) return;
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, 'run-summary.json'), JSON.stringify({
    sessionId: result.sessionId,
    stopped_at: result.stoppedAt,
    work_round: result.work?.round || null,
    work_files: result.work?.files || [],
    acceptance_required: true,
    acceptance_count: result.work?.handoff ? readAcceptanceCount(sessionDir) : 0,
    profile: result.work?.handoff?.profile || result.verify?.profile || null,
    strict_quality: Boolean(result.verify?.strictQuality),
    strict_quality_blocked: Boolean(result.verify?.strictQualityBlocked),
    verify_verdict: result.verify?.verdict || null,
    verify_human_gate: Boolean(result.verify?.humanGate),
    ship_ready: result.shipReady,
    no_ship: result.noShip,
    human_gate: result.humanGate,
    apply_requested: result.applyRequested,
    apply_skipped_reason: result.applySkippedReason,
    applied: result.applied,
    verdict: result.verdict,
    target_project_mutated: result.applied,
    next_step: nextStep(result),
  }, null, 2));
  writeDecision(sessionDir, { sessionId: result.sessionId, stage: 'run' });
}

function readAcceptanceCount(sessionDir) {
  try {
    const raw = fs.readFileSync(path.join(sessionDir, 'acceptance-criteria.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.criteria) ? parsed.criteria.length : 0;
  } catch {
    return 0;
  }
}

function nextStep(result) {
  if (result.humanGate) return 'resolve the human gate before continuing';
  if (result.noShip) return 'fix findings, rerun verify, then rerun run/ship';
  if (result.applied) return 'review git diff, run project tests, then commit manually';
  if (result.applyRequested && result.applySkippedReason) return 'resolve ship readiness before applying';
  if (result.shipReady) return 'optionally run apply for live captured diffs';
  return 'inspect run-summary.json';
}
