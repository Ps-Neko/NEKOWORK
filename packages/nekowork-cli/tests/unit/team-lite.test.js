import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { teamLiteCycle, _createTasks, _assertTaskGraph } from '../../scripts/orchestrators/team-lite.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const handoffSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'handoff.schema.json'), 'utf8'));
const validateHandoff = ajv.compile(handoffSchema);

function cleanSession(sessionId) {
  fs.rmSync(path.join(ROOT, '.harness', 'state', 'sessions', sessionId), { recursive: true, force: true });
}

test('team-lite writes staged task, heartbeat, monitor, and handoffs', async () => {
  cleanSession('unit-team-lite');
  const r = await teamLiteCycle({
    task: '문서 정리',
    sessionId: 'unit-team-lite',
    harnessRoot: ROOT,
  });

  assert.equal(r.sessionId, 'unit-team-lite');
  assert.ok(r.tasks.find(t => t.id === 'team-plan'));
  assert.ok(r.tasks.find(t => t.id === 'team-verify'));
  assert.deepEqual(r.tasks.map(t => t.id), ['team-plan', 'team-prd', 'team-exec', 'team-verify', 'team-fix']);
  assert.deepEqual(r.tasks.find(t => t.id === 'team-exec').depends_on, ['team-prd']);
  assert.ok(fs.existsSync(path.join(r.sessionDir, 'team-lite.json')));
  assert.ok(fs.existsSync(path.join(r.sessionDir, 'heartbeat.json')));
  assert.ok(fs.existsSync(path.join(r.sessionDir, 'heartbeat.jsonl')));
  assert.ok(fs.existsSync(path.join(r.sessionDir, 'heartbeats', 'team-plan.json')));
  assert.ok(fs.existsSync(path.join(r.sessionDir, 'monitor.json')));

  const handoffDir = path.join(r.sessionDir, 'handoffs');
  const files = fs.readdirSync(handoffDir);
  assert.ok(files.some(f => f.includes('team-plan') && f.endsWith('.md')));
  assert.ok(files.some(f => f.includes('team-verify') && f.endsWith('.json')));

  const teamState = JSON.parse(fs.readFileSync(path.join(r.sessionDir, 'team-lite.json'), 'utf8'));
  assert.equal(teamState.mode, 'advanced-team-lite-handoff');
  assert.equal(teamState.mutation, 'read-only-handoffs');
  assert.equal(teamState.target_project_mutated, false);
  assert.deepEqual(teamState.pipeline, ['team-plan', 'team-prd', 'team-exec', 'team-verify', 'team-fix']);
  assert.ok(teamState.terminal_statuses.includes('done'));
  assert.ok(teamState.handoffs.every(h => h.team_stage));

  const monitor = JSON.parse(fs.readFileSync(path.join(r.sessionDir, 'monitor.json'), 'utf8'));
  assert.equal(monitor.running, 0);
  assert.equal(monitor.non_terminal, 0);
  assert.equal(monitor.terminal, r.tasks.length);

  const handoffJsons = files.filter(f => f.endsWith('.json'));
  for (const f of handoffJsons) {
    const handoff = JSON.parse(fs.readFileSync(path.join(handoffDir, f), 'utf8'));
    assert.equal(validateHandoff(handoff), true, JSON.stringify(validateHandoff.errors));
    assert.match(handoff.team_stage, /^team-/);
  }
});

test('team-lite task graph contract is explicit and validates dependencies', () => {
  const tasks = _createTasks();
  assert.doesNotThrow(() => _assertTaskGraph(tasks));
  assert.deepEqual(tasks.find(t => t.id === 'team-fix').depends_on, ['team-verify']);

  const broken = tasks.map(t => ({ ...t }));
  broken[1].depends_on = ['missing-task'];
  assert.throws(() => _assertTaskGraph(broken), /depends on unknown task/);
});

test('team-lite projectRoot 지정 시 state 는 대상 프로젝트에 쓰고 schema 는 harnessRoot 에서 읽는다', async () => {
  const sessionId = 'unit-team-lite-project-root';
  cleanSession(sessionId);
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-team-project-root-'));
  const calls = [];
  const dispatcher = async (args) => {
    calls.push(args);
    assert.equal(args.sandboxOverride, 'read-only');
    assert.equal(args.context.readOnlyHandoff, true);
    assert.equal(args.context.noProjectMutation, true);
    return {
      stage: args.stage,
      agent: args.agent,
      decided: `${args.agent} ${args.stage} ok`,
      rejected: '',
      risks: '',
      files: [],
      remaining: '',
      verdict: args.stage === 'self-review' ? 'approve' : undefined,
    };
  };

  try {
    const r = await teamLiteCycle({
      task: 'portable team-lite smoke',
      sessionId,
      harnessRoot: ROOT,
      projectRoot,
      dispatcher,
    });

    assert.equal(path.resolve(r.sessionDir), path.join(projectRoot, '.harness', 'state', 'sessions', sessionId));
    assert.equal(r.targetProjectMutated, false);
    assert.ok(calls.length > 0);
    assert.ok(fs.existsSync(path.join(r.sessionDir, 'team-lite.json')));
    assert.ok(fs.existsSync(path.join(r.sessionDir, 'handoffs', '01-team-plan.json')));
    assert.equal(fs.existsSync(path.join(ROOT, '.harness', 'state', 'sessions', sessionId)), false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('team-lite skips team-fix when team-verify approves', async () => {
  cleanSession('unit-team-lite-skip');
  const dispatcher = async ({ agent, stage }) => ({
    stage,
    agent,
    decided: `${agent} ${stage} ok`,
    rejected: '',
    risks: '',
    files: [],
    remaining: '',
    verdict: stage === 'self-review' ? 'approve' : undefined,
  });

  const r = await teamLiteCycle({
    task: 'skip fix smoke',
    sessionId: 'unit-team-lite-skip',
    harnessRoot: ROOT,
    dispatcher,
  });

  const fix = r.tasks.find(t => t.id === 'team-fix');
  assert.equal(fix.status, 'skipped');
  assert.equal(fix.reason, 'team-verify approved');
  assert.equal(fs.existsSync(path.join(r.sessionDir, 'handoffs', '05-team-fix.json')), false);
  const monitor = JSON.parse(fs.readFileSync(path.join(r.sessionDir, 'monitor.json'), 'utf8'));
  assert.equal(monitor.skipped, 1);
  assert.equal(monitor.failed, 0);
});

test('team-lite marks failed task and monitor snapshot when a worker throws', async () => {
  cleanSession('unit-team-lite-fail');
  const dispatcher = async ({ agent, stage }) => {
    if (stage === 'implement') throw new Error('boom');
    return {
      stage,
      agent,
      decided: `${agent} ${stage} ok`,
      rejected: '',
      risks: '',
      files: [],
      remaining: '',
    };
  };

  await assert.rejects(
    () => teamLiteCycle({
      task: 'failure smoke',
      sessionId: 'unit-team-lite-fail',
      harnessRoot: ROOT,
      dispatcher,
    }),
    /team-exec failed: boom/
  );

  const sessionDir = path.join(ROOT, '.harness', 'state', 'sessions', 'unit-team-lite-fail');
  const state = JSON.parse(fs.readFileSync(path.join(sessionDir, 'team-lite.json'), 'utf8'));
  assert.equal(state.tasks.find(t => t.id === 'team-exec').status, 'failed');
  const monitor = JSON.parse(fs.readFileSync(path.join(sessionDir, 'monitor.json'), 'utf8'));
  assert.equal(monitor.failed, 1);
  assert.equal(monitor.running, 0);
  const heartbeat = JSON.parse(fs.readFileSync(path.join(sessionDir, 'heartbeat.json'), 'utf8'));
  assert.equal(heartbeat.status, 'failed');
});

test('team-lite marks failed task when worker returns invalid handoff schema', async () => {
  cleanSession('unit-team-lite-invalid');
  const dispatcher = async ({ agent, stage }) => ({
    stage,
    agent,
    files: [],
  });

  await assert.rejects(
    () => teamLiteCycle({
      task: 'invalid handoff smoke',
      sessionId: 'unit-team-lite-invalid',
      harnessRoot: ROOT,
      dispatcher,
    }),
    /team-plan failed: team-lite handoff schema validation failed/
  );

  const sessionDir = path.join(ROOT, '.harness', 'state', 'sessions', 'unit-team-lite-invalid');
  const state = JSON.parse(fs.readFileSync(path.join(sessionDir, 'team-lite.json'), 'utf8'));
  assert.equal(state.tasks.find(t => t.id === 'team-plan').status, 'failed');
  const monitor = JSON.parse(fs.readFileSync(path.join(sessionDir, 'monitor.json'), 'utf8'));
  assert.equal(monitor.failed, 1);
});
