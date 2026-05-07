import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { workCycle, _nextRound, _readPriorHandoffs } from '../../scripts/orchestrators/work.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('nextRound increments implement rounds from prior handoffs', () => {
  assert.equal(_nextRound([], 'implement'), 1);
  assert.equal(_nextRound([{ stage: 'implement', round: 1 }], 'implement'), 2);
  assert.equal(_nextRound([{ stage: 'implement', round: 2 }, { stage: 'plan', round: 1 }], 'implement'), 3);
});

test('work runs one executor stage and writes implement handoff without Codex or ship', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-work-project-root-'));
  const calls = [];
  const dispatcher = async (args) => {
    calls.push(args);
    return {
      stage: args.stage,
      agent: args.agent,
      round: args.context.round,
      session_id: args.sessionId,
      timestamp: new Date().toISOString(),
      duration_ms: 1,
      provider: 'mock',
      model: 'sonnet',
      decided: 'implemented in mock mode',
      rejected: 'codex review and ship',
      risks: 'unverified implementation',
      files: ['src/example.ts'],
      remaining: 'run verification before apply/ship',
    };
  };

  try {
    const handoffDir = path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-work', 'handoffs');
    fs.mkdirSync(handoffDir, { recursive: true });
    fs.writeFileSync(path.join(handoffDir, '00-question-gate.json'), JSON.stringify({
      stage: 'question-gate',
      agent: 'question-gate',
      decided: 'ask first',
      files: [],
    }));

    const r = await workCycle({
      task: 'implement example',
      sessionId: 'unit-work',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher,
    });

    assert.equal(r.sessionId, 'unit-work');
    assert.equal(r.handoff.stage, 'implement');
    assert.equal(r.round, 1);
    assert.deepEqual(r.files, ['src/example.ts']);
    assert.equal(r.diffPath, null);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].agent, 'executor');
    assert.equal(calls[0].stage, 'implement');
    assert.equal(calls[0].live, false);
    assert.equal(calls[0].executionMode, undefined);
    assert.equal(calls[0].context.priorHandoffs.length, 1);

    assert.ok(fs.existsSync(path.join(handoffDir, '03-implement.json')));
    assert.ok(fs.existsSync(path.join(handoffDir, '03-implement.md')));
    assert.ok(fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-work', 'acceptance-criteria.json')));
    const summary = JSON.parse(fs.readFileSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-work', 'work-summary.json'), 'utf8'));
    assert.equal(summary.codex_review_run, false);
    assert.equal(summary.ship_run, false);
    assert.equal(summary.target_project_mutated, false);
    assert.equal(summary.acceptance_required, true);
    assert.equal(summary.acceptance_count, 3);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('work appends round suffix when an implement handoff already exists', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-work-round-'));
  const dispatcher = async (args) => ({
    stage: args.stage,
    agent: args.agent,
    round: args.context.round,
    session_id: args.sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: 1,
    provider: 'mock',
    model: 'sonnet',
    decided: 'round work',
    files: [],
  });

  try {
    const handoffDir = path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-work-round', 'handoffs');
    fs.mkdirSync(handoffDir, { recursive: true });
    fs.writeFileSync(path.join(handoffDir, '03-implement.json'), JSON.stringify({
      stage: 'implement',
      agent: 'executor',
      round: 1,
      decided: 'old work',
      files: [],
    }));

    const prior = _readPriorHandoffs(handoffDir);
    assert.equal(prior.length, 1);

    const r = await workCycle({
      task: 'second work',
      sessionId: 'unit-work-round',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher,
    });

    assert.equal(r.round, 2);
    assert.ok(fs.existsSync(path.join(handoffDir, '03-implement-r2.json')));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
