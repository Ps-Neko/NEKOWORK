import fs from 'node:fs';
import path from 'node:path';
import { dispatch } from '../agents/dispatch.js';
import { ensureAcceptanceCriteria } from '../lib/acceptance-criteria.js';
import { profilePolicy } from '../lib/profile-policy.js';
import { withExecutionWorkspace } from '../core/execution-workspace.js';
import { generateSessionId } from '../lib/session-id.js';

const STAGE_INDEX = { implement: '03' };

export async function workCycle(opts) {
  const harnessRoot = opts.harnessRoot || process.cwd();
  const projectRoot = opts.projectRoot || harnessRoot;
  const sessionId = opts.sessionId || generateSessionId('work');
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');
  fs.mkdirSync(handoffDir, { recursive: true });

  const dispatcher = opts.dispatcher || dispatch;
  const live = !!opts.live;
  const priorHandoffs = readPriorHandoffs(handoffDir);
  const prd = readJsonIfExists(path.join(sessionDir, 'prd.json'));
  const acceptance = ensureAcceptanceCriteria({ sessionDir, task: opts.task });
  const policy = profilePolicy(opts.profile || readSessionProfile(sessionDir));
  const round = nextRound(priorHandoffs, 'implement');

  const context = {
    profile: policy.profile,
    qualityChecklist: policy.checklist,
    prd,
    acceptanceCriteria: acceptance.criteria,
    priorHandoffs: priorHandoffs.slice(-6),
    acCount: acceptance.criteria.length,
    round,
    singleExecutor: true,
  };

  const execution = live
    ? await runLiveExecutor({ harnessRoot, projectRoot, sessionDir, sessionId, task: opts.task, context, dispatcher, round })
    : await runMockExecutor({ harnessRoot, projectRoot, sessionDir, sessionId, task: opts.task, context, dispatcher });

  const handoff = execution.handoff;
  if (policy.profile) handoff.profile = policy.profile;
  handoff.round = round;
  handoff.session_id = sessionId;
  handoff.files = dedupe([...(handoff.files || []), ...(execution.files || [])]);
  if (execution.diffPath) handoff.diffPath = execution.diffPath;
  if (execution.executionWorkspace) handoff.executionWorkspace = execution.executionWorkspace;

  writeHandoff(handoffDir, handoff);
  writeSummary(sessionDir, {
    sessionId,
    task: opts.task,
    live,
    round,
    handoff,
    diffPath: execution.diffPath || null,
    files: handoff.files || [],
    acceptance,
    profile: policy.profile,
    qualityChecklist: policy.checklist,
  });

  return {
    sessionId,
    sessionDir,
    handoff,
    handoffs: [...priorHandoffs, handoff],
    files: handoff.files || [],
    diffPath: execution.diffPath || null,
    live,
    round,
  };
}

async function runMockExecutor({ harnessRoot, projectRoot, sessionDir, sessionId, task, context, dispatcher }) {
  const handoff = await dispatcher({
    agent: 'executor',
    stage: 'implement',
    task,
    live: false,
    harnessRoot,
    projectRoot,
    sessionDir,
    sessionId,
    context,
  });
  return { handoff, files: [], diffPath: null, executionWorkspace: null };
}

async function runLiveExecutor({ harnessRoot, projectRoot, sessionDir, sessionId, task, context, dispatcher, round }) {
  const execution = await withExecutionWorkspace(
    projectRoot,
    sessionDir,
    async (workspaceRoot) => dispatcher({
      agent: 'executor',
      stage: 'implement',
      task,
      live: true,
      harnessRoot,
      projectRoot: workspaceRoot,
      sessionDir,
      sessionId,
      context,
      executionMode: 'workspace-write',
    }),
    { sessionId, stage: 'implement', round },
  );

  return {
    handoff: execution.result,
    files: execution.files,
    diffPath: execution.diffPath,
    executionWorkspace: execution.worktreeRoot,
  };
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

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function readSessionProfile(sessionDir) {
  return readJsonIfExists(path.join(sessionDir, 'ask.json'))?.profile || null;
}

function nextRound(handoffs, stage) {
  const rounds = handoffs
    .filter(h => h.stage === stage)
    .map(h => Number(h.round || 1))
    .filter(Number.isFinite);
  return rounds.length ? Math.max(...rounds) + 1 : 1;
}

function writeSummary(sessionDir, summary) {
  fs.writeFileSync(path.join(sessionDir, 'work-summary.json'), JSON.stringify({
    sessionId: summary.sessionId,
    task: summary.task,
    stage: 'implement',
    agent: 'executor',
    mutation: summary.live ? 'isolated-workspace-diff' : 'mock-handoff-only',
    target_project_mutated: false,
    codex_review_run: false,
    ship_run: false,
    round: summary.round,
    files: summary.files,
    profile: summary.profile || null,
    quality_checklist: summary.qualityChecklist || [],
    diffPath: summary.diffPath,
    acceptance_required: true,
    acceptance_count: summary.acceptance?.criteria?.length || 0,
    acceptance_source: summary.acceptance?.source || null,
    acceptance_generated: Boolean(summary.acceptance?.generated),
    next_step: 'run Codex verification before applying or shipping this work',
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
  if (h.diffPath) lines.push(`**Diff**: ${h.diffPath}`);
  lines.push('');
  lines.push('<sub>work mode: single executor; Codex review not run; ship not run</sub>');
  return lines.join('\n') + '\n';
}

function dedupe(arr) {
  return [...new Set(arr.filter(Boolean))];
}

export {
  readPriorHandoffs as _readPriorHandoffs,
  nextRound as _nextRound,
};
