import fs from 'node:fs';
import path from 'node:path';
import { applyExecutionDiff } from '../core/execution-workspace.js';
import { readGitStatus } from '../core/git-mutation-guard.js';
import { writeDecision } from '../lib/decision.js';
import { gateStatus } from './gate.js';

export function applyCycle(opts) {
  const projectRoot = opts.projectRoot || process.cwd();
  if (!opts.sessionId) throw new Error('apply requires --session <id> from a shipped work cycle');

  const sessionId = opts.sessionId;
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');
  if (!fs.existsSync(sessionDir)) throw new Error('apply requires an existing session');

  const priorHandoffs = readPriorHandoffs(handoffDir);
  const latestImplement = latestStageHandoff(priorHandoffs, 'implement');
  if (!latestImplement) {
    throw new Error('apply requires an implement handoff. Run harness work first, using the same --session.');
  }
  const latestCodexReview = latestStageHandoff(priorHandoffs, 'codex-review');
  if (!latestCodexReview) {
    throw new Error('apply requires Codex verification. Run harness verify first, using the same --session.');
  }

  const gate = gateStatus({ sessionId, projectRoot });
  if (gate.status === 'open' || gate.status === 'blocked') {
    return writeBlockedSummary({
      sessionId,
      sessionDir,
      reason: gate.reason || gate.humanGateReason || 'human gate is not cleared',
      gate,
      latestImplement,
      diffPath: latestImplement.diffPath || null,
    });
  }

  const shipReady = readMarker(sessionDir, 'SHIP_READY');
  const noShip = readMarker(sessionDir, 'NO_SHIP');
  if (noShip && (!shipReady || markerTime(noShip) > markerTime(shipReady))) {
    return writeBlockedSummary({
      sessionId,
      sessionDir,
      reason: noShip.reason || 'NO_SHIP is present',
      gate,
      latestImplement,
      diffPath: latestImplement.diffPath || null,
      noShip: true,
    });
  }
  if (!shipReady) {
    throw new Error('apply requires SHIP_READY. Run nekowork ship first after verification and gate resolution.');
  }

  const appliedMarker = readMarker(sessionDir, 'APPLIED_DIFF');
  if (appliedMarker && !opts.force) {
    const result = {
      sessionId,
      sessionDir,
      applied: false,
      alreadyApplied: true,
      humanGate: false,
      noShip: false,
      reason: appliedMarker.reason || 'diff already applied',
      diffPath: appliedMarker.diffPath || latestImplement.diffPath || null,
      files: latestImplement.files || [],
    };
    writeSummary(sessionDir, result, latestImplement, gate);
    return result;
  }

  const diffInfo = readDiffForHandoff(sessionDir, latestImplement);
  if (!String(diffInfo.diff || '').trim()) {
    throw new Error('apply requires a captured diff from live work. Rerun harness work --live, then verify, ship, and apply.');
  }

  const status = readApplyGitStatus(projectRoot);
  if (!status) throw new Error('apply requires project root to be a git worktree');
  if (status.dirty && !opts.allowDirty) {
    throw new Error('apply requires a clean git worktree. Commit, stash, or rerun with --allow-dirty.');
  }

  const applied = applyExecutionDiff(projectRoot, diffInfo.diff);
  writeApplyMarker(sessionDir, diffInfo.path, latestImplement.files || []);

  const result = {
    sessionId,
    sessionDir,
    applied,
    alreadyApplied: false,
    humanGate: false,
    noShip: false,
    reason: applied ? null : 'diff was empty',
    diffPath: diffInfo.path,
    files: latestImplement.files || [],
  };
  writeSummary(sessionDir, result, latestImplement, gate);
  return result;
}

function readPriorHandoffs(handoffDir) {
  if (!fs.existsSync(handoffDir)) return [];
  return fs.readdirSync(handoffDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(handoffDir, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function latestStageHandoff(handoffs, stage) {
  return handoffs
    .filter(h => h.stage === stage)
    .sort((a, b) => Number(b.round || 1) - Number(a.round || 1))
    .at(0) || null;
}

function readDiffForHandoff(sessionDir, handoff) {
  const candidates = [];
  if (handoff.diffPath) candidates.push(handoff.diffPath);
  const diffDir = path.join(sessionDir, 'diffs');
  if (fs.existsSync(diffDir)) {
    candidates.push(...fs.readdirSync(diffDir).filter(f => f.endsWith('.diff')).sort().reverse().map(f => path.join(diffDir, f)));
  }
  for (const f of candidates) {
    try {
      if (fs.existsSync(f)) {
        return { path: f, diff: fs.readFileSync(f, 'utf8') };
      }
    } catch {}
  }
  return { path: null, diff: '' };
}

function readMarker(sessionDir, name) {
  const file = path.join(sessionDir, name);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  return {
    file,
    raw,
    reason: raw.match(/^reason:\s*(.+)$/m)?.[1] || null,
    at: raw.match(/^at:\s*(.+)$/m)?.[1] || null,
    diffPath: raw.match(/^diff_path:\s*(.+)$/m)?.[1] || null,
  };
}

function readApplyGitStatus(projectRoot) {
  const status = readGitStatus(projectRoot);
  if (!status) return null;
  const relevantLines = (status.text || '')
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean)
    .filter(line => !/^\?\?\s+\.harness(?:\/|\\)/.test(line))
    .filter(line => !/^[ MADRCU?!]{1,2}\s+\.harness(?:\/|\\)/.test(line));
  return {
    ...status,
    relevantText: relevantLines.join('\n'),
    dirty: relevantLines.length > 0,
  };
}

function markerTime(marker) {
  const time = Date.parse(marker?.at || '');
  return Number.isFinite(time) ? time : 0;
}

function writeApplyMarker(sessionDir, diffPath, files) {
  const lines = [];
  lines.push('reason: verified diff applied');
  if (diffPath) lines.push(`diff_path: ${diffPath}`);
  if (files?.length) lines.push(`files: ${files.join(', ')}`);
  lines.push(`at: ${new Date().toISOString()}`);
  fs.writeFileSync(path.join(sessionDir, 'APPLIED_DIFF'), lines.join('\n') + '\n');
}

function writeBlockedSummary({ sessionId, sessionDir, reason, gate, latestImplement, diffPath, noShip = false }) {
  const result = {
    sessionId,
    sessionDir,
    applied: false,
    alreadyApplied: false,
    humanGate: gate.status === 'open' || gate.status === 'blocked',
    noShip,
    reason,
    diffPath,
    files: latestImplement.files || [],
  };
  writeSummary(sessionDir, result, latestImplement, gate);
  return result;
}

function writeSummary(sessionDir, result, implementHandoff, gate) {
  fs.writeFileSync(path.join(sessionDir, 'apply-summary.json'), JSON.stringify({
    sessionId: result.sessionId,
    implement_round: implementHandoff?.round || null,
    implement_files: implementHandoff?.files || [],
    diff_path: result.diffPath || null,
    applied: result.applied,
    already_applied: result.alreadyApplied,
    human_gate: result.humanGate,
    no_ship: result.noShip,
    reason: result.reason || null,
    gate_status: gate?.status || null,
    target_project_mutated: Boolean(result.applied),
    next_step: result.applied
      ? 'review git diff, run project tests, then commit manually'
      : result.alreadyApplied
        ? 'diff was already applied; inspect project git status'
        : 'resolve gate/ship/apply blocker',
  }, null, 2));
  writeDecision(sessionDir, { sessionId: result.sessionId, stage: 'apply' });
}

export {
  readPriorHandoffs as _readPriorHandoffs,
  latestStageHandoff as _latestStageHandoff,
  readDiffForHandoff as _readDiffForHandoff,
  readApplyGitStatus as _readApplyGitStatus,
};
