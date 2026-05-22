import fs from 'node:fs';
import path from 'node:path';
import { dispatch } from '../agents/dispatch.js';
import { withExecutionWorkspace } from '../core/execution-workspace.js';

const MAX_PARALLEL_CANDIDATES = 4;

export function normalizeParallelCandidateCount(value) {
  if (value == null || value === '' || value === false) return 0;
  const n = Number(value);
  if (!Number.isInteger(n)) throw new Error(`--parallel-candidates requires an integer between 2 and ${MAX_PARALLEL_CANDIDATES}`);
  if (n === 0) return 0;
  if (n < 2 || n > MAX_PARALLEL_CANDIDATES) {
    throw new Error(`--parallel-candidates requires an integer between 2 and ${MAX_PARALLEL_CANDIDATES}`);
  }
  return n;
}

export function parallelCandidatePlan(opts = {}) {
  const count = normalizeParallelCandidateCount(opts.count);
  if (!count) {
    return {
      enabled: false,
      count: 0,
      maxCount: MAX_PARALLEL_CANDIDATES,
      candidates: [],
    };
  }

  return {
    enabled: true,
    count,
    maxCount: MAX_PARALLEL_CANDIDATES,
    status: 'planned',
    isolation: 'candidate writers must use isolated worktrees, temp projects, or isolated diff captures',
    candidates: Array.from({ length: count }, (_, index) => candidatePlan(index + 1, count)),
    arbiter: {
      status: 'not_selected',
      selectedCandidate: null,
      reason: 'alpha.10 preview records candidate evidence, verification, arbiter selection, and canonical final verification',
    },
    safetyInvariants: parallelSafetyInvariants(),
  };
}

export async function runParallelCandidates(opts = {}) {
  const count = normalizeParallelCandidateCount(opts.count);
  if (!count) return null;
  if (!opts.task) throw new Error('parallel candidates require a task');
  if (!opts.sessionDir) throw new Error('parallel candidates require a session directory');

  const sessionDir = opts.sessionDir;
  const candidateDir = path.join(sessionDir, 'parallel-candidates');
  fs.mkdirSync(candidateDir, { recursive: true });

  const dispatcher = opts.dispatcher || dispatch;
  const candidates = [];
  for (let index = 1; index <= count; index++) {
    const candidate = await runCandidate({
      ...opts,
      index,
      count,
      candidateDir,
      dispatcher,
    });
    candidates.push(candidate);
  }
  const verification = await verifyCandidates({
    ...opts,
    candidateDir,
    candidates,
    dispatcher,
  });
  const arbiter = arbitrateCandidates({ sessionDir, candidates, verification });
  for (const candidate of candidates) {
    candidate.selected = arbiter.selected_candidate === candidate.id;
    candidate.ship_candidate = false;
    candidate.remaining = candidate.selected
      ? 'selected as canonical evidence; final Codex verification still required'
      : 'not selected by candidate arbiter';
  }
  refreshCandidateArtifacts(candidateDir, candidates);
  const canonical = await promoteCanonicalCandidate({
    ...opts,
    sessionDir,
    candidateDir,
    arbiter,
    candidates,
    dispatcher,
  });

  const summary = {
    sessionId: opts.sessionId,
    task: opts.task,
    status: arbiter.status === 'selected' ? 'selected' : 'no_clean_candidate',
    count,
    max_count: MAX_PARALLEL_CANDIDATES,
    live: Boolean(opts.live),
    candidates,
    verification,
    arbiter,
    canonical,
    ship_ready: Boolean(canonical.ship_candidate),
    no_ship: !canonical.ship_candidate,
    target_project_mutated: false,
    safety_invariants: parallelSafetyInvariants(),
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(sessionDir, 'parallel-candidates.json'), JSON.stringify(summary, null, 2));
  return summary;
}

function candidatePlan(index, count) {
  return {
    id: candidateId(index),
    worker: `candidate-writer-${index}`,
    role: 'isolated patch proposal',
    status: 'planned',
    selected: false,
    shipCandidate: false,
    isolation: 'isolated-diff-capture',
    note: `candidate ${index}/${count} may propose a patch, but cannot become ship-ready without arbiter and Codex verification`,
  };
}

async function runCandidate(opts) {
  const id = candidateId(opts.index);
  const context = {
    parallelCandidate: true,
    candidateId: id,
    candidateIndex: opts.index,
    candidateCount: opts.count,
    evidenceOnly: true,
    singleExecutor: true,
    finalDiffAuthority: false,
  };
  const task = `${opts.task}\n\nParallel candidate ${opts.index}/${opts.count}: propose an isolated fix candidate. This candidate is evidence only; do not treat it as ship-ready or applied.`;

  const execution = opts.live
    ? await withExecutionWorkspace(
      opts.projectRoot,
      opts.sessionDir,
      async (workspaceRoot) => dispatcherCall({
        ...opts,
        task,
        context,
        projectRoot: workspaceRoot,
        live: true,
        executionMode: 'workspace-write',
      }),
      { sessionId: `${opts.sessionId}-${id}`, stage: id, round: 1 },
    )
    : null;

  const handoff = execution
    ? execution.result
    : await dispatcherCall({ ...opts, task, context, live: false, executionMode: 'isolated-candidate' });
  const files = dedupe([...(handoff.files || []), ...(execution?.files || [])]);
  const candidate = {
    id,
    worker: `candidate-writer-${opts.index}`,
    stage: 'candidate',
    status: 'captured',
    selected: false,
    ship_candidate: false,
    evidence_only: true,
    isolation: opts.live ? 'isolated-git-worktree' : 'mock-isolated-handoff',
    agent: handoff.agent || 'executor',
    provider: handoff.provider || 'mock',
    model: handoff.model || null,
    verdict: handoff.verdict || 'proposal',
    files,
    diff_path: execution?.diffPath || null,
    artifact_path: path.join(opts.candidateDir, `${id}.json`),
    risks: handoff.risks || '',
    remaining: handoff.remaining || 'arbiter selection and final Codex verification required',
  };

  fs.writeFileSync(path.join(opts.candidateDir, `${id}.json`), JSON.stringify({
    ...candidate,
    handoff,
  }, null, 2));
  fs.writeFileSync(path.join(opts.candidateDir, `${id}.md`), renderCandidate(candidate));
  return candidate;
}

async function verifyCandidates(opts) {
  const verified = [];
  for (const candidate of opts.candidates) {
    const handoff = await dispatcherCall({
      ...opts,
      agent: 'codex-reviewer',
      stage: 'codex-review',
      task: `${opts.task}\n\nVerify parallel candidate ${candidate.id}. This is candidate verification only; do not mark it ship-ready or applied.`,
      context: {
        parallelCandidateVerification: true,
        candidateId: candidate.id,
        candidate,
        evidenceOnly: true,
        finalDiffAuthority: false,
      },
      live: Boolean(opts.live),
      executionMode: 'candidate-verification',
    });
    const verification = {
      id: candidate.id,
      verifier: handoff.agent || 'codex-reviewer',
      provider: handoff.provider || 'mock',
      model: handoff.model || null,
      verdict: handoff.verdict || 'approve',
      issues: handoff.issues || [],
      confidence: handoff.confidence ?? null,
      selectable: isSelectable(handoff),
      reason: verificationReason(handoff),
    };
    verified.push(verification);
    fs.writeFileSync(path.join(opts.candidateDir, `${candidate.id}-verification.json`), JSON.stringify({
      ...verification,
      handoff,
    }, null, 2));
    fs.writeFileSync(path.join(opts.candidateDir, `${candidate.id}-verification.md`), renderCandidateVerification(verification));
  }

  const summary = {
    status: 'completed',
    candidates: verified,
    selectable_count: verified.filter(v => v.selectable).length,
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(opts.sessionDir, 'candidate-verification.json'), JSON.stringify(summary, null, 2));
  return summary;
}

function arbitrateCandidates({ sessionDir, candidates, verification }) {
  const verified = verification?.candidates || [];
  const ranked = verified
    .map(v => ({
      ...v,
      score: candidateScore(v, candidates.find(candidate => candidate.id === v.id)),
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const selected = ranked.find(v => v.selectable);
  const arbiter = selected
    ? {
        status: 'selected',
        selected_candidate: selected.id,
        reason: `${selected.id} is the highest-ranked clean candidate; it still requires final Codex verification before ship/apply.`,
        ranked_candidates: ranked,
        final_codex_verification_required: true,
        ship_candidate: false,
      }
    : {
        status: 'rejected',
        selected_candidate: null,
        reason: 'No candidate passed candidate verification cleanly; no canonical candidate can be promoted.',
        ranked_candidates: ranked,
        final_codex_verification_required: true,
        ship_candidate: false,
      };
  fs.writeFileSync(path.join(sessionDir, 'candidate-arbiter.json'), JSON.stringify(arbiter, null, 2));
  return arbiter;
}

async function promoteCanonicalCandidate(opts) {
  const { sessionDir, arbiter, candidates } = opts;
  if (arbiter.status !== 'selected') {
    const rejected = {
      status: 'not_promoted',
      selected_candidate: null,
      reason: arbiter.reason,
      ship_candidate: false,
      final_codex_verification_required: true,
    };
    fs.writeFileSync(path.join(sessionDir, 'canonical-candidate.json'), JSON.stringify(rejected, null, 2));
    return rejected;
  }

  const candidate = candidates.find(c => c.id === arbiter.selected_candidate);
  const canonicalDiffPath = copyCanonicalDiff(sessionDir, candidate);
  let canonical = {
    status: 'selected_evidence',
    selected_candidate: candidate?.id || arbiter.selected_candidate,
    source_candidate: candidate,
    canonical_diff_path: canonicalDiffPath,
    ship_candidate: false,
    final_codex_verification_required: true,
    reason: 'Selected candidate is canonical evidence only until final Codex verification promotes a real ship-ready diff.',
  };
  const finalVerification = await verifyCanonicalCandidate({
    ...opts,
    candidate,
    canonical,
  });
  const handoffPromotion = promoteCanonicalHandoffs({
    sessionDir,
    sessionId: opts.sessionId,
    candidate,
    canonical,
    finalVerification,
  });
  canonical = {
    ...canonical,
    status: handoffPromotion.promoted ? 'promoted_for_ship' : 'final_verification_failed',
    ship_candidate: handoffPromotion.promoted,
    final_codex_verification_required: false,
    final_verification: finalVerification.summary,
    handoff_promotion: handoffPromotion,
    reason: handoffPromotion.promoted
      ? 'Selected candidate was promoted into the canonical handoff path after final Codex verification.'
      : 'Selected candidate failed final Codex verification and was not promoted to ship-ready work.',
  };
  fs.writeFileSync(path.join(sessionDir, 'canonical-candidate.json'), JSON.stringify(canonical, null, 2));
  return canonical;
}

async function verifyCanonicalCandidate(opts) {
  const diff = readTextIfExists(opts.canonical?.canonical_diff_path);
  const handoff = await dispatcherCall({
    ...opts,
    agent: 'codex-reviewer',
    stage: 'codex-review',
    task: `${opts.task}\n\nFinal verification for selected parallel candidate ${opts.candidate?.id}. This is the final canonical candidate check before ship readiness. Apply remains explicit.`,
    context: {
      canonicalCandidateFinalVerification: true,
      selectedCandidate: opts.candidate,
      canonicalCandidate: opts.canonical,
      diff,
      finalDiffAuthority: true,
      applyBoundary: 'explicit-only',
    },
    live: Boolean(opts.live),
    executionMode: 'canonical-candidate-verification',
  });
  const summary = {
    status: 'completed',
    selected_candidate: opts.candidate?.id || null,
    verifier: handoff.agent || 'codex-reviewer',
    provider: handoff.provider || 'mock',
    model: handoff.model || null,
    verdict: handoff.verdict || 'approve',
    issues: handoff.issues || [],
    files: handoff.files || opts.candidate?.files || [],
    confidence: handoff.confidence ?? null,
    promoted: isSelectable(handoff),
    diff_path: opts.canonical?.canonical_diff_path || null,
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(opts.sessionDir, 'canonical-verify-summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(opts.candidateDir, 'canonical-final-verification.json'), JSON.stringify({
    ...summary,
    handoff,
  }, null, 2));
  fs.writeFileSync(path.join(opts.candidateDir, 'canonical-final-verification.md'), renderCanonicalVerification(summary));
  return { summary, handoff };
}

function promoteCanonicalHandoffs({ sessionDir, sessionId, candidate = {}, canonical = {}, finalVerification }) {
  const handoffDir = path.join(sessionDir, 'handoffs');
  fs.mkdirSync(handoffDir, { recursive: true });
  const promoted = Boolean(finalVerification?.summary?.promoted);
  if (!promoted) {
    return {
      promoted: false,
      reason: `final canonical verification verdict: ${finalVerification?.summary?.verdict || 'unknown'}`,
    };
  }

  const implement = canonicalImplementHandoff({ candidate, canonical, sessionId });
  const review = canonicalReviewHandoff({ finalVerification, sessionId });
  writeHandoff(handoffDir, '03-implement', implement);
  writeHandoff(handoffDir, '05-codex-review', review);
  return {
    promoted: true,
    implement_handoff: 'handoffs/03-implement.json',
    codex_review_handoff: 'handoffs/05-codex-review.json',
    reason: 'canonical candidate handoffs were written for ship readiness',
  };
}

async function dispatcherCall(opts) {
  return opts.dispatcher({
    agent: opts.agent || 'executor',
    stage: opts.stage || 'implement',
    task: opts.task,
    live: Boolean(opts.live),
    harnessRoot: opts.harnessRoot,
    projectRoot: opts.projectRoot,
    sessionDir: opts.sessionDir,
    sessionId: opts.sessionId,
    context: opts.context,
    executionMode: opts.executionMode,
  });
}

function candidateId(index) {
  return `candidate-${String(index).padStart(2, '0')}`;
}

function renderCandidate(candidate) {
  const lines = [];
  lines.push(`# Parallel Candidate: ${candidate.id}`);
  lines.push('');
  lines.push(`- Worker: ${candidate.worker}`);
  lines.push(`- Isolation: ${candidate.isolation}`);
  lines.push(`- Evidence only: ${candidate.evidence_only ? 'yes' : 'no'}`);
  lines.push(`- Selected: ${candidate.selected ? 'yes' : 'no'}`);
  lines.push(`- Files: ${candidate.files.length ? candidate.files.join(', ') : 'none'}`);
  if (candidate.diff_path) lines.push(`- Diff: ${candidate.diff_path}`);
  lines.push(`- Remaining: ${candidate.remaining}`);
  lines.push('');
  lines.push('This candidate is not ship-ready. A canonical final diff still requires arbiter selection and Codex verification.');
  return lines.join('\n') + '\n';
}

function renderCandidateVerification(verification) {
  const lines = [];
  lines.push(`# Parallel Candidate Verification: ${verification.id}`);
  lines.push('');
  lines.push(`- Verifier: ${verification.verifier}`);
  lines.push(`- Verdict: ${verification.verdict}`);
  lines.push(`- Selectable: ${verification.selectable ? 'yes' : 'no'}`);
  lines.push(`- Reason: ${verification.reason}`);
  if (verification.issues.length) {
    lines.push('');
    lines.push('## Issues');
    for (const issue of verification.issues) {
      lines.push(`- [${issue.severity}/${issue.category}] ${issue.summary}`);
    }
  }
  lines.push('');
  lines.push('Candidate verification is not final ship verification. The selected candidate still requires final Codex verification before ship/apply.');
  return lines.join('\n') + '\n';
}

function renderCanonicalVerification(summary) {
  const lines = [];
  lines.push('# Canonical Candidate Final Verification');
  lines.push('');
  lines.push(`- Selected candidate: ${summary.selected_candidate || 'none'}`);
  lines.push(`- Verdict: ${summary.verdict}`);
  lines.push(`- Promoted: ${summary.promoted ? 'yes' : 'no'}`);
  lines.push(`- Diff: ${summary.diff_path || 'none'}`);
  if (summary.issues.length) {
    lines.push('');
    lines.push('## Issues');
    for (const issue of summary.issues) {
      lines.push(`- [${issue.severity}/${issue.category}] ${issue.summary}`);
    }
  }
  lines.push('');
  lines.push('Final verification promotes the selected candidate into the canonical handoff path only when it is clean. Apply remains explicit.');
  return lines.join('\n') + '\n';
}

function refreshCandidateArtifacts(candidateDir, candidates) {
  for (const candidate of candidates) {
    const jsonPath = path.join(candidateDir, `${candidate.id}.json`);
    const prior = readJson(jsonPath) || {};
    fs.writeFileSync(jsonPath, JSON.stringify({
      ...prior,
      ...candidate,
      handoff: prior.handoff,
    }, null, 2));
    fs.writeFileSync(path.join(candidateDir, `${candidate.id}.md`), renderCandidate(candidate));
  }
}

function readJson(file) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {}
  return null;
}

function isSelectable(handoff) {
  return (handoff.verdict || 'approve') === 'approve' && !(handoff.issues || []).some(issue => ['critical', 'high'].includes(issue.severity));
}

function verificationReason(handoff) {
  if ((handoff.verdict || 'approve') === 'approve') return 'candidate verification approved with no blocking issues';
  if (handoff.verdict === 'approve_with_fixes') return 'candidate requires fixes before it can become canonical';
  if (handoff.verdict === 'block') return 'candidate was blocked by verification';
  return 'candidate verification returned an unknown verdict';
}

function candidateScore(verification, candidate = {}) {
  const verdictScore = verification.verdict === 'approve' ? 100 : verification.verdict === 'approve_with_fixes' ? 40 : 0;
  const issuePenalty = (verification.issues || []).reduce((sum, issue) => {
    if (issue.severity === 'critical') return sum + 100;
    if (issue.severity === 'high') return sum + 40;
    if (issue.severity === 'medium') return sum + 10;
    return sum + 2;
  }, 0);
  const filePenalty = (candidate.files || []).length;
  return verdictScore - issuePenalty - filePenalty;
}

function copyCanonicalDiff(sessionDir, candidate = {}) {
  if (!candidate?.diff_path || !fs.existsSync(candidate.diff_path)) return null;
  const dir = path.join(sessionDir, 'diffs');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, 'canonical-final.diff');
  fs.copyFileSync(candidate.diff_path, target);
  return target;
}

function canonicalImplementHandoff({ candidate = {}, canonical = {}, sessionId }) {
  const prior = readJson(candidate.artifact_path)?.handoff || {};
  return {
    stage: 'implement',
    agent: prior.agent || candidate.agent || 'executor',
    round: 1,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: Number(prior.duration_ms || 0),
    provider: prior.provider || candidate.provider || 'mock',
    model: prior.model || candidate.model || 'sonnet',
    decided: `promote selected parallel candidate ${candidate.id} as canonical final diff`,
    risks: appendText(prior.risks || candidate.risks, 'parallel candidate selected by arbiter; final Codex verification passed'),
    files: candidate.files || [],
    remaining: 'ship readiness and explicit apply boundary remain',
    diffPath: canonical.canonical_diff_path || null,
  };
}

function canonicalReviewHandoff({ finalVerification, sessionId }) {
  const h = finalVerification?.handoff || {};
  return {
    stage: 'codex-review',
    agent: h.agent || 'codex-reviewer',
    round: 1,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: Number(h.duration_ms || 0),
    provider: h.provider || 'mock',
    model: h.model || 'gpt-5-codex',
    decided: h.decided || 'final canonical candidate verification completed',
    rejected: h.rejected,
    risks: h.risks,
    files: h.files || finalVerification?.summary?.files || [],
    remaining: h.remaining || 'ship readiness may proceed; apply remains explicit',
    issues: h.issues || [],
    verdict: h.verdict || finalVerification?.summary?.verdict || 'approve',
    confidence: h.confidence,
  };
}

function writeHandoff(handoffDir, base, handoff) {
  const clean = stripUndefined(handoff);
  fs.writeFileSync(path.join(handoffDir, `${base}.json`), JSON.stringify(clean, null, 2));
  fs.writeFileSync(path.join(handoffDir, `${base}.md`), renderHandoff(clean));
}

function renderHandoff(handoff) {
  const lines = [];
  lines.push(`# Handoff: ${handoff.stage}  (round ${handoff.round || 1}, agent: ${handoff.agent}, ${handoff.provider}/${handoff.model})`);
  lines.push('');
  lines.push(`**Decided**: ${handoff.decided || ''}`);
  if (handoff.rejected) lines.push(`**Rejected**: ${handoff.rejected}`);
  if (handoff.risks) lines.push(`**Risks**: ${handoff.risks}`);
  lines.push(`**Files**: ${(handoff.files || []).join(', ')}`);
  if (handoff.remaining) lines.push(`**Remaining**: ${handoff.remaining}`);
  if (handoff.diffPath) lines.push(`**Diff**: ${handoff.diffPath}`);
  if (handoff.verdict) lines.push(`**Verdict**: ${handoff.verdict}${handoff.confidence != null ? ` (confidence ${handoff.confidence})` : ''}`);
  lines.push('');
  lines.push('<sub>parallel candidate promotion: canonical final diff evidence; apply remains explicit</sub>');
  return lines.join('\n') + '\n';
}

function readTextIfExists(file) {
  try {
    if (file && fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  } catch {}
  return '';
}

function appendText(a = '', b = '') {
  return [a, b].filter(Boolean).join(a && b ? ' ' : '');
}

function stripUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== null));
}

function parallelSafetyInvariants() {
  return [
    'Candidate workers must never write concurrently to one target worktree.',
    'Each candidate is isolated as an evidence artifact, not a ship-ready diff.',
    'Only one canonical final diff may become the ship candidate.',
    'Final Codex verification remains required before ship/apply.',
    'Human Gate and explicit apply remain non-bypassable.',
  ];
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

export {
  MAX_PARALLEL_CANDIDATES,
  parallelSafetyInvariants,
};
