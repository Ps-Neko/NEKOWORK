import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { dispatch } from '../agents/dispatch.js';
import { ensureAcceptanceCriteria } from '../lib/acceptance-criteria.js';
import { classifyRisk, gateReasonFromFindings } from '../lib/risk-classifier.js';
import { acceptanceCoverageWarnings, evidenceFieldWarnings, profilePolicy } from '../lib/profile-policy.js';

const STAGE_INDEX = { 'codex-review': '05', 'codex-challenge': '06' };

export async function verifyCycle(opts) {
  const harnessRoot = opts.harnessRoot || process.cwd();
  const projectRoot = opts.projectRoot || harnessRoot;
  if (!opts.sessionId) throw new Error('verify requires --session <id> from a prior work cycle');

  const sessionId = opts.sessionId;
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');

  const priorHandoffs = readPriorHandoffs(handoffDir);
  const latestImplement = latestStageHandoff(priorHandoffs, 'implement');
  if (!latestImplement) {
    throw new Error('verify requires an implement handoff. Run harness work first, using the same --session.');
  }
  fs.mkdirSync(handoffDir, { recursive: true });

  const prd = readJsonIfExists(path.join(sessionDir, 'prd.json'));
  const acceptance = ensureAcceptanceCriteria({ sessionDir, task: opts.task });
  const policy = profilePolicy(opts.profile || readSessionProfile(sessionDir));
  const diff = readDiffForHandoff(sessionDir, latestImplement);
  const dispatcher = opts.dispatcher || dispatch;
  const live = !!opts.live;
  const classification = classifyRisk({ task: opts.task, files: latestImplement.files || [] });
  const secureActive = !!opts.secure || classification.requiresCodexChallenge;

  const context = {
    round: nextRound(priorHandoffs, 'codex-review'),
    profile: policy.profile,
    qualityChecklist: policy.checklist,
    evidencePolicy: {
      evidenceWarningRequired: policy.evidenceWarningRequired,
      acceptanceCoverageWarning: policy.acceptanceCoverageWarning,
    },
    prd,
    acceptanceCriteria: acceptance.criteria,
    priorHandoffs: priorHandoffs.slice(-6),
    diff,
    verifyOnly: true,
    riskClassification: classification,
  };

  const h5 = await dispatcher({
    agent: 'codex-reviewer',
    stage: 'codex-review',
    task: opts.task,
    live,
    harnessRoot,
    projectRoot,
    sessionDir,
    sessionId,
    context,
  });
  h5.round = context.round;
  h5.session_id = sessionId;
  if (policy.profile) h5.profile = policy.profile;
  assertValidHandoff(harnessRoot, h5);
  writeHandoff(handoffDir, h5);

  const handoffs = [...priorHandoffs, h5];
  let h6 = null;
  if (secureActive) {
    h6 = await dispatcher({
      agent: 'codex-challenger',
      stage: 'codex-challenge',
      task: opts.task,
      live,
      harnessRoot,
      projectRoot,
      sessionDir,
      sessionId,
      context: {
        ...context,
        round: nextRound(handoffs, 'codex-challenge'),
        priorHandoffs: handoffs.slice(-6),
      },
    });
    h6.round = nextRound(handoffs, 'codex-challenge');
    h6.session_id = sessionId;
    if (policy.profile) h6.profile = policy.profile;
    assertValidHandoff(harnessRoot, h6);
    writeHandoff(handoffDir, h6);
    handoffs.push(h6);
  }

  const gateReason = gateReasonFromFindings([h5, h6].filter(Boolean)) ||
    (classification.requiresHumanGate ? `risk policy requires human gate (${classification.tags.join(',') || classification.risk})` : null);
  if (gateReason) writeHumanGate(sessionDir, gateReason);
  const qualityWarnings = [
    ...evidenceFieldWarnings([h5, h6].filter(Boolean), policy.profile),
    ...acceptanceCoverageWarnings(acceptance.criteria, [h5, h6].filter(Boolean), policy.profile),
  ];

  const result = {
    sessionId,
    sessionDir,
    handoffs,
    codexReview: h5,
    codexChallenge: h6,
    secureActive,
    humanGate: Boolean(gateReason),
    reason: gateReason || null,
    profile: policy.profile,
    qualityChecklist: policy.checklist,
    qualityWarnings,
    verdict: finalVerdict([h5, h6].filter(Boolean)),
  };
  writeSummary(sessionDir, result, opts.task, latestImplement, diff, acceptance, classification);
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

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function readSessionProfile(sessionDir) {
  return readJsonIfExists(path.join(sessionDir, 'ask.json'))?.profile || null;
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
      if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
    } catch {}
  }
  return '';
}

function nextRound(handoffs, stage) {
  const rounds = handoffs
    .filter(h => h.stage === stage)
    .map(h => Number(h.round || 1))
    .filter(Number.isFinite);
  return rounds.length ? Math.max(...rounds) + 1 : 1;
}

function writeHumanGate(sessionDir, reason) {
  fs.writeFileSync(path.join(sessionDir, 'HUMAN_GATE'), `reason: ${reason}\nat: ${new Date().toISOString()}\n`);
}

function finalVerdict(handoffs) {
  if (handoffs.some(h => h.verdict === 'block')) return 'block';
  if (handoffs.some(h => h.verdict === 'approve_with_fixes')) return 'approve_with_fixes';
  return 'approve';
}

function writeSummary(sessionDir, result, task, implementHandoff, diff, acceptance, classification) {
  fs.writeFileSync(path.join(sessionDir, 'verify-summary.json'), JSON.stringify({
    sessionId: result.sessionId,
    task,
    mode: 'verify-only',
    implement_round: implementHandoff.round || 1,
    implement_files: implementHandoff.files || [],
    diff_present: Boolean(String(diff || '').trim()),
    acceptance_required: true,
    acceptance_count: acceptance?.criteria?.length || 0,
    acceptance_source: acceptance?.source || null,
    profile: result.profile || null,
    quality_checklist: result.qualityChecklist || [],
    quality_warnings: result.qualityWarnings || [],
    evidence_warning_required: Boolean(result.profile && ['quality', 'security'].includes(result.profile)),
    risk_level: classification?.risk || null,
    risk_tags: classification?.tags || [],
    codex_review_run: true,
    codex_challenge_run: Boolean(result.codexChallenge),
    secure_active: result.secureActive,
    human_gate: result.humanGate,
    reason: result.reason,
    verdict: result.verdict,
    ship_run: false,
    target_project_mutated: false,
    next_step: result.humanGate ? 'human review required' : 'fix findings or prepare an apply/ship gate',
  }, null, 2));
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
  if (h.issues?.length) {
    lines.push('');
    lines.push('## Issues');
    for (const i of h.issues) {
      lines.push(`- [${i.severity}/${i.category}] ${i.file || ''}${i.line ? ':' + i.line : ''} - ${i.summary}`);
    }
  }
  lines.push('');
  lines.push('<sub>verify mode: Codex only; implement not run; ship not run</sub>');
  return lines.join('\n') + '\n';
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
    throw new Error(`verify handoff schema validation failed: ${detail}`);
  }
}

export {
  readPriorHandoffs as _readPriorHandoffs,
  latestStageHandoff as _latestStageHandoff,
  readDiffForHandoff as _readDiffForHandoff,
  gateReasonFromFindings as _humanGateReason,
};
