import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ralphLoop } from '../../scripts/orchestrators/ralph.js';
import { rmrf } from '../helpers/tmp.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('ralph defaults to legacy review engine for compatibility', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ralph-review-'));
  try {
    const r = await ralphLoop({
      task: 'legacy ralph smoke',
      sessionId: 'unit-ralph-review',
      harnessRoot: ROOT,
      projectRoot,
      maxIter: 1,
    });

    assert.equal(r.engine, 'review');
    assert.equal(r.reason, 'max_iter');
    assert.deepEqual(r.iteration_sessions, ['unit-ralph-review-i1']);
    assert.ok(fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-ralph-review-i1', 'review-summary.json')));
    assert.equal(fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-ralph-review', 'active')), false);
  } finally {
    rmrf(projectRoot);
  }
});

test('ralph can iterate through the decomposed run engine', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ralph-run-'));
  const calls = [];
  try {
    const r = await ralphLoop({
      task: 'run engine ralph smoke',
      sessionId: 'unit-ralph-run',
      harnessRoot: ROOT,
      projectRoot,
      maxIter: 3,
      engine: 'run',
      dispatcher: dispatcher(calls),
    });

    assert.equal(r.engine, 'run');
    assert.equal(r.reason, 'all_passed');
    assert.equal(r.iter, 3);
    assert.deepEqual(r.iteration_sessions, ['unit-ralph-run-i1', 'unit-ralph-run-i2', 'unit-ralph-run-i3']);
    assert.deepEqual(calls.map(c => c.stage), [
      'implement', 'codex-review', 'ship',
      'implement', 'codex-review', 'ship',
      'implement', 'codex-review', 'ship',
    ]);
    assert.ok(fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-ralph-run-i1', 'run-summary.json')));
    assert.ok(fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-ralph-run-i3', 'run-summary.json')));
    const prd = JSON.parse(fs.readFileSync(path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-ralph-run', 'prd.json'), 'utf8'));
    assert.equal(prd.acceptance.filter(a => a.passes).length, 3);
  } finally {
    rmrf(projectRoot);
  }
});

test('ralph rejects unknown engines', async () => {
  await assert.rejects(
    () => ralphLoop({
      task: 'bad engine',
      sessionId: 'unit-ralph-bad-engine',
      harnessRoot: ROOT,
      engine: 'parallel-writes',
    }),
    /unknown ralph engine/
  );
});

function dispatcher(calls) {
  return async (args) => {
    calls.push(args);
    const base = {
      stage: args.stage,
      agent: args.agent,
      round: args.context?.round || 1,
      session_id: args.sessionId,
      timestamp: new Date().toISOString(),
      duration_ms: 1,
      provider: 'mock',
      model: args.agent === 'doc-writer' ? 'haiku' : args.agent.startsWith('codex') ? 'gpt-5-codex' : 'sonnet',
      decided: `${args.stage} done`,
      rejected: '',
      risks: '',
      files: ['src/example.ts'],
      remaining: '',
      issues: [],
    };

    if (args.stage === 'codex-review') {
      return { ...base, verdict: 'approve', confidence: 0.95 };
    }

    return base;
  };
}
