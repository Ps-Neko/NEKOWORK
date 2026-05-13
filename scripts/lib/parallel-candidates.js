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
      reason: 'alpha.10 preview records candidates as evidence; the main auto build remains the canonical ship path',
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

  const summary = {
    sessionId: opts.sessionId,
    task: opts.task,
    status: 'captured',
    count,
    max_count: MAX_PARALLEL_CANDIDATES,
    live: Boolean(opts.live),
    candidates,
    arbiter: {
      status: 'not_selected',
      selected_candidate: null,
      reason: 'candidate patches are evidence only in alpha.10 preview; the main auto build remains canonical',
    },
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

async function dispatcherCall(opts) {
  return opts.dispatcher({
    agent: 'executor',
    stage: 'implement',
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
