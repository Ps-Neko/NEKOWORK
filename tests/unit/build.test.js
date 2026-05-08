import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildCycle, buildModePreset, normalizeBuildMode } from '../../scripts/orchestrators/build.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('build mode presets keep verification defaults explicit', () => {
  assert.equal(normalizeBuildMode(null), 'fast');
  assert.equal(buildModePreset('fast').profile, 'quality');
  assert.equal(buildModePreset('safe').profile, 'security');
  assert.equal(buildModePreset('safe').secure, true);
  assert.equal(buildModePreset('tdd').strictQuality, true);
  assert.equal(buildModePreset('team').team, true);
  assert.throws(() => normalizeBuildMode('autopilot'), /unknown build mode/);
});

test('build fast wraps run without implicit apply', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-build-fast-'));
  const calls = [];
  try {
    const r = await buildCycle({
      task: 'build fast smoke',
      mode: 'fast',
      sessionId: 'unit-build-fast',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher: dispatcher(calls, { reviewVerdict: 'approve' }),
    });

    assert.deepEqual(calls.map(c => c.stage), ['implement', 'codex-review', 'ship']);
    assert.equal(r.mode, 'fast');
    assert.equal(r.profile, 'quality');
    assert.equal(r.applied, false);
    assert.equal(r.shipReady, true);
    assert.ok(fs.existsSync(path.join(r.sessionDir, 'build-summary.json')));
    const summary = readSummary(r.sessionDir);
    assert.equal(summary.team_run, false);
    assert.equal(summary.profile, 'quality');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('build safe enables security profile, strict quality, and Codex challenge', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-build-safe-'));
  const calls = [];
  try {
    const r = await buildCycle({
      task: 'build safe auth smoke',
      mode: 'safe',
      sessionId: 'unit-build-safe',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher: dispatcher(calls, { reviewVerdict: 'approve', challengeVerdict: 'approve' }),
    });

    assert.deepEqual(calls.map(c => c.stage), ['implement', 'codex-review', 'codex-challenge', 'ship']);
    assert.equal(r.profile, 'security');
    assert.equal(r.strictQuality, true);
    assert.equal(r.secure, true);
    const summary = readSummary(r.sessionDir);
    assert.equal(summary.secure, true);
    assert.equal(summary.strict_quality, true);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('build team runs read-only team handoffs before single executor work', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-build-team-'));
  const calls = [];
  try {
    const r = await buildCycle({
      task: 'build team smoke',
      mode: 'team',
      sessionId: 'unit-build-team',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher: dispatcher(calls, { reviewVerdict: 'approve' }),
    });

    const stages = calls.map(c => c.stage);
    assert.deepEqual(stages.slice(0, 4), ['plan', 'plan', 'self-review', 'plan']);
    assert.deepEqual(stages.slice(4), ['implement', 'codex-review', 'ship']);
    assert.ok(calls.slice(0, 4).every(c => c.executionMode === 'read-only'));
    assert.equal(r.team.workers.join(','), 'planner,product,security,test');
    assert.equal(readSummary(r.sessionDir).team_run, true);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

function dispatcher(calls, options = {}) {
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
      model: args.agent === 'codex-reviewer' || args.agent === 'codex-challenger' ? 'gpt-5-codex' : 'sonnet',
      decided: `${args.stage} done`,
      files: [],
    };

    if (args.executionMode === 'read-only') {
      return {
        ...base,
        rejected: 'project mutation',
        risks: 'read-only thinking only',
        remaining: 'single executor implementation',
        verdict: 'approve',
      };
    }

    if (args.stage === 'implement') {
      return { ...base, files: ['README.md'], remaining: 'verify' };
    }

    if (args.stage === 'codex-review') {
      return {
        ...base,
        files: ['README.md'],
        verdict: options.reviewVerdict || 'approve',
        issues: [],
      };
    }

    if (args.stage === 'codex-challenge') {
      return {
        ...base,
        verdict: options.challengeVerdict || 'approve',
        issues: [],
      };
    }

    if (args.stage === 'ship') {
      return { ...base, files: ['docs/CHANGELOG.md'] };
    }

    throw new Error(`unexpected stage ${args.stage}`);
  };
}

function readSummary(sessionDir) {
  return JSON.parse(fs.readFileSync(path.join(sessionDir, 'build-summary.json'), 'utf8'));
}
