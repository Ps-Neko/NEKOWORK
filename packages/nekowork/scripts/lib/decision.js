import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DECISION_VERSION = 'decision-v0';

const SUMMARY_FILES = [
  'ask.json',
  'auto-summary.json',
  'build-summary.json',
  'work-summary.json',
  'preverify-summary.json',
  'verify-summary.json',
  'ship-summary.json',
  'pr-prep-summary.json',
  'gate-summary.json',
  'apply-summary.json',
  'run-summary.json',
  'report-summary.json',
];

const MARKERS = [
  'HUMAN_GATE',
  'GATE_APPROVED',
  'GATE_BLOCKED',
  'NO_SHIP',
  'SHIP_READY',
  'APPLIED_DIFF',
];

export function writeDecision(sessionDir, opts = {}) {
  const decision = buildDecision(sessionDir, opts);
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, 'decision.json'), JSON.stringify(decision, null, 2));
  return decision;
}

export function buildDecision(sessionDir, opts = {}) {
  const summaries = Object.fromEntries(SUMMARY_FILES.map(file => [file, readJson(path.join(sessionDir, file))]));
  const markers = Object.fromEntries(MARKERS.map(name => [name, readMarker(path.join(sessionDir, name))]));
  const handoffs = readHandoffs(path.join(sessionDir, 'handoffs'));
  const gate = deriveGate(markers, summaries['gate-summary.json']);
  const noShip = activeMarker(markers.NO_SHIP, markers.SHIP_READY) ||
    Boolean(summaries['auto-summary.json']?.no_ship || summaries['build-summary.json']?.no_ship || summaries['run-summary.json']?.no_ship || summaries['ship-summary.json']?.no_ship);
  const shipReady = Boolean(markers.SHIP_READY || summaries['auto-summary.json']?.ship_ready || summaries['build-summary.json']?.ship_ready || summaries['run-summary.json']?.ship_ready || summaries['ship-summary.json']?.ship_ready);
  const applied = Boolean(markers.APPLIED_DIFF || summaries['apply-summary.json']?.applied || summaries['build-summary.json']?.applied || summaries['run-summary.json']?.applied);
  const preverify = summaries['preverify-summary.json'];
  const verify = summaries['verify-summary.json'];
  const ship = summaries['ship-summary.json'];
  const build = summaries['build-summary.json'];
  const run = summaries['run-summary.json'];
  const apply = summaries['apply-summary.json'];
  const report = summaries['report-summary.json'];
  const latestImplement = latestStageHandoff(handoffs, 'implement');
  const diff = readDiff(sessionDir, latestImplement);
  const diffHash = diff ? sha256(diff) : null;
  const risk = deriveRisk({ preverify, verify, ship, build });
  const status = deriveStatus({ gate, noShip, shipReady, applied, verify, latestImplement });
  const verdict = deriveVerdict({ status, gate, noShip, shipReady, applied, verify, ship, run, build });
  const applyAllowed = Boolean(shipReady && !noShip && gate.state !== 'required' && gate.state !== 'blocked' && !applied);
  const reason = deriveReason({ gate, markers, preverify, ship, verify, run, build, apply, report });
  const evidence = evidenceFiles({ summaries, markers, preverify });
  const runtime = deriveRuntime(handoffs);

  return {
    version: DECISION_VERSION,
    session_id: opts.sessionId || basename(sessionDir),
    updated_at: new Date().toISOString(),
    updated_by: opts.stage || null,
    status,
    verdict,
    reason,
    next: nextStep({ status, applyAllowed, applied, gate, noShip, shipReady, summaries }),
    runtime,
    risk,
    ship_ready: shipReady,
    no_ship: noShip,
    human_gate: gate.state,
    apply_allowed: applyAllowed,
    applied,
    target_project_mutated: Boolean(apply?.target_project_mutated || run?.target_project_mutated || build?.target_project_mutated),
    diff_hash: diffHash,
    files: latestImplement?.files || [],
    verifier: {
      verdict: verify?.verdict || ship?.verification_verdict || null,
      codex_review: verify?.codex_review_verdict || ship?.codex_review_verdict || null,
      codex_challenge: verify?.codex_challenge_verdict || ship?.codex_challenge_verdict || null,
      preverify: preverify ? {
        verdict: preverify.verdict,
        finding_count: preverify.finding_count,
        gate_required: preverify.gate_required,
      } : null,
    },
    approval: {
      actor: gate.approvalActor,
      reason: gate.approvalReason,
      at: gate.approvalAt,
    },
    evidence,
  };
}

function deriveGate(markers, gateSummary) {
  if (markers.GATE_BLOCKED || gateSummary?.blocked) {
    return {
      state: 'blocked',
      reason: markers.GATE_BLOCKED?.reason || gateSummary?.block_reason || gateSummary?.reason || null,
      approvalReason: gateSummary?.approval_reason || markers.GATE_APPROVED?.reason || null,
      approvalAt: markers.GATE_APPROVED?.at || null,
      approvalActor: markers.GATE_APPROVED?.actor || gateSummary?.approval_actor || null,
    };
  }

  const humanOpen = Boolean(markers.HUMAN_GATE) && (!markers.GATE_APPROVED || markerTime(markers.GATE_APPROVED) < markerTime(markers.HUMAN_GATE));
  if (humanOpen || gateSummary?.status === 'open') {
    return {
      state: 'required',
      reason: markers.HUMAN_GATE?.reason || gateSummary?.human_gate_reason || gateSummary?.reason || null,
      approvalReason: gateSummary?.approval_reason || null,
      approvalAt: markers.GATE_APPROVED?.at || null,
      approvalActor: markers.GATE_APPROVED?.actor || gateSummary?.approval_actor || null,
    };
  }

  if (markers.GATE_APPROVED || gateSummary?.approved) {
    return {
      state: 'approved',
      reason: null,
      approvalReason: markers.GATE_APPROVED?.reason || gateSummary?.approval_reason || null,
      approvalAt: markers.GATE_APPROVED?.at || null,
      approvalActor: markers.GATE_APPROVED?.actor || gateSummary?.approval_actor || null,
    };
  }

  return {
    state: 'clear',
    reason: null,
    approvalReason: null,
    approvalAt: null,
    approvalActor: null,
  };
}

function deriveStatus({ gate, noShip, shipReady, applied, verify, latestImplement }) {
  if (gate.state === 'blocked') return 'gate_blocked';
  if (gate.state === 'required') return 'human_gate';
  if (applied) return 'applied';
  if (noShip) return 'no_ship';
  if (shipReady) return 'ship_ready';
  if (verify) return 'verified';
  if (latestImplement) return 'worked';
  return 'session';
}

function deriveVerdict({ status, gate, noShip, shipReady, applied, verify, ship, run, build }) {
  if (gate.state === 'blocked' || gate.state === 'required' || noShip) return 'blocked';
  if (applied) return 'applied';
  if (shipReady) return 'ship_ready';
  if (verify?.verdict === 'approve_with_fixes' || ship?.verdict === 'approve_with_fixes' || run?.verdict === 'approve_with_fixes' || build?.verdict === 'approve_with_fixes') return 'needs_fixes';
  if (verify?.verdict === 'approve' || ship?.verdict === 'approve' || run?.verdict === 'approve' || build?.verdict === 'approve') return 'approved';
  return status || 'session';
}

function deriveRisk({ preverify, verify, ship, build }) {
  const level = maxRisk([
    preverify?.risk_level,
    verify?.risk_level,
    ship?.risk_level,
    build?.build_intelligence?.risk,
  ]);
  const tags = [
    ...(preverify?.risk_tags || []),
    ...(verify?.risk_tags || []),
    ...(ship?.risk_tags || []),
    ...(build?.build_intelligence?.tags || []),
  ];
  return {
    level,
    tags: [...new Set(tags)].sort(),
  };
}

function deriveRuntime(handoffs) {
  const providers = new Set();
  for (const handoff of handoffs) {
    if (handoff?.provider) providers.add(String(handoff.provider));
  }

  if (providers.size === 0) {
    const envLive = process.env.HARNESS_LIVE === '1' || /^(true|live)$/i.test(process.env.HARNESS_MODE || '');
    return {
      mode: envLive ? 'live' : 'mock',
      providers: [],
      source: 'fallback',
    };
  }

  const sorted = [...providers].sort();
  const live = sorted.filter(provider => provider !== 'mock');
  const hasMock = providers.has('mock');

  let mode;
  if (live.length === 0) mode = 'mock';
  else if (hasMock) mode = 'mixed';
  else mode = 'live';

  return { mode, providers: sorted, source: 'handoff' };
}

function deriveReason({ gate, markers, preverify, ship, verify, run, build, apply, report }) {
  return gate.reason ||
    markers.NO_SHIP?.reason ||
    markers.APPLIED_DIFF?.reason ||
    preverify?.reason ||
    ship?.reason ||
    verify?.reason ||
    run?.apply_skipped_reason ||
    build?.next_step ||
    apply?.reason ||
    report?.nextStep ||
    null;
}

function nextStep({ status, applyAllowed, applied, gate, noShip, shipReady, summaries }) {
  if (gate.state === 'blocked') return 'do not ship; revise work or start a new cycle';
  if (gate.state === 'required') return 'human must approve or block the gate';
  if (noShip) return 'fix findings, rerun verify, then rerun ship';
  if (applyAllowed) return 'run apply only if you want to apply the verified live-work diff';
  if (applied) return 'review git diff, run project tests, then commit manually';
  if (shipReady) return 'inspect REPORT.md, then decide whether to apply';
  return summaries['build-summary.json']?.next_step ||
    summaries['run-summary.json']?.next_step ||
    summaries['ship-summary.json']?.next_step ||
    summaries['verify-summary.json']?.next_step ||
    'continue the workflow';
}

function evidenceFiles({ summaries, markers }) {
  return [
    ...SUMMARY_FILES.filter(file => summaries[file]),
    'decision.json',
    ...MARKERS.filter(name => markers[name]),
  ];
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
    actor: raw.match(/^actor:\s*(.+)$/m)?.[1] || null,
    at: raw.match(/^at:\s*(.+)$/m)?.[1] || null,
  };
}

function readHandoffs(handoffDir) {
  if (!fs.existsSync(handoffDir)) return [];
  return fs.readdirSync(handoffDir)
    .filter(file => file.endsWith('.json'))
    .sort()
    .map(file => readJson(path.join(handoffDir, file)))
    .filter(Boolean);
}

function latestStageHandoff(handoffs, stage) {
  return handoffs
    .filter(h => h.stage === stage)
    .sort((a, b) => Number(b.round || 1) - Number(a.round || 1))
    .at(0) || null;
}

function readDiff(sessionDir, handoff) {
  const candidates = [];
  if (handoff?.diffPath) candidates.push(handoff.diffPath);
  const diffDir = path.join(sessionDir, 'diffs');
  if (fs.existsSync(diffDir)) {
    candidates.push(...fs.readdirSync(diffDir).filter(f => f.endsWith('.diff')).sort().reverse().map(f => path.join(diffDir, f)));
  }
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
    } catch {}
  }
  return '';
}

function activeMarker(marker, clearedBy) {
  if (!marker) return false;
  if (!clearedBy) return true;
  return markerTime(marker) > markerTime(clearedBy);
}

function markerTime(marker) {
  const time = Date.parse(marker?.at || '');
  return Number.isFinite(time) ? time : 0;
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function maxRisk(levels) {
  const order = ['low', 'medium', 'high', 'critical'];
  let score = 0;
  for (const level of levels.filter(Boolean)) {
    score = Math.max(score, order.indexOf(level));
  }
  return order[Math.max(0, score)] || 'low';
}

function basename(file) {
  return path.basename(path.resolve(file));
}
