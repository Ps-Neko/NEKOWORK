import fs from 'node:fs';
import path from 'node:path';
import { resolveSessionId } from '../lib/session-resolver.js';
import {
  reportSession,
  _deriveStatus,
  _readSessionEvidence,
} from './report.js';

const ARTIFACTS = {
  prSummary: 'PR_SUMMARY.md',
  riskNotes: 'RISK_NOTES.md',
  testEvidence: 'TEST_EVIDENCE.md',
  changelogDraft: 'CHANGELOG_DRAFT.md',
  shipDecision: 'SHIP_DECISION.md',
};

export function prPrepSession(opts = {}) {
  const projectRoot = opts.projectRoot || process.cwd();
  const requestedSession = opts.sessionId || 'latest';
  const sessionId = resolveSessionId(projectRoot, requestedSession);
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  if (!fs.existsSync(sessionDir)) throw new Error('pr-prep requires an existing session');

  const data = _readSessionEvidence(sessionDir);
  const status = _deriveStatus(data);
  const summary = buildPrPrepSummary({
    sessionId,
    sessionDir,
    task: opts.task || taskFromEvidence(data) || `prepare session ${sessionId} for review`,
    data,
    status,
  });

  const artifacts = renderArtifacts(summary);
  fs.mkdirSync(sessionDir, { recursive: true });
  for (const [key, rel] of Object.entries(ARTIFACTS)) {
    fs.writeFileSync(path.join(sessionDir, rel), artifacts[key]);
  }

  writeSummary(sessionDir, summary);
  const report = reportSession({ sessionId, projectRoot });
  const finalSummary = {
    ...summary,
    reportPath: report.reportPath,
  };
  writeSummary(sessionDir, finalSummary);

  return finalSummary;
}

function buildPrPrepSummary({ sessionId, sessionDir, task, data, status }) {
  const ship = data.summaries['ship-summary.json'] || {};
  const verify = data.summaries['verify-summary.json'] || {};
  const auto = data.summaries['auto-summary.json'] || {};
  const build = data.summaries['build-summary.json'] || {};
  const apply = data.summaries['apply-summary.json'] || {};
  const latestImplement = latestHandoff(data, 'implement');
  const latestCodex = latestHandoff(data, 'codex-review');
  const latestChallenge = latestHandoff(data, 'codex-challenge');
  const files = unique([
    ...(latestImplement?.files || []),
    ...(ship.implement_files || []),
    ...(data.canonicalCandidate?.files || []),
  ]);
  const issues = [
    ...(latestCodex?.issues || []),
    ...(latestChallenge?.issues || []),
  ];
  const shipReady = Boolean(data.markers.SHIP_READY || ship.ship_ready || ship.shipReady || auto.ship_ready || build.ship_ready);
  const noShip = status === 'no_ship' || Boolean(data.markers.NO_SHIP || ship.no_ship || ship.noShip || auto.no_ship || build.no_ship);
  const humanGate = ['human_gate', 'gate_blocked'].includes(status) || Boolean(data.markers.HUMAN_GATE || ship.human_gate || auto.human_gate || build.human_gate || verify.human_gate);
  const applied = Boolean(data.markers.APPLIED_DIFF || apply.applied || auto.applied || build.applied);
  const readyForPr = shipReady && !noShip && !humanGate;
  const decision = humanGate
    ? 'HUMAN_GATE'
    : noShip
      ? 'NO_SHIP'
      : shipReady
        ? 'SHIP_READY'
        : 'NOT_READY';

  return {
    sessionId,
    sessionDir,
    task,
    status,
    decision,
    readyForPr,
    shipReady,
    noShip,
    humanGate,
    applied,
    verdict: ship.verdict || auto.rounds?.at?.(-1)?.verdict || build.verdict || verify.verdict || latestCodex?.verdict || null,
    risk: riskSummary(data, ship, build),
    files,
    issues: issues.map(normalizeIssue),
    acceptanceCoverage: verify.acceptance_coverage || [],
    qualityWarnings: verify.quality_warnings || [],
    verification: {
      codexReview: latestCodex?.verdict || ship.codex_review_verdict || null,
      codexChallenge: latestChallenge?.verdict || ship.codex_challenge_verdict || null,
      finalVerification: data.canonicalVerify?.verdict || null,
    },
    artifacts: Object.values(ARTIFACTS),
    reportPath: null,
    targetProjectMutated: false,
    noRemoteMutation: true,
    safetyInvariants: [
      'pr-prep creates local review artifacts only.',
      'pr-prep does not commit, push, create a branch, open a pull request, publish, deploy, or apply changes.',
      'Human remains responsible for commit, push, PR, release, publish, deploy, and apply decisions.',
    ],
    generatedAt: new Date().toISOString(),
  };
}

function renderArtifacts(summary) {
  return {
    prSummary: renderPrSummary(summary),
    riskNotes: renderRiskNotes(summary),
    testEvidence: renderTestEvidence(summary),
    changelogDraft: renderChangelogDraft(summary),
    shipDecision: renderShipDecision(summary),
  };
}

function renderPrSummary(summary) {
  const lines = [
    '# PR Summary',
    '',
    `Session: \`${summary.sessionId}\``,
    `Ready for PR: ${summary.readyForPr ? 'yes' : 'no'}`,
    `Decision: ${summary.decision}`,
    '',
    '## Suggested Title',
    '',
    summarizeTitle(summary.task),
    '',
    '## Summary',
    '',
    `- Task: ${summary.task}`,
    `- Ship ready: ${summary.shipReady ? 'yes' : 'no'}`,
    `- Human Gate: ${summary.humanGate ? 'required' : 'clear'}`,
    `- Applied: ${summary.applied ? 'yes' : 'no'}`,
    `- Verification: Codex review ${summary.verification.codexReview || 'not recorded'}${summary.verification.codexChallenge ? `, challenge ${summary.verification.codexChallenge}` : ''}`,
    '',
    '## Changed Files',
    '',
    ...listOrNone(summary.files),
    '',
    '## Reviewer Notes',
    '',
    '- See `REPORT.md` for the full evidence trail.',
    '- See `RISK_NOTES.md`, `TEST_EVIDENCE.md`, and `SHIP_DECISION.md` before creating a pull request.',
    '- NEKOWORK did not create a branch, commit, push, open a PR, apply, publish, or deploy.',
    '',
  ];
  return lines.join('\n');
}

function renderRiskNotes(summary) {
  const lines = [
    '# Risk Notes',
    '',
    `Risk: ${summary.risk.risk || 'unknown'}`,
    `Tags: ${summary.risk.tags.length ? summary.risk.tags.join(', ') : 'none'}`,
    `Human Gate: ${summary.humanGate ? 'required' : 'clear'}`,
    `Codex Challenge: ${summary.risk.requiresCodexChallenge ? 'required' : 'not required'}`,
    '',
    '## Findings',
    '',
  ];
  if (!summary.issues.length) {
    lines.push('- None recorded.');
  } else {
    lines.push('| Severity | Category | Claim | Evidence | Required Fix | Gate |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const issue of summary.issues) {
      lines.push(`| ${cell(issue.severity)} | ${cell(issue.category)} | ${cell(issue.claim || issue.summary)} | ${cell(issue.evidence)} | ${cell(issue.required_fix || issue.suggested_fix)} | ${issue.gate_required ? 'yes' : 'no'} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function renderTestEvidence(summary) {
  const lines = [
    '# Test Evidence',
    '',
    `Ready for PR: ${summary.readyForPr ? 'yes' : 'no'}`,
    '',
    '## Acceptance Coverage',
    '',
  ];
  if (!summary.acceptanceCoverage.length) {
    lines.push('- No structured acceptance coverage was recorded.');
  } else {
    lines.push('| ID | Status | Evidence | Source |');
    lines.push('| --- | --- | --- | --- |');
    for (const row of summary.acceptanceCoverage) {
      lines.push(`| ${cell(row.id)} | ${cell(row.status)} | ${cell(row.evidence)} | ${cell(row.source)} |`);
    }
  }
  lines.push('');
  lines.push('## Quality Warnings');
  lines.push('');
  if (!summary.qualityWarnings.length) lines.push('- None recorded.');
  else for (const warning of summary.qualityWarnings) lines.push(`- ${warning}`);
  lines.push('');
  lines.push('## Verification');
  lines.push('');
  lines.push(`- Codex review: ${summary.verification.codexReview || 'not recorded'}`);
  lines.push(`- Codex challenge: ${summary.verification.codexChallenge || 'not recorded'}`);
  lines.push(`- Final candidate verification: ${summary.verification.finalVerification || 'not recorded'}`);
  lines.push('');
  return lines.join('\n');
}

function renderChangelogDraft(summary) {
  const lines = [
    '# Changelog Draft',
    '',
    '## Added',
    '',
    `- Prepared verified review evidence for: ${summary.task}`,
    '',
    '## Changed',
    '',
    ...listOrNone(summary.files.map(file => `Evidence references \`${file}\``)),
    '',
    '## Verification',
    '',
    `- NEKOWORK decision: ${summary.decision}`,
    `- Codex review: ${summary.verification.codexReview || 'not recorded'}`,
    '',
  ];
  return lines.join('\n');
}

function renderShipDecision(summary) {
  const lines = [
    '# Ship Decision',
    '',
    `Decision: ${summary.decision}`,
    `Ready for PR: ${summary.readyForPr ? 'yes' : 'no'}`,
    `Ship ready: ${summary.shipReady ? 'yes' : 'no'}`,
    `No ship: ${summary.noShip ? 'yes' : 'no'}`,
    `Human Gate: ${summary.humanGate ? 'required' : 'clear'}`,
    `Applied: ${summary.applied ? 'yes' : 'no'}`,
    '',
    '## Boundary',
    '',
    '- pr-prep did not create a branch.',
    '- pr-prep did not commit.',
    '- pr-prep did not push.',
    '- pr-prep did not open a pull request.',
    '- pr-prep did not apply, publish, or deploy.',
    '',
    '## Next Step',
    '',
    summary.readyForPr
      ? '- Human may review these artifacts, run project tests, then create a branch/commit/PR manually.'
      : '- Resolve blockers or gates, rerun verification/ship, then rerun pr-prep.',
    '',
  ];
  return lines.join('\n');
}

function writeSummary(sessionDir, summary) {
  fs.writeFileSync(path.join(sessionDir, 'pr-prep-summary.json'), JSON.stringify({
    sessionId: summary.sessionId,
    task: summary.task,
    status: summary.status,
    decision: summary.decision,
    ready_for_pr: summary.readyForPr,
    ship_ready: summary.shipReady,
    no_ship: summary.noShip,
    human_gate: summary.humanGate,
    applied: summary.applied,
    verdict: summary.verdict,
    risk: summary.risk,
    files: summary.files,
    issues: summary.issues,
    artifacts: summary.artifacts,
    report_path: summary.reportPath,
    target_project_mutated: false,
    no_remote_mutation: true,
    safety_invariants: summary.safetyInvariants,
    generated_at: summary.generatedAt,
  }, null, 2));
}

function latestHandoff(data, stage) {
  return data.handoffs
    .map(row => row.value)
    .filter(handoff => handoff?.stage === stage)
    .sort((a, b) => Number(b.round || 1) - Number(a.round || 1))
    .at(0) || null;
}

function taskFromEvidence(data) {
  for (const file of ['auto-summary.json', 'build-summary.json', 'run-summary.json', 'ship-summary.json', 'work-summary.json', 'ask.json']) {
    const task = data.summaries[file]?.task;
    if (task) return task;
  }
  return null;
}

function riskSummary(data, ship, build) {
  const classification = ship.classification || build.classification || {};
  const intelligence = data.buildIntelligence || build.build_intelligence || {};
  return {
    risk: classification.risk || classification.risk_level || intelligence.risk || 'unknown',
    tags: unique([...(classification.tags || []), ...(intelligence.tags || [])]),
    requiresHumanGate: Boolean(classification.requiresHumanGate || classification.requires_human_gate),
    requiresCodexChallenge: Boolean(classification.requiresCodexChallenge || classification.requires_codex_challenge),
  };
}

function normalizeIssue(issue) {
  if (!issue || typeof issue !== 'object') return { summary: String(issue || '') };
  return {
    severity: issue.severity || 'unknown',
    category: issue.category || 'review',
    summary: issue.summary || issue.claim || 'review finding',
    claim: issue.claim || issue.summary || '',
    evidence: issue.evidence || '',
    required_fix: issue.required_fix || issue.suggested_fix || '',
    suggested_fix: issue.suggested_fix || '',
    confidence: issue.confidence ?? null,
    gate_required: Boolean(issue.gate_required),
  };
}

function summarizeTitle(task) {
  const clean = String(task || 'Prepare verified change for review').replace(/\s+/g, ' ').trim();
  return clean.length > 80 ? clean.slice(0, 77) + '...' : clean;
}

function listOrNone(items) {
  const filtered = (items || []).filter(Boolean);
  if (!filtered.length) return ['- None recorded.'];
  return filtered.map(item => item.startsWith('Evidence references ') ? `- ${item}` : `- \`${item}\``);
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function cell(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}
