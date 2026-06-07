import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { applyExecutionDiff } from '../core/execution-workspace.js';
import { readGitStatus, withGitMutationGuardSync } from '../core/git-mutation-guard.js';
import { writeDecision } from '../lib/decision.js';
import { readMarker as readMarkerFile, markerTime } from '../lib/session-io.js';
import { assertSafeSessionId } from '../lib/session-resolver.js';
import { gateStatus } from './gate.js';
import { readPriorHandoffs, latestStageHandoff } from './_handoff-utils.js';

export function applyCycle(opts) {
  const projectRoot = opts.projectRoot || process.cwd();
  if (!opts.sessionId) throw new Error('apply requires --session <id> from a shipped work cycle');

  const sessionId = opts.sessionId;
  // Path-traversal guard: the session id becomes a path segment below, so a
  // `..` or absolute id could escape the sessions directory. Centralized in
  // session-resolver so apply / gate / report enforce the same rule.
  assertSafeSessionId(sessionId);
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

  // Approval-to-content binding (defense-in-depth, integrity-by-content-hash —
  // NOT authentication): when the gate was approved, gate.js recorded the
  // sha256 of the session diff at that moment. If the diff has since changed,
  // the prior approval no longer covers what would be applied, so refuse.
  const approval = readMarker(sessionDir, 'GATE_APPROVED');
  if (approval?.diffHash) {
    const currentHash = crypto.createHash('sha256').update(String(diffInfo.diff)).digest('hex');
    if (currentHash !== approval.diffHash) {
      throw new Error('approval does not match current diff — re-approve');
    }
  }

  const status = readApplyGitStatus(projectRoot);
  if (!status) throw new Error('apply requires project root to be a git worktree');
  if (status.dirty && !opts.allowDirty) {
    throw new Error('apply requires a clean git worktree. Commit, stash, or rerun with --allow-dirty.');
  }

  // Guard the apply: the diff legitimately touches latestImplement.files, but
  // any git change OUTSIDE that set (a stray commit, branch op, or edit to an
  // unrelated file) is an unexpected EXTRA mutation and is rejected. .harness/
  // state writes happen after this block, so they don't enter the comparison.
  const applied = withGitMutationGuardSync(
    projectRoot,
    () => applyExecutionDiff(projectRoot, diffInfo.diff),
    { label: 'apply', expectedPaths: latestImplement.files || [] },
  );
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

// Thin wrapper preserving apply.js's historical (sessionDir, name) signature
// over the shared single-path readMarker (which returns the superset incl.
// diffPath).
function readMarker(sessionDir, name) {
  return readMarkerFile(path.join(sessionDir, name));
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
