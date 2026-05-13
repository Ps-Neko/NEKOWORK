import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { dispatch } from '../agents/dispatch.js';
import { loadUpstreamArtifact, hasAnyUpstream } from '../lib/upstream-artifacts.js';

const DEFAULT_WORKERS = ['planner', 'research', 'product', 'security', 'test'];

const WORKER_SPECS = {
  planner: {
    agent: 'planner',
    stage: 'plan',
    owner: 'planning',
    purpose: 'implementation shape, acceptance criteria, and scope boundaries',
  },
  research: {
    agent: 'research',
    stage: 'ideate',
    owner: 'research',
    purpose: 'external patterns, prior art, and uncertainty reduction',
  },
  product: {
    agent: 'architect',
    stage: 'plan',
    owner: 'product',
    purpose: 'product tradeoffs, scope pressure, and user-facing acceptance',
  },
  design: {
    agent: 'architect',
    stage: 'plan',
    owner: 'design',
    purpose: 'interaction structure, UI states, and design constraints',
  },
  security: {
    agent: 'security-reviewer',
    stage: 'self-review',
    owner: 'security',
    purpose: 'security-sensitive assumptions, gate triggers, and abuse cases',
  },
  test: {
    agent: 'test-engineer',
    stage: 'plan',
    owner: 'testing',
    purpose: 'test plan, regression risks, and evidence required before work',
  },
  codex: {
    agent: 'codex-reviewer',
    stage: 'codex-review',
    owner: 'codex',
    purpose: 'independent review angle before any mutation phase',
  },
};

export function parseWorkers(value) {
  const raw = value ? String(value).split(',') : DEFAULT_WORKERS;
  const workers = raw.map(w => w.trim()).filter(Boolean);
  const unknown = workers.filter(w => !WORKER_SPECS[w]);
  if (unknown.length) {
    throw new Error(`unknown team worker: ${unknown.join(', ')}. available: ${Object.keys(WORKER_SPECS).join(', ')}`);
  }
  return [...new Set(workers)];
}

export async function teamCycle(opts) {
  const harnessRoot = opts.harnessRoot || process.cwd();
  const projectRoot = opts.projectRoot || harnessRoot;
  const sessionId = opts.sessionId || `team-${Date.now()}`;
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');
  fs.mkdirSync(handoffDir, { recursive: true });

  const workers = parseWorkers(opts.workers);
  const dispatcher = opts.dispatcher || dispatch;
  const live = !!opts.live;
  const upstream = {
    context: loadUpstreamArtifact('context', projectRoot, opts.contextFile),
    domain: loadUpstreamArtifact('domain', projectRoot, opts.domainFile),
    spec: loadUpstreamArtifact('spec', projectRoot, opts.specFile),
    plan: loadUpstreamArtifact('plan', projectRoot, opts.planFile),
  };
  const handoffs = [];
  const tasks = workers.map((worker, index) => createTask(worker, index));

  writeTeamState(sessionDir, sessionId, opts.task, tasks, handoffs);

  for (const task of tasks) {
    task.status = 'running';
    task.started_at = new Date().toISOString();
    writeTeamState(sessionDir, sessionId, opts.task, tasks, handoffs);

    try {
      const handoff = await dispatcher({
        agent: task.agent,
        stage: task.stage,
        task: opts.task,
        live,
        harnessRoot,
        projectRoot,
        sessionDir,
        sessionId,
        context: {
          priorHandoffs: handoffs.slice(-3),
          teamPurpose: task.purpose,
          readOnly: true,
          upstream,
        },
        executionMode: 'read-only',
        sandboxOverride: 'read-only',
      });

      handoff.team_stage = `team-${task.worker}`;
      if (hasAnyUpstream(upstream)) handoff.upstream_artifacts = upstream;
      removeUndefined(handoff);
      assertValidHandoff(harnessRoot, handoff);
      handoffs.push(handoff);
      writeHandoff(handoffDir, handoff, handoffs.length);

      task.status = 'done';
      task.completed_at = new Date().toISOString();
      task.handoff = path.relative(sessionDir, handoffJsonPath(handoffDir, handoff, handoffs.length)).replace(/\\/g, '/');
      task.verdict = handoff.verdict || null;
    } catch (e) {
      task.status = 'failed';
      task.completed_at = new Date().toISOString();
      task.error = e.message || String(e);
      writeTeamState(sessionDir, sessionId, opts.task, tasks, handoffs);
      throw new Error(`team worker ${task.worker} failed: ${task.error}`);
    }

    writeTeamState(sessionDir, sessionId, opts.task, tasks, handoffs);
  }

  const result = {
    sessionId,
    sessionDir,
    workers,
    tasks,
    handoffs,
    recommendedNextStep: recommendedNextStep(tasks, handoffs),
  };
  writeSummary(sessionDir, result, opts.task);
  return result;
}

function createTask(worker, index) {
  const spec = WORKER_SPECS[worker];
  return {
    id: `team-${worker}`,
    worker,
    owner: spec.owner,
    agent: spec.agent,
    stage: spec.stage,
    purpose: spec.purpose,
    status: 'pending',
    order: index + 1,
    mutation: 'read-only',
  };
}

function recommendedNextStep(tasks, handoffs) {
  if (tasks.some(t => t.status === 'failed')) return 'fix-team-failure';
  if (handoffs.some(h => h.verdict === 'block')) return 'human-gate-or-replan';
  if (handoffs.some(h => h.verdict === 'approve_with_fixes')) return 'plan-or-work-after-fixes';
  return 'plan-or-work-with-single-executor';
}

function writeTeamState(sessionDir, sessionId, task, tasks, handoffs) {
  fs.writeFileSync(path.join(sessionDir, 'team.json'), JSON.stringify({
    sessionId,
    task,
    mode: 'read-only',
    updated_at: new Date().toISOString(),
    invariants: [
      'Multi-worker phases are read-only by default.',
      'Only one executor may mutate project files in a later work cycle.',
      'Codex verification and human gate policy still apply after team handoffs.',
    ],
    tasks,
    handoffs: handoffs.map(h => ({
      team_stage: h.team_stage,
      agent: h.agent,
      stage: h.stage,
      verdict: h.verdict || null,
      files: h.files || [],
    })),
  }, null, 2));
}

function writeSummary(sessionDir, result, task) {
  fs.writeFileSync(path.join(sessionDir, 'team-summary.json'), JSON.stringify({
    sessionId: result.sessionId,
    task,
    mode: 'read-only',
    workers: result.workers,
    task_statuses: result.tasks.map(t => ({ worker: t.worker, status: t.status })),
    handoff_count: result.handoffs.length,
    recommended_next_step: result.recommendedNextStep,
  }, null, 2));
}

function writeHandoff(handoffDir, h, index) {
  const base = handoffBase(h, index);
  fs.writeFileSync(handoffJsonPath(handoffDir, h, index), JSON.stringify(h, null, 2));
  fs.writeFileSync(path.join(handoffDir, `${base}.md`), renderFiveFieldHandoff(h));
}

function handoffJsonPath(handoffDir, h, index) {
  return path.join(handoffDir, `${handoffBase(h, index)}.json`);
}

function handoffBase(h, index) {
  return `${String(index).padStart(2, '0')}-${h.team_stage}`;
}

function renderFiveFieldHandoff(h) {
  return [
    `# Handoff: ${h.team_stage}`,
    '',
    `Decided: ${h.decided || ''}`,
    `Rejected: ${h.rejected || ''}`,
    `Risks: ${h.risks || ''}`,
    `Files: ${(h.files || []).join(', ')}`,
    `Remaining: ${h.remaining || ''}`,
    h.verdict ? `Verdict: ${h.verdict}` : '',
    '',
  ].filter(Boolean).join('\n');
}

function removeUndefined(obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) delete obj[k];
  }
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
    throw new Error(`team handoff schema validation failed: ${detail}`);
  }
}

export {
  WORKER_SPECS,
  DEFAULT_WORKERS,
};
