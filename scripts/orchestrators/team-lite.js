import fs from 'node:fs';
import path from 'node:path';
import { dispatch } from '../agents/dispatch.js';

const STAGES = [
  { id: 'team-plan', agent: 'planner', stage: 'plan', owner: 'planner' },
  { id: 'team-prd', agent: 'architect', stage: 'plan', owner: 'architect' },
  { id: 'team-exec', agent: 'executor', stage: 'implement', owner: 'executor' },
  { id: 'team-verify', agent: 'code-reviewer', stage: 'self-review', owner: 'verifier' },
  { id: 'team-fix', agent: 'executor', stage: 'implement', owner: 'executor', conditional: true },
];

export async function teamLiteCycle(opts) {
  const root = opts.harnessRoot || process.cwd();
  const sessionId = opts.sessionId || `team-lite-${Date.now()}`;
  const sessionDir = path.join(root, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');
  fs.mkdirSync(handoffDir, { recursive: true });

  const live = !!opts.live;
  const handoffs = [];
  const tasks = STAGES.map(s => ({
    id: s.id,
    owner: s.owner,
    agent: s.agent,
    stage: s.stage,
    status: 'pending',
    depends_on: previousStageId(s.id),
  }));

  writeTeamState(sessionDir, sessionId, opts.task, tasks, handoffs);

  for (const spec of STAGES) {
    const task = tasks.find(t => t.id === spec.id);
    if (spec.conditional && lastVerdict(handoffs) === 'approve') {
      task.status = 'skipped';
      task.reason = 'team-verify approved';
      writeTeamState(sessionDir, sessionId, opts.task, tasks, handoffs);
      continue;
    }

    task.status = 'running';
    task.started_at = new Date().toISOString();
    writeHeartbeat(sessionDir, sessionId, spec.id, 'running');
    writeTeamState(sessionDir, sessionId, opts.task, tasks, handoffs);

    const handoff = await runStage({
      root,
      live,
      sessionDir,
      sessionId,
      spec,
      task: opts.task,
      priorHandoffs: handoffs.slice(-3),
    });
    handoff.teamStage = spec.id;
    handoffs.push(handoff);
    writeHandoff(handoffDir, handoff, handoffs.length);

    task.status = 'done';
    task.completed_at = new Date().toISOString();
    task.verdict = handoff.verdict || null;
    writeHeartbeat(sessionDir, sessionId, spec.id, 'done');
    writeTeamState(sessionDir, sessionId, opts.task, tasks, handoffs);
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

async function runStage({ root, live, sessionDir, sessionId, spec, task, priorHandoffs }) {
  return dispatch({
    agent: spec.agent,
    stage: spec.stage,
    task,
    live,
    harnessRoot: root,
    sessionDir,
    sessionId,
    context: { priorHandoffs },
  });
}

function previousStageId(id) {
  const idx = STAGES.findIndex(s => s.id === id);
  return idx > 0 ? [STAGES[idx - 1].id] : [];
}

function lastVerdict(handoffs) {
  return [...handoffs].reverse().find(h => h.verdict)?.verdict || null;
}

function writeTeamState(sessionDir, sessionId, task, tasks, handoffs) {
  const state = {
    sessionId,
    task,
    updated_at: new Date().toISOString(),
    tasks,
    handoffs: handoffs.map(h => ({
      teamStage: h.teamStage,
      agent: h.agent,
      verdict: h.verdict || null,
      files: h.files || [],
    })),
  };
  fs.writeFileSync(path.join(sessionDir, 'team-lite.json'), JSON.stringify(state, null, 2));
}

function writeHeartbeat(sessionDir, sessionId, stage, status) {
  fs.writeFileSync(path.join(sessionDir, 'heartbeat.json'), JSON.stringify({
    sessionId,
    stage,
    status,
    at: new Date().toISOString(),
  }, null, 2));
}

function writeMonitorSnapshot(sessionDir, sessionId, tasks, handoffs) {
  fs.writeFileSync(path.join(sessionDir, 'monitor.json'), JSON.stringify({
    sessionId,
    at: new Date().toISOString(),
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    done: tasks.filter(t => t.status === 'done').length,
    skipped: tasks.filter(t => t.status === 'skipped').length,
    last_verdict: lastVerdict(handoffs),
  }, null, 2));
}

function writeHandoff(handoffDir, h, index) {
  const base = `${String(index).padStart(2, '0')}-${h.teamStage}`;
  fs.writeFileSync(path.join(handoffDir, `${base}.json`), JSON.stringify(h, null, 2));
  fs.writeFileSync(path.join(handoffDir, `${base}.md`), renderFiveFieldHandoff(h));
}

function renderFiveFieldHandoff(h) {
  return [
    `# Handoff: ${h.teamStage}`,
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
