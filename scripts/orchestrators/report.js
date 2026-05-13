import fs from 'node:fs';
import path from 'node:path';
import { resolveSessionId } from '../lib/session-resolver.js';

const SUMMARY_FILES = [
  'ask.json',
  'auto-summary.json',
  'build-summary.json',
  'work-summary.json',
  'verify-summary.json',
  'ship-summary.json',
  'gate-summary.json',
  'apply-summary.json',
  'run-summary.json',
];

const MARKERS = [
  'HUMAN_GATE',
  'GATE_APPROVED',
  'GATE_BLOCKED',
  'NO_SHIP',
  'SHIP_READY',
  'APPLIED_DIFF',
];

export function reportSession(opts) {
  const projectRoot = opts.projectRoot || process.cwd();
  if (!opts.sessionId) throw new Error('report requires --session <id>');

  const sessionId = resolveSessionId(projectRoot, opts.sessionId);
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  if (!fs.existsSync(sessionDir)) throw new Error('report requires an existing session');

  const data = readSessionEvidence(sessionDir);
  const status = deriveStatus(data);
  const markdown = renderReport({
    sessionId,
    sessionDir,
    generatedAt: new Date().toISOString(),
    data,
    status,
  });

  const summary = buildSummary({ sessionId, sessionDir, data, status });
  let reportPath = null;
  if (!opts.stdoutOnly) {
    reportPath = opts.outputPath
      ? path.resolve(opts.outputPath)
      : path.join(sessionDir, 'REPORT.md');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, markdown);
    fs.writeFileSync(path.join(sessionDir, 'report-summary.json'), JSON.stringify({
      ...summary,
      report_path: reportPath,
      target_project_mutated: false,
    }, null, 2));
  }

  return {
    ...summary,
    reportPath,
    markdown,
  };
}

function readSessionEvidence(sessionDir) {
  return {
    summaries: Object.fromEntries(SUMMARY_FILES.map(file => [file, readJson(path.join(sessionDir, file))])),
    buildIntelligence: readJson(path.join(sessionDir, 'build-intelligence.json')),
    buildPlan: readJson(path.join(sessionDir, 'build-plan.json')),
    parallelCandidates: readJson(path.join(sessionDir, 'parallel-candidates.json')),
    acceptance: readJson(path.join(sessionDir, 'acceptance-criteria.json')),
    markers: Object.fromEntries(MARKERS.map(name => [name, readMarker(path.join(sessionDir, name))])),
    handoffs: readHandoffs(path.join(sessionDir, 'handoffs')),
  };
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readMarker(file) {
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  return {
    file,
    raw,
    reason: raw.match(/^reason:\s*(.+)$/m)?.[1] || null,
    at: raw.match(/^at:\s*(.+)$/m)?.[1] || null,
  };
}

function readHandoffs(handoffDir) {
  if (!fs.existsSync(handoffDir)) return [];
  return fs.readdirSync(handoffDir)
    .filter(file => file.endsWith('.json'))
    .sort()
    .map(file => {
      const value = readJson(path.join(handoffDir, file));
      return value ? { file, value } : null;
    })
    .filter(Boolean);
}

function deriveStatus(data) {
  const m = data.markers;
  const run = data.summaries['run-summary.json'];
  const auto = data.summaries['auto-summary.json'];
  const build = data.summaries['build-summary.json'];
  const ship = data.summaries['ship-summary.json'];
  const verify = data.summaries['verify-summary.json'];
  const work = data.summaries['work-summary.json'];
  const ask = data.summaries['ask.json'];
  const gate = data.summaries['gate-summary.json'];
  const apply = data.summaries['apply-summary.json'];

  const humanOpen = Boolean(m.HUMAN_GATE) && (!m.GATE_APPROVED || markerTime(m.GATE_APPROVED) < markerTime(m.HUMAN_GATE));
  const noShipActive = Boolean(m.NO_SHIP) && (!m.SHIP_READY || markerTime(m.NO_SHIP) > markerTime(m.SHIP_READY));

  if (m.GATE_BLOCKED || gate?.blocked) return 'gate_blocked';
  if (humanOpen || gate?.status === 'open' || auto?.human_gate || build?.human_gate || run?.human_gate || ship?.human_gate || verify?.human_gate) return 'human_gate';
  if (m.APPLIED_DIFF || apply?.applied || build?.applied || run?.applied) return 'applied';
  if (noShipActive || auto?.no_ship || build?.no_ship || run?.no_ship || ship?.no_ship) return 'no_ship';
  if (m.SHIP_READY || auto?.ship_ready || build?.ship_ready || run?.ship_ready || ship?.ship_ready) return 'ship_ready';
  if (verify) return 'verified';
  if (work) return 'worked';
  if (ask) return 'asked';
  return 'session';
}

function markerTime(marker) {
  const time = Date.parse(marker?.at || '');
  return Number.isFinite(time) ? time : 0;
}

function buildSummary({ sessionId, sessionDir, data, status }) {
  const run = data.summaries['run-summary.json'];
  const auto = data.summaries['auto-summary.json'];
  const build = data.summaries['build-summary.json'];
  const ship = data.summaries['ship-summary.json'];
  const verify = data.summaries['verify-summary.json'];
  const work = data.summaries['work-summary.json'];
  const gate = data.summaries['gate-summary.json'];
  const apply = data.summaries['apply-summary.json'];
  const profile = build?.profile || run?.profile || verify?.profile || work?.profile || data.summaries['ask.json']?.profile || null;
  const verdict = build?.verdict || run?.verdict || ship?.verdict || verify?.verdict || null;
  const buildIntelligence = data.buildIntelligence || build?.build_intelligence || null;

  return {
    sessionId,
    sessionDir,
    status,
    verdict,
    mode: build?.mode || null,
    requestedMode: build?.requested_mode || null,
    buildIntelligence,
    parallelCandidates: data.parallelCandidates || auto?.parallel_candidates || null,
    profile,
    strictQuality: Boolean(build?.strict_quality || run?.strict_quality || verify?.strict_quality),
    strictQualityBlocked: Boolean(run?.strict_quality_blocked || verify?.strict_quality_blocked),
    autonomy: auto || null,
    shipReady: Boolean(data.markers.SHIP_READY || auto?.ship_ready || build?.ship_ready || run?.ship_ready || ship?.ship_ready),
    noShip: status === 'no_ship' || Boolean(auto?.no_ship || build?.no_ship || run?.no_ship || ship?.no_ship),
    humanGate: ['human_gate', 'gate_blocked'].includes(status) || Boolean(gate?.human_gate),
    applied: Boolean(data.markers.APPLIED_DIFF || apply?.applied || build?.applied || run?.applied),
    handoffs: data.handoffs.length,
    qualityWarnings: verify?.quality_warnings || [],
    acceptanceCoverage: verify?.acceptance_coverage || [],
    targetProjectMutated: Boolean(apply?.target_project_mutated || run?.target_project_mutated),
    nextStep: nextStep(status, { auto, build, run, ship, verify, gate, apply }),
  };
}

function nextStep(status, summaries) {
  if (status === 'gate_blocked') return 'do not ship; revise work or start a new cycle';
  if (status === 'human_gate') return 'human must approve or block the gate';
  if (status === 'no_ship') return 'fix findings, rerun verify, then rerun ship';
  if (status === 'ship_ready') return 'optionally run apply for live captured diffs';
  if (status === 'applied') return 'review git diff, run project tests, then commit manually';
  return summaries.build?.next_step || summaries.run?.next_step || summaries.ship?.next_step || summaries.verify?.next_step || 'continue the workflow';
}

function trustDecision(summary) {
  if (summary.status === 'gate_blocked') {
    return {
      headline: 'NEKOWORK blocked this change.',
      finalDecision: 'GATE_BLOCKED',
      blocked: true,
    };
  }
  if (summary.noShip || summary.status === 'no_ship') {
    return {
      headline: 'NEKOWORK blocked ship for this change.',
      finalDecision: 'NO_SHIP',
      blocked: true,
    };
  }
  if (summary.humanGate || summary.status === 'human_gate') {
    return {
      headline: 'NEKOWORK stopped this change at Human Gate.',
      finalDecision: 'HUMAN_GATE',
      blocked: true,
    };
  }
  if (summary.applied || summary.status === 'applied') {
    return {
      headline: 'NEKOWORK applied the verified diff.',
      finalDecision: 'APPLIED',
      blocked: false,
    };
  }
  if (summary.shipReady || summary.status === 'ship_ready') {
    return {
      headline: 'NEKOWORK marked this change ship-ready for human-controlled apply.',
      finalDecision: 'SHIP_READY',
      blocked: false,
    };
  }
  if (summary.status === 'verified') {
    return {
      headline: 'NEKOWORK verified this work and is waiting for ship readiness.',
      finalDecision: 'VERIFIED',
      blocked: false,
    };
  }
  if (summary.status === 'worked') {
    return {
      headline: 'NEKOWORK produced work that still needs verification.',
      finalDecision: 'WORKED',
      blocked: false,
    };
  }
  return {
    headline: 'NEKOWORK recorded session evidence.',
    finalDecision: String(summary.status || 'session').toUpperCase(),
    blocked: false,
  };
}

function trustReason(data, summary) {
  return data.markers.GATE_BLOCKED?.reason
    || data.markers.NO_SHIP?.reason
    || data.markers.HUMAN_GATE?.reason
    || summary.nextStep
    || 'n/a';
}

function evidenceFiles(data) {
  return [
    ...SUMMARY_FILES.filter(file => data.summaries[file]),
    data.buildIntelligence ? 'build-intelligence.json' : null,
    data.buildPlan ? 'build-plan.json' : null,
    data.parallelCandidates ? 'parallel-candidates.json' : null,
    data.acceptance ? 'acceptance-criteria.json' : null,
    ...MARKERS.filter(name => data.markers[name]),
  ].filter(Boolean);
}

function renderReport({ sessionId, sessionDir, generatedAt, data, status }) {
  const summary = buildSummary({ sessionId, sessionDir, data, status });
  const lines = [];
  lines.push('# NEKOWORK Session Report');
  lines.push('');
  lines.push(`Session: \`${sessionId}\``);
  lines.push(`Status: \`${summary.status}\``);
  lines.push(`Verdict: \`${summary.verdict || 'n/a'}\``);
  lines.push(`Generated: ${generatedAt}`);
  lines.push('');
  addTrustCardSection(lines, data, summary);
  lines.push('## Summary');
  lines.push('');
  if (summary.mode) lines.push(`- Build Mode: ${summary.mode}`);
  lines.push(`- Profile: ${summary.profile || 'none'}`);
  lines.push(`- Strict quality: ${summary.strictQuality ? (summary.strictQualityBlocked ? 'blocked' : 'enabled') : 'off'}`);
  lines.push(`- Human Gate: ${summary.humanGate ? 'yes' : 'no'}`);
  lines.push(`- Ship Ready: ${summary.shipReady ? 'yes' : 'no'}`);
  lines.push(`- No Ship: ${summary.noShip ? 'yes' : 'no'}`);
  lines.push(`- Applied: ${summary.applied ? 'yes' : 'no'}`);
  lines.push(`- Target Project Mutated: ${summary.targetProjectMutated ? 'yes' : 'no'}`);
  lines.push(`- Next Step: ${summary.nextStep}`);
  lines.push('');
  addBuildIntelligenceSection(lines, data, summary);
  addAutonomySection(lines, data, summary);
  addParallelCandidatesSection(lines, data, summary);
  addAcceptanceSection(lines, data);
  addWarningsSection(lines, summary.qualityWarnings);
  addHandoffsSection(lines, data.handoffs);
  addEvidenceSection(lines, data, sessionDir);
  return lines.join('\n') + '\n';
}

function addTrustCardSection(lines, data, summary) {
  const decision = trustDecision(summary);
  const verified = Boolean(data.summaries['verify-summary.json'] || data.handoffs.some(handoff => handoff.value?.stage === 'codex-review'));
  const workProduced = Boolean(data.summaries['work-summary.json'] || data.handoffs.some(handoff => handoff.value?.stage === 'implement'));
  const gateState = summary.humanGate
    ? (summary.status === 'gate_blocked' ? 'blocked' : 'required')
    : 'clear';
  const applyState = summary.applied ? 'applied' : 'not applied';
  const evidence = evidenceFiles(data)
    .slice(0, 8)
    .map(file => `\`${file}\``)
    .join(', ') || 'none';

  lines.push('## Trust Card');
  lines.push('');
  lines.push(decision.headline);
  lines.push('');
  lines.push('| Check | State |');
  lines.push('| --- | --- |');
  lines.push(`| Final decision | ${decision.finalDecision} |`);
  lines.push(`| Blocked | ${decision.blocked ? 'yes' : 'no'} |`);
  lines.push(`| Why | ${escapeTable(trustReason(data, summary)) || 'n/a'} |`);
  lines.push(`| Work produced | ${workProduced ? 'yes' : 'no'} |`);
  lines.push(`| Independent verification | ${verified ? 'yes' : 'no'} |`);
  lines.push(`| Human Gate | ${gateState} |`);
  lines.push(`| Ship ready | ${summary.shipReady ? 'yes' : 'no'} |`);
  lines.push(`| Apply | ${applyState} |`);
  lines.push(`| Target project mutated | ${summary.targetProjectMutated ? 'yes' : 'no'} |`);
  lines.push(`| Evidence | ${evidence} |`);
  lines.push('');
  lines.push(`Decision: ${summary.nextStep}`);
  lines.push('');
}

function addAutonomySection(lines, data, summary) {
  const auto = data.summaries['auto-summary.json'] || summary.autonomy;
  if (!auto) return;

  lines.push('## Bounded Autonomy');
  lines.push('');
  lines.push(`- Level: ${auto.level || 'normal'}`);
  lines.push(`- Selected mode: ${auto.selected_mode || summary.mode || 'n/a'}`);
  lines.push(`- Rounds: ${Array.isArray(auto.rounds) ? auto.rounds.length : 0}/${auto.policy?.maxRounds || 'n/a'}`);
  lines.push(`- Stop reason: ${auto.stop_reason || 'n/a'}`);
  lines.push(`- Apply: ${auto.applied ? 'applied' : 'not automatic'}`);
  lines.push('');
}

function addParallelCandidatesSection(lines, data, summary) {
  const parallel = data.parallelCandidates || summary.parallelCandidates;
  if (!parallel) return;

  lines.push('## Parallel Candidates');
  lines.push('');
  lines.push(`- Status: ${parallel.status || 'recorded'}`);
  lines.push(`- Count: ${parallel.count || 0}`);
  lines.push(`- Canonical diff: ${parallel.arbiter?.selected_candidate || parallel.arbiter?.selectedCandidate || 'not selected'}`);
  lines.push(`- Arbiter: ${parallel.arbiter?.reason || 'candidate evidence only'}`);
  lines.push('- Apply: not automatic');
  lines.push('');

  const candidates = parallel.candidates || [];
  if (!candidates.length) {
    lines.push('- No candidate records found.');
    lines.push('');
    return;
  }

  lines.push('| Candidate | Isolation | Status | Files | Selected |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const candidate of candidates) {
    lines.push(`| ${escapeTable(candidate.id)} | ${escapeTable(candidate.isolation || '')} | ${escapeTable(candidate.status || '')} | ${escapeTable((candidate.files || []).join(', ') || 'none')} | ${candidate.selected ? 'yes' : 'no'} |`);
  }
  lines.push('');
}

function addBuildIntelligenceSection(lines, data, summary) {
  const intelligence = data.buildIntelligence || summary.buildIntelligence;
  const build = data.summaries['build-summary.json'];
  if (!intelligence && !build?.build_intelligence) return;

  const info = intelligence || build.build_intelligence;
  const selectedMode = build?.mode || info.recommended_mode || summary.mode || 'n/a';
  const requestedMode = build?.requested_mode || summary.requestedMode || (build?.auto_mode ? 'auto' : selectedMode);
  const workers = info.workers || build?.team_workers || [];
  const reasons = info.explanation || info.reasons || [];

  lines.push('## Build Intelligence');
  lines.push('');
  lines.push(`- Requested mode: ${requestedMode}`);
  lines.push(`- Selected mode: ${selectedMode}`);
  lines.push(`- Task type: ${info.taskType || info.task_type || 'n/a'}`);
  lines.push(`- Risk: ${info.risk || 'n/a'}${info.tags?.length ? ` (${info.tags.join(', ')})` : ''}`);
  lines.push(`- Workers: ${workers.length ? workers.join(', ') : 'none'}`);
  lines.push('');
  if (reasons.length) {
    lines.push('Why:');
    for (const [index, reason] of reasons.entries()) {
      if (index === 0 && reason.endsWith(':')) lines.push(reason);
      else lines.push(reason.startsWith('- ') ? reason : `- ${reason}`);
    }
    lines.push('');
  }
}

function addAcceptanceSection(lines, data) {
  const criteria = data.acceptance?.criteria || [];
  const coverage = data.summaries['verify-summary.json']?.acceptance_coverage || [];
  lines.push('## Acceptance Criteria');
  lines.push('');
  if (!criteria.length && !coverage.length) {
    lines.push('- No acceptance criteria artifact found.');
    lines.push('');
    return;
  }

  lines.push('| ID | Status | Evidence |');
  lines.push('| --- | --- | --- |');
  const rows = criteria.length ? criteria : coverage;
  for (const ac of rows) {
    const covered = coverage.find(row => row.id === ac.id);
    lines.push(`| ${escapeTable(ac.id || 'AC')} | ${escapeTable(covered?.status || (ac.passes ? 'pass' : 'recorded'))} | ${escapeTable(covered?.evidence || ac.desc || '')} |`);
  }
  lines.push('');
}

function addWarningsSection(lines, warnings) {
  lines.push('## Quality Warnings');
  lines.push('');
  if (!warnings?.length) {
    lines.push('- None recorded.');
    lines.push('');
    return;
  }
  for (const warning of warnings) lines.push(`- ${warning}`);
  lines.push('');
}

function addHandoffsSection(lines, handoffs) {
  lines.push('## Handoffs');
  lines.push('');
  if (!handoffs.length) {
    lines.push('- No handoffs found.');
    lines.push('');
    return;
  }
  lines.push('| File | Stage | Agent | Verdict | Files |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const row of handoffs) {
    const h = row.value;
    lines.push(`| ${escapeTable(row.file)} | ${escapeTable(h.stage || '')} | ${escapeTable(h.agent || '')} | ${escapeTable(h.verdict || '')} | ${escapeTable((h.files || []).join(', '))} |`);
  }
  lines.push('');
}

function addEvidenceSection(lines, data, sessionDir) {
  lines.push('## Evidence Files');
  lines.push('');
  const files = evidenceFiles(data);
  if (!files.length) {
    lines.push('- No summary files found.');
  } else {
    for (const file of files) lines.push(`- \`${path.relative(sessionDir, path.join(sessionDir, file)).replace(/\\/g, '/')}\``);
  }
  lines.push('');
}

function escapeTable(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

export {
  deriveStatus as _deriveStatus,
  readSessionEvidence as _readSessionEvidence,
};
