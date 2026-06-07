import fs from 'node:fs';
import path from 'node:path';
import { writeDecision } from '../lib/decision.js';
import { resolveSessionId, assertSafeSessionId } from '../lib/session-resolver.js';
import { readMarker as readMarkerFile, markerTime } from '../lib/session-io.js';
import { computeSessionDiffHash } from './_handoff-utils.js';

const MARKERS = {
  human: 'HUMAN_GATE',
  approved: 'GATE_APPROVED',
  blocked: 'GATE_BLOCKED',
};

export function gateCommand(opts) {
  const action = opts.action || 'status';
  if (action === 'status') return gateStatus(opts);
  if (action === 'approve') return approveGate(opts);
  if (action === 'block') return blockGate(opts);
  throw new Error(`unknown gate action: ${action}`);
}

export function gateStatus(opts) {
  const projectRoot = opts.projectRoot || process.cwd();
  if (!opts.sessionId) throw new Error('gate requires --session <id>');

  assertSafeSessionId(opts.sessionId);
  const sessionId = resolveSessionId(projectRoot, opts.sessionId);
  const sessionDir = sessionPath(projectRoot, sessionId);
  if (!fs.existsSync(sessionDir)) {
    return {
      sessionId,
      sessionDir,
      status: 'missing',
      humanGate: false,
      approved: false,
      blocked: false,
      reason: 'session not found',
      humanGateReason: null,
      approvalReason: null,
      blockReason: null,
    };
  }

  const human = readMarker(sessionDir, MARKERS.human);
  const approval = readMarker(sessionDir, MARKERS.approved);
  const block = readMarker(sessionDir, MARKERS.blocked);

  let status = 'clear';
  let reason = null;
  if (block) {
    status = 'blocked';
    reason = block.reason;
  } else if (human && (!approval || markerTime(approval) < markerTime(human))) {
    status = 'open';
    reason = human.reason;
  } else if (approval && (!human || markerTime(approval) >= markerTime(human))) {
    status = 'approved';
    reason = approval.reason;
  }

  return {
    sessionId,
    sessionDir,
    status,
    humanGate: Boolean(human) && status !== 'approved',
    approved: status === 'approved',
    blocked: status === 'blocked',
    reason,
    humanGateReason: human?.reason || null,
    approvalReason: approval?.reason || null,
    blockReason: block?.reason || null,
    approvalActor: approval?.actor || null,
    blockActor: block?.actor || null,
    humanGateAt: human?.at || null,
    approvalAt: approval?.at || null,
    blockAt: block?.at || null,
  };
}

export function approveGate(opts) {
  const base = gateStatus(opts);
  if (base.status === 'missing') throw new Error('gate approve requires an existing session');
  if (base.status === 'blocked') throw new Error('gate approve cannot override an explicit gate block');
  if (base.status !== 'open') throw new Error('gate approve requires an open HUMAN_GATE');
  if (!String(opts.reason || '').trim()) throw new Error('gate approve requires --reason <text>');

  const sessionDir = base.sessionDir;
  // Bind the approval to the exact diff being approved (defense-in-depth,
  // integrity-by-content-hash — NOT authentication). apply recomputes this hash
  // and refuses if the session diff changed after approval, so a stale/forged
  // approval cannot be used to apply a DIFFERENT diff.
  const diffHash = computeSessionDiffHash(sessionDir);
  writeMarker(sessionDir, MARKERS.approved, {
    reason: opts.reason,
    humanGateReason: base.humanGateReason,
    actor: opts.actor || defaultActor(),
    diffHash,
  });
  appendEvent(sessionDir, {
    event: 'approve',
    reason: opts.reason,
    humanGateReason: base.humanGateReason,
    actor: opts.actor || defaultActor(),
  });
  const result = gateStatus(opts);
  writeSummary(sessionDir, result, 'approve');
  writeDecision(sessionDir, { sessionId: result.sessionId, stage: 'gate' });
  return result;
}

export function blockGate(opts) {
  const projectRoot = opts.projectRoot || process.cwd();
  if (!opts.sessionId) throw new Error('gate requires --session <id>');
  if (!String(opts.reason || '').trim()) throw new Error('gate block requires --reason <text>');

  assertSafeSessionId(opts.sessionId);
  const sessionId = resolveSessionId(projectRoot, opts.sessionId);
  const sessionDir = sessionPath(projectRoot, sessionId);
  if (!fs.existsSync(sessionDir)) throw new Error('gate block requires an existing session');

  const reason = opts.reason;
  writeMarker(sessionDir, MARKERS.human, { reason: `manual block: ${reason}` });
  writeMarker(sessionDir, MARKERS.blocked, { reason, actor: opts.actor || defaultActor() });
  appendEvent(sessionDir, { event: 'block', reason, actor: opts.actor || defaultActor() });
  const result = gateStatus({ ...opts, sessionId });
  writeSummary(sessionDir, result, 'block');
  writeDecision(sessionDir, { sessionId: result.sessionId, stage: 'gate' });
  return result;
}

function sessionPath(projectRoot, sessionId) {
  return path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
}

// Thin wrapper preserving gate.js's historical (sessionDir, name) signature
// over the shared single-path readMarker. The shared reader returns the
// superset of fields (kind=basename, plus diffPath), so all gate call sites
// keep the fields they read (kind, reason, at, humanGateReason, actor).
function readMarker(sessionDir, name) {
  return readMarkerFile(path.join(sessionDir, name));
}

function writeMarker(sessionDir, name, fields) {
  const lines = [];
  lines.push(`reason: ${fields.reason}`);
  if (fields.humanGateReason) lines.push(`human_gate_reason: ${fields.humanGateReason}`);
  if (fields.actor) lines.push(`actor: ${fields.actor}`);
  if (fields.diffHash) lines.push(`diff_hash: ${fields.diffHash}`);
  lines.push(`at: ${new Date().toISOString()}`);
  fs.writeFileSync(path.join(sessionDir, name), lines.join('\n') + '\n');
}

function appendEvent(sessionDir, event) {
  const row = {
    ...event,
    at: new Date().toISOString(),
  };
  fs.appendFileSync(path.join(sessionDir, 'gate-events.jsonl'), JSON.stringify(row) + '\n');
}

function writeSummary(sessionDir, result, action) {
  fs.writeFileSync(path.join(sessionDir, 'gate-summary.json'), JSON.stringify({
    sessionId: result.sessionId,
    action,
    status: result.status,
    human_gate: result.humanGate,
    approved: result.approved,
    blocked: result.blocked,
    reason: result.reason,
    human_gate_reason: result.humanGateReason,
    approval_reason: result.approvalReason,
    approval_actor: result.approvalActor,
    block_reason: result.blockReason,
    block_actor: result.blockActor,
    target_project_mutated: false,
    next_step: nextStep(result),
  }, null, 2));
}

function defaultActor() {
  return process.env.GITHUB_ACTOR || process.env.USERNAME || process.env.USER || null;
}

function nextStep(result) {
  if (result.status === 'approved') return 'rerun ship for readiness';
  if (result.status === 'blocked') return 'do not ship; revise work or start a new cycle';
  if (result.status === 'open') return 'human must approve or block the gate';
  if (result.status === 'missing') return 'create a work/verify session first';
  return 'continue to verify or ship';
}

export {
  readMarker as _readMarker,
  markerTime as _markerTime,
};
