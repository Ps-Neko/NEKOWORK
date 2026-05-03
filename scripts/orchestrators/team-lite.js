import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { dispatch } from '../agents/dispatch.js';

const TEAM_LITE_STAGES = [
  { id: 'team-plan', agent: 'planner', stage: 'plan', owner: 'planner' },
  { id: 'team-prd', agent: 'architect', stage: 'plan', owner: 'architect' },
  { id: 'team-exec', agent: 'executor', stage: 'implement', owner: 'executor' },
  { id: 'team-verify', agent: 'code-reviewer', stage: 'self-review', owner: 'verifier' },
  { id: 'team-fix', agent: 'executor', stage: 'implement', owner: 'executor', conditional: true },
];

const TERMINAL_STATUSES = new Set(['done', 'skipped', 'failed']);

export async function teamLiteCycle(opts) {
  const harnessRoot = opts.harnessRoot || process.cwd();
  const projectRoot = opts.projectRoot || harnessRoot;
  const sessionId = opts.sessionId || `team-lite-${Date.now()}`;
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');
  const heartbeatDir = path.join(sessionDir, 'heartbeats');
  fs.mkdirSync(handoffDir, { recursive: true });
  fs.mkdirSync(heartbeatDir, { recursive: true });

  const live = !!opts.live;
  const handoffs = [];
  const dispatcher = opts.dispatcher || dispatch;
  const tasks = createTasks();
  assertTaskGraph(tasks);

  writeTeamState(sessionDir, sessionId, opts.task, tasks, handoffs);
  writeMonitorSnapshot(sessionDir, sessionId, tasks, handoffs);

  for (const spec of TEAM_LITE_STAGES) {
    const task = tasks.find(t => t.id === spec.id);
    if (spec.conditional && teamVerifyVerdict(handoffs) === 'approve') {
      task.status = 'skipped';
      task.reason = 'team-verify approved';
      task.completed_at = new Date().toISOString();
      writeTeamState(sessionDir, sessionId, opts.task, tasks, handoffs);
      writeHeartbeat(sessionDir, sessionId, spec.id, 'skipped');
      writeMonitorSnapshot(sessionDir, sessionId, tasks, handoffs);
      continue;
    }

    task.status = 'running';
    task.started_at = new Date().toISOString();
    writeHeartbeat(sessionDir, sessionId, spec.id, 'running');
    writeTeamState(sessionDir, sessionId, opts.task, tasks, handoffs);
    writeMonitorSnapshot(sessionDir, sessionId, tasks, handoffs);

    let handoff;
    try {
      handoff = await runStage({
        harnessRoot,
        projectRoot,
        live,
        sessionDir,
        sessionId,
        spec,
        task: opts.task,
        priorHandoffs: handoffs.slice(-3),
        dispatcher,
      });

      handoff.team_stage = spec.id;
      removeUndefined(handoff);
      assertValidHandoff(harnessRoot, handoff);
      handoffs.push(handoff);
      writeHandoff(handoffDir, handoff, handoffs.length);
    } catch (e) {
      task.status = 'failed';
      task.completed_at = new Date().toISOString();
      task.error = e.message || String(e);
      writeHeartbeat(sessionDir, sessionId, spec.id, 'failed');
      writeTeamState(sessionDir, sessionId, opts.task, tasks, handoffs);
      writeMonitorSnapshot(sessionDir, sessionId, tasks, handoffs);
      throw new Error(`${spec.id} failed: ${task.error}`);
    }

    task.status = 'done';
    task.completed_at = new Date().toISOString();
    task.verdict = handoff.verdict || null;
    task.handoff = path.relative(sessionDir, handoffJsonPath(handoffDir, handoff, handoffs.length)).replace(/\\/g, '/');
    writeHeartbeat(sessionDir, sessionId, spec.id, 'done');
    writeTeamState(sessionDir, sessionId, opts.task, tasks, handoffs);
    writeMonitorSnapshot(sessionDir, sessionId, tasks, handoffs);
  }

  writeMonitorSnapshot(sessionDir, sessionId, tasks, handoffs);
  return {
    sessionId,
    sessionDir,
    tasks,
    handoffs,
    verdict: lastVerdict(handoffs) || 'unknown',
  };
}

async function runStage({ harnessRoot, projectRoot, live, sessionDir, sessionId, spec, task, priorHandoffs, dispatcher }) {
  return dispatcher({
    agent: spec.agent,
    stage: spec.stage,
    task,
    live,
    harnessRoot,
    projectRoot,
    sessionDir,
    sessionId,
    context: { priorHandoffs },
  });
}

function createTasks() {
  return TEAM_LITE_STAGES.map(s => ({
    id: s.id,
    owner: s.owner,
    agent: s.agent,
    stage: s.stage,
    status: 'pending',
    depends_on: previousStageId(s.id),
    conditional: Boolean(s.conditional),
  }));
}

function assertTaskGraph(tasks) {
  const ids = new Set(tasks.map(t => t.id));
  for (const task of tasks) {
    if (!task.owner || !task.agent || !task.stage) {
      throw new Error(`team-lite task contract incomplete: ${task.id}`);
    }
    if (!['pending', 'running', 'done', 'skipped', 'failed'].includes(task.status)) {
      throw new Error(`team-lite task has invalid status: ${task.id}=${task.status}`);
    }
    for (const dep of task.depends_on || []) {
      if (!ids.has(dep)) throw new Error(`team-lite task ${task.id} depends on unknown task ${dep}`);
    }
  }
}

function previousStageId(id) {
  const idx = TEAM_LITE_STAGES.findIndex(s => s.id === id);
  return idx > 0 ? [TEAM_LITE_STAGES[idx - 1].id] : [];
}

function lastVerdict(handoffs) {
  return [...handoffs].reverse().find(h => h.verdict)?.verdict || null;
}

function teamVerifyVerdict(handoffs) {
  return handoffs.find(h => h.team_stage === 'team-verify')?.verdict || null;
}

function writeTeamState(sessionDir, sessionId, task, tasks, handoffs) {
  const state = {
    sessionId,
    task,
    updated_at: new Date().toISOString(),
    pipeline: TEAM_LITE_STAGES.map(s => s.id),
    terminal_statuses: [...TERMINAL_STATUSES],
    tasks,
    handoffs: handoffs.map(h => ({
      team_stage: h.team_stage,
      agent: h.agent,
      stage: h.stage,
      verdict: h.verdict || null,
      files: h.files || [],
    })),
  };
  fs.writeFileSync(path.join(sessionDir, 'team-lite.json'), JSON.stringify(state, null, 2));
}

function writeHeartbeat(sessionDir, sessionId, stage, status) {
  const beat = {
    sessionId,
    stage,
    status,
    at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(sessionDir, 'heartbeat.json'), JSON.stringify(beat, null, 2));
  fs.writeFileSync(path.join(sessionDir, 'heartbeats', `${stage}.json`), JSON.stringify(beat, null, 2));
  fs.appendFileSync(path.join(sessionDir, 'heartbeat.jsonl'), JSON.stringify(beat) + '\n');
}

function writeMonitorSnapshot(sessionDir, sessionId, tasks, handoffs) {
  fs.writeFileSync(path.join(sessionDir, 'monitor.json'), JSON.stringify({
    sessionId,
    at: new Date().toISOString(),
    pipeline: TEAM_LITE_STAGES.map(s => s.id),
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    done: tasks.filter(t => t.status === 'done').length,
    skipped: tasks.filter(t => t.status === 'skipped').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    terminal: tasks.filter(t => TERMINAL_STATUSES.has(t.status)).length,
    non_terminal: tasks.filter(t => !TERMINAL_STATUSES.has(t.status)).length,
    last_verdict: lastVerdict(handoffs),
    last_team_stage: handoffs.at(-1)?.team_stage || null,
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
    throw new Error(`team-lite handoff schema validation failed: ${detail}`);
  }
}

export {
  TEAM_LITE_STAGES,
  createTasks as _createTasks,
  assertTaskGraph as _assertTaskGraph,
};
