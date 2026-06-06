import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { dispatch } from '../agents/dispatch.js';
import { ensureAcceptanceCriteria } from '@ps-neko/nekowork/scripts/lib/acceptance-criteria.js';
import { writeDecision } from '@ps-neko/nekowork/scripts/lib/decision.js';
import { classifyRisk, gateReasonFromFindings } from '@ps-neko/nekowork/scripts/lib/risk-classifier.js';
import { gateStatus } from './gate.js';
import { readPriorHandoffs, latestStageHandoff, nextRound, readJsonIfExists } from './_handoff-utils.js';

const STAGE_INDEX = { ship: '07' };

export async function shipCycle(opts) {
  const harnessRoot = opts.harnessRoot || process.cwd();
  const projectRoot = opts.projectRoot || harnessRoot;
  if (!opts.sessionId) throw new Error('ship requires --session <id> from a verified work cycle');

  const sessionId = opts.sessionId;
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');

  const priorHandoffs = readPriorHandoffs(handoffDir);
  const latestImplement = latestStageHandoff(priorHandoffs, 'implement');
  if (!latestImplement) {
    throw new Error('ship requires an implement handoff. Run harness work first, using the same --session.');
  }

  const latestCodexReview = latestStageHandoff(priorHandoffs, 'codex-review');
  if (!latestCodexReview) {
    throw new Error('ship requires Codex verification. Run harness verify first, using the same --session.');
  }

  fs.mkdirSync(handoffDir, { recursive: true });

  const gate = gateStatus({ sessionId, projectRoot });
  const existingGate = gate.humanGateReason;
  const gateApproved = gate.status === 'approved' && Boolean(existingGate);
  if (gate.status === 'blocked') {
    return writeBlockedSummary({
      sessionId,
      sessionDir,
      task: opts.task,
      priorHandoffs,
      reason: gate.reason,
      source: 'gate-blocked',
    });
  }
  if (existingGate && !gateApproved) {
    return writeBlockedSummary({
      sessionId,
      sessionDir,
      task: opts.task,
      priorHandoffs,
      reason: existingGate,
      source: 'existing-human-gate',
    });
  }

  const riskPolicy = classifyRisk({ task: opts.task, files: latestImplement.files || [] });
  if (riskPolicy.requiresHumanGate && !gateApproved) {
    const reason = `risk policy requires human gate (${riskPolicy.tags.join(',') || riskPolicy.risk})`;
    writeHumanGate(sessionDir, reason);
    return writeBlockedSummary({
      sessionId,
      sessionDir,
      task: opts.task,
      priorHandoffs,
      reason,
      source: 'risk-policy',
    });
  }

  const verificationHandoffs = [latestCodexReview, latestStageHandoff(priorHandoffs, 'codex-challenge')].filter(Boolean);
  const gateReason = humanGateReason(verificationHandoffs);
  if (gateReason && !gateApproved) {
    writeHumanGate(sessionDir, gateReason);
    return writeBlockedSummary({
      sessionId,
      sessionDir,
      task: opts.task,
      priorHandoffs,
      reason: gateReason,
      source: 'verification-gate',
    });
  }

  const dispatcher = opts.dispatcher || dispatch;
  const live = !!opts.live;
  const prd = readJsonIfExists(path.join(sessionDir, 'prd.json'));
  const acceptance = ensureAcceptanceCriteria({ sessionDir, task: opts.task });
  const classification = riskPolicy;
  const verificationVerdict = finalVerificationVerdict(verificationHandoffs);
  const verdict = gateApproved ? 'approve' : verificationVerdict;
  const shipReady = verdict === 'approve';
  const round = nextRound(priorHandoffs, 'ship');

  const h7 = await dispatcher({
    agent: 'doc-writer',
    stage: 'ship',
    task: opts.task || `ship session ${sessionId}`,
    live,
    harnessRoot,
    projectRoot,
    sessionDir,
    sessionId,
    sandboxOverride: 'read-only',
    context: {
      round,
      prd,
      acceptanceCriteria: acceptance.criteria,
      priorHandoffs: priorHandoffs.slice(-8),
      shipOnly: true,
      shipReady,
      gateApproved,
      gateStatus: gate.status,
      verificationVerdict,
      effectiveVerdict: verdict,
      noProjectMutation: true,
      riskClassification: classification,
    },
  });
  h7.round = round;
  h7.session_id = sessionId;
  h7.verdict = shipReady ? 'approve' : 'approve_with_fixes';
  h7.risks = appendText(h7.risks, shipReady
    ? gateApproved
      ? `Human gate approved (${gate.approvalReason || 'no reason recorded'}). Human still controls PR, release, publish, and deploy.`
      : 'Human still controls PR, release, publish, and deploy.'
    : 'Codex reported fixable findings; create a no-ship handoff until they are resolved.');
  h7.remaining = shipReady
    ? 'human may create PR/release using this handoff'
    : 'resolve Codex findings, rerun verify, then rerun ship';
  assertValidHandoff(harnessRoot, h7);
  writeHandoff(handoffDir, h7);

  if (shipReady) writeMarker(sessionDir, 'SHIP_READY', 'ready');
  else writeMarker(sessionDir, 'NO_SHIP', `verification verdict: ${verdict}`);

  const result = {
    sessionId,
    sessionDir,
    handoffs: [...priorHandoffs, h7],
    shipHandoff: h7,
    shipReady,
    noShip: !shipReady,
    humanGate: false,
    reason: shipReady ? null : `verification verdict is ${verdict}`,
    verdict,
    gateApproved,
    verificationVerdict,
  };
  writeSummary(sessionDir, {
    sessionId,
    task: opts.task,
    mode: 'ship-readiness',
    shipReady,
    noShip: !shipReady,
    humanGate: false,
    reason: result.reason,
    verdict,
    gate,
    gateApproved,
    verificationVerdict,
    acceptance,
    classification,
    implementHandoff: latestImplement,
    verificationHandoffs,
    shipHandoff: h7,
  });
  writeDecision(sessionDir, { sessionId, stage: 'ship' });
  return result;
}

const humanGateReason = gateReasonFromFindings;

function writeHumanGate(sessionDir, reason) {
  fs.writeFileSync(path.join(sessionDir, 'HUMAN_GATE'), `reason: ${reason}\nat: ${new Date().toISOString()}\n`);
}

function finalVerificationVerdict(handoffs) {
  if (handoffs.some(h => h.verdict === 'block')) return 'block';
  if (handoffs.some(h => h.verdict === 'approve_with_fixes')) return 'approve_with_fixes';
  return 'approve';
}

function writeBlockedSummary({ sessionId, sessionDir, task, priorHandoffs, reason, source }) {
  const latestImplement = latestStageHandoff(priorHandoffs, 'implement');
  const verificationHandoffs = [
    latestStageHandoff(priorHandoffs, 'codex-review'),
    latestStageHandoff(priorHandoffs, 'codex-challenge'),
  ].filter(Boolean);
  writeSummary(sessionDir, {
    sessionId,
    task,
    mode: 'ship-readiness',
    shipReady: false,
    noShip: true,
    humanGate: true,
    reason,
    source,
    verdict: 'block',
    implementHandoff: latestImplement,
    verificationHandoffs,
    shipHandoff: null,
  });
  writeDecision(sessionDir, { sessionId, stage: 'ship' });
  return {
    sessionId,
    sessionDir,
    handoffs: priorHandoffs,
    shipHandoff: null,
    shipReady: false,
    noShip: true,
    humanGate: true,
    reason,
    verdict: 'block',
  };
}

function writeSummary(sessionDir, summary) {
  fs.writeFileSync(path.join(sessionDir, 'ship-summary.json'), JSON.stringify({
    sessionId: summary.sessionId,
    task: summary.task || null,
    mode: summary.mode,
    implement_round: summary.implementHandoff?.round || null,
    implement_files: summary.implementHandoff?.files || [],
    codex_review_verdict: summary.verificationHandoffs.find(h => h.stage === 'codex-review')?.verdict || null,
    codex_challenge_verdict: summary.verificationHandoffs.find(h => h.stage === 'codex-challenge')?.verdict || null,
    acceptance_required: true,
    acceptance_count: summary.acceptance?.criteria?.length || 0,
    acceptance_source: summary.acceptance?.source || null,
    risk_level: summary.classification?.risk || null,
    risk_tags: summary.classification?.tags || [],
    ship_handoff_run: Boolean(summary.shipHandoff),
    ship_ready: summary.shipReady,
    no_ship: summary.noShip,
    human_gate: summary.humanGate,
    reason: summary.reason || null,
    verdict: summary.verdict,
    verification_verdict: summary.verificationVerdict || summary.verdict,
    gate_status: summary.gate?.status || null,
    gate_approved: Boolean(summary.gateApproved),
    target_project_mutated: false,
    next_step: summary.humanGate
      ? 'human review required before ship'
      : summary.shipReady
        ? 'human may create PR/release/deploy from the ship handoff'
        : 'resolve findings, rerun verify, then rerun ship',
  }, null, 2));
}

function writeMarker(sessionDir, name, reason) {
  fs.writeFileSync(path.join(sessionDir, name), `reason: ${reason}\nat: ${new Date().toISOString()}\n`);
}

function writeHandoff(handoffDir, h) {
  const base = handoffBase(h);
  fs.writeFileSync(path.join(handoffDir, `${base}.json`), JSON.stringify(h, null, 2));
  fs.writeFileSync(path.join(handoffDir, `${base}.md`), renderHandoff(h));
}

function handoffBase(h) {
  const nn = STAGE_INDEX[h.stage] || '00';
  const round = Number(h.round || 1);
  const roundSuffix = round > 1 ? `-r${round}` : '';
  return `${nn}-${h.stage}${roundSuffix}`;
}

function renderHandoff(h) {
  const lines = [];
  lines.push(`# Handoff: ${h.stage}  (round ${h.round || 1}, agent: ${h.agent}, ${h.provider}/${h.model})`);
  lines.push('');
  lines.push(`**Decided**: ${h.decided || ''}`);
  if (h.rejected) lines.push(`**Rejected**: ${h.rejected}`);
  if (h.risks) lines.push(`**Risks**: ${h.risks}`);
  lines.push(`**Files**: ${(h.files || []).join(', ')}`);
  if (h.remaining) lines.push(`**Remaining**: ${h.remaining}`);
  if (h.verdict) lines.push(`**Verdict**: ${h.verdict}${h.confidence != null ? ` (confidence ${h.confidence})` : ''}`);
  lines.push('');
  lines.push('<sub>ship mode: readiness handoff only; target project not mutated; human owns PR/release/deploy</sub>');
  return lines.join('\n') + '\n';
}

function appendText(a = '', b = '') {
  return [a, b].filter(Boolean).join(a && b ? ' ' : '');
}

function assertValidHandoff(root, handoff) {
  const schemaPath = path.join(root, 'schemas', 'handoff.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(handoff)) {
    const detail = (validate.errors || [])
      .map(e => `${e.instancePath || '/'} ${e.message}`)
      .join('; ');
    throw new Error(`ship handoff schema validation failed: ${detail}`);
  }
}

export {
  readPriorHandoffs as _readPriorHandoffs,
  latestStageHandoff as _latestStageHandoff,
  humanGateReason as _humanGateReason,
  finalVerificationVerdict as _finalVerificationVerdict,
};
