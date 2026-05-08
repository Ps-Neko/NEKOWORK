import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { analyzeBuildIntent } from '../../scripts/lib/build-intelligence.js';

const CASES = [
  ['README typo', 'fix README typo', 'fast', 'documentation'],
  ['docs update', 'update docs for install flow', 'fast', 'documentation'],
  ['OAuth login', 'add OAuth login', 'safe', 'security-sensitive'],
  ['JWT refresh token', 'implement JWT refresh token rotation', 'safe', 'security-sensitive'],
  ['payment webhook', 'implement payment webhook signature validation', 'safe', 'financial-sensitive'],
  ['database migration', 'add database migration for accounts schema', 'safe', 'data-sensitive'],
  ['GitHub Actions deploy workflow', 'change GitHub Actions deploy workflow for production', 'safe', 'deploy-sensitive'],
  ['dashboard UI', 'build dashboard UI filters', 'team', 'product-ui'],
  ['React component accessibility', 'improve React component accessibility states', 'team', 'product-ui'],
  ['regression coverage', 'add regression coverage for parser edge cases', 'tdd', 'test-focused'],
  ['parser unit tests', 'add parser unit tests', 'tdd', 'test-focused'],
  ['changelog release', 'prepare changelog release notes', 'release', 'release-readiness'],
  ['npm package publish', 'prepare npm package publish notes', 'release', 'release-readiness'],
];

test('Build Intelligence v0 routes representative task intents', () => {
  for (const [name, task, mode, taskType] of CASES) {
    const result = analyzeBuildIntent({ task });
    assert.equal(result.recommendedMode, mode, name);
    assert.equal(result.taskType, taskType, name);
    assert.ok(result.explanation.some(line => line.includes(`selected ${mode} mode`)), name);
    assert.ok(result.acceptanceCriteria.length >= 3, name);
    assert.ok(result.miniPlan.length >= 4, name);
    assert.ok(result.selfCheck.includes('Apply remains opt-in and gated by SHIP_READY plus clear gates.'), name);
  }
});

test('safe routing includes strict verification posture and useful workers', () => {
  const result = analyzeBuildIntent({ task: 'change OAuth token validation' });
  assert.equal(result.recommendedMode, 'safe');
  assert.equal(result.profile, 'security');
  assert.equal(result.strictQuality, true);
  assert.equal(result.secure, true);
  assert.deepEqual(result.workers, ['planner', 'security', 'test']);
  assert.ok(result.explanation.some(line => /Codex challenge/.test(line)));
});

test('release routing keeps Codex challenge when deploy risk policy detects release terms', () => {
  const result = analyzeBuildIntent({ task: 'prepare npm package publish release notes' });
  assert.equal(result.recommendedMode, 'release');
  assert.equal(result.profile, 'quality');
  assert.equal(result.secure, true);
  assert.ok(result.tags.includes('deploy'));
  assert.ok(result.explanation.some(line => /Human Gate may be required/.test(line)));
});
