import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { teamCycle, parseWorkers } from '../../scripts/orchestrators/team.js';
import { rmrf } from '../helpers/tmp.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const handoffSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'handoff.schema.json'), 'utf8'));
const validateHandoff = ajv.compile(handoffSchema);

test('parseWorkers defaults and rejects unknown workers', () => {
  assert.deepEqual(parseWorkers(null), ['planner', 'research', 'product', 'security', 'test']);
  assert.deepEqual(parseWorkers('planner,security,planner'), ['planner', 'security']);
  assert.throws(() => parseWorkers('planner,executor'), /unknown team worker: executor/);
});

test('team auto-picks upstream artifacts and passes them to every worker', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-team-upstream-'));
  const calls = [];
  const dispatcher = async (args) => {
    calls.push(args);
    return {
      stage: args.stage,
      agent: args.agent,
      decided: 'ok',
      rejected: '',
      risks: '',
      files: [],
      remaining: '',
    };
  };
  try {
    fs.writeFileSync(path.join(projectRoot, 'context.md'), 'ctx body');
    fs.writeFileSync(path.join(projectRoot, 'DOMAIN.md'), 'dom body');
    fs.writeFileSync(path.join(projectRoot, 'SPEC.md'), 'spec body');
    fs.writeFileSync(path.join(projectRoot, 'PLAN.md'), 'plan body');

    const r = await teamCycle({
      task: 'plan a thing',
      sessionId: 'unit-team-upstream',
      harnessRoot: ROOT,
      projectRoot,
      workers: 'planner,test',
      dispatcher,
    });

    for (const c of calls) {
      assert.ok(c.context.upstream, 'each worker dispatch must include context.upstream');
      assert.equal(c.context.upstream.plan.path, 'PLAN.md');
      assert.equal(c.context.upstream.domain.path, 'DOMAIN.md');
      assert.equal(c.context.upstream.spec.path, 'SPEC.md');
      assert.equal(c.context.upstream.context.path, 'context.md');
    }
    const handoffDir = path.join(r.sessionDir, 'handoffs');
    for (const f of fs.readdirSync(handoffDir).filter(n => n.endsWith('.json'))) {
      const h = JSON.parse(fs.readFileSync(path.join(handoffDir, f), 'utf8'));
      assert.ok(h.upstream_artifacts, `${f} must include upstream_artifacts`);
      assert.equal(h.upstream_artifacts.plan.path, 'PLAN.md');
      assert.equal(validateHandoff(h), true, JSON.stringify(validateHandoff.errors));
    }
  } finally {
    rmrf(projectRoot);
  }
});

test('team --plan-file overrides PLAN.md auto-pick', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-team-explicit-plan-'));
  const calls = [];
  const dispatcher = async (args) => {
    calls.push(args);
    return { stage: args.stage, agent: args.agent, decided: 'ok', files: [], remaining: '' };
  };
  try {
    fs.writeFileSync(path.join(projectRoot, 'PLAN.md'), 'auto body');
    const custom = path.join(projectRoot, 'team-plan.md');
    fs.writeFileSync(custom, 'explicit body');
    await teamCycle({
      task: 'x',
      sessionId: 'unit-team-explicit-plan',
      harnessRoot: ROOT,
      projectRoot,
      workers: 'planner',
      planFile: custom,
      dispatcher,
    });
    assert.equal(calls[0].context.upstream.plan.path, 'team-plan.md');
    assert.equal(calls[0].context.upstream.plan.source, 'explicit');
  } finally {
    rmrf(projectRoot);
  }
});

test('team writes read-only worker handoffs into target project session', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-team-project-root-'));
  const calls = [];
  const dispatcher = async (args) => {
    calls.push(args);
    assert.equal(args.executionMode, 'read-only');
    assert.equal(args.sandboxOverride, 'read-only');
    return {
      stage: args.stage,
      agent: args.agent,
      decided: `${args.agent} ${args.stage} handoff`,
      rejected: 'project mutation',
      risks: 'read-only analysis only',
      files: [],
      remaining: 'single executor work cycle',
      verdict: args.agent === 'security-reviewer' ? 'approve_with_fixes' : undefined,
    };
  };

  try {
    const r = await teamCycle({
      task: 'trading dashboard mockup',
      sessionId: 'unit-team',
      harnessRoot: ROOT,
      projectRoot,
      workers: 'planner,research,security,test',
      dispatcher,
    });

    assert.equal(path.resolve(r.sessionDir), path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-team'));
    assert.deepEqual(r.workers, ['planner', 'research', 'security', 'test']);
    assert.equal(r.handoffs.length, 4);
    assert.equal(r.recommendedNextStep, 'plan-or-work-after-fixes');
    assert.ok(calls.every(c => c.stage !== 'implement'), 'read-only team must not run implement stage');

    const teamState = JSON.parse(fs.readFileSync(path.join(r.sessionDir, 'team.json'), 'utf8'));
    assert.equal(teamState.mode, 'read-only');
    assert.ok(teamState.invariants.some(x => x.includes('read-only')));
    assert.ok(fs.existsSync(path.join(r.sessionDir, 'team-summary.json')));

    const handoffDir = path.join(r.sessionDir, 'handoffs');
    const files = fs.readdirSync(handoffDir);
    assert.ok(files.includes('01-team-planner.json'));
    assert.ok(files.includes('04-team-test.md'));

    for (const f of files.filter(name => name.endsWith('.json'))) {
      const handoff = JSON.parse(fs.readFileSync(path.join(handoffDir, f), 'utf8'));
      assert.equal(validateHandoff(handoff), true, JSON.stringify(validateHandoff.errors));
      assert.match(handoff.team_stage, /^team-/);
      assert.notEqual(handoff.stage, 'implement');
    }
  } finally {
    rmrf(projectRoot);
  }
});

test('team marks failed worker and leaves state for inspection', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-team-fail-'));
  const dispatcher = async ({ agent, stage }) => {
    if (agent === 'research') throw new Error('research unavailable');
    return {
      stage,
      agent,
      decided: `${agent} ok`,
      rejected: '',
      risks: '',
      files: [],
      remaining: '',
    };
  };

  try {
    await assert.rejects(
      () => teamCycle({
        task: 'failure smoke',
        sessionId: 'unit-team-fail',
        harnessRoot: ROOT,
        projectRoot,
        workers: 'planner,research,security',
        dispatcher,
      }),
      /team worker research failed: research unavailable/
    );

    const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-team-fail');
    const state = JSON.parse(fs.readFileSync(path.join(sessionDir, 'team.json'), 'utf8'));
    assert.equal(state.tasks.find(t => t.worker === 'research').status, 'failed');
    assert.equal(state.tasks.find(t => t.worker === 'planner').status, 'done');
  } finally {
    rmrf(projectRoot);
  }
});
